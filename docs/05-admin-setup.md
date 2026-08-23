# Creating an admin

> Admins are created **manually**, by design. There is no admin signup page, no
> invite endpoint, and no API route that can grant the role.

---

## Why it works this way

An admin is an ordinary `auth.users` row whose **`app_metadata.role` is `'admin'`**.

The security property that matters:

- **`app_metadata` is writable only with the `service_role` key.** That key lives
  in the FastAPI environment and never reaches a browser.
- **`user_metadata`** *is* user-writable — which is exactly why nothing in this
  codebase ever reads it for authorization. Only `app_metadata` counts.
- The role is signed into the JWT server-side, so editing a response, crafting a
  request, or calling the client SDK cannot change it.

**There is no code path by which a shopper becomes an admin.** The only way is a
human with database access running the SQL below.

---

## Create the first admin

### 1. Create the user

Supabase Dashboard → **Authentication → Users → Add user**

- Email: your admin address
- Password: generate a strong one, store it in a password manager
- **Auto Confirm User: ON** (there is no signup email flow for admins)

### 2. Grant the role

Dashboard → **SQL Editor**, then run:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
                        || '{"role": "admin"}'::jsonb
where email = 'you@example.com';
```

`raw_app_meta_data` is the column behind `app_metadata`. The `||` merge preserves
whatever Supabase already stored there (provider, etc.) rather than replacing it.

### 3. Verify

```sql
select email,
       raw_app_meta_data ->> 'role' as role,
       email_confirmed_at is not null as confirmed
from auth.users
where email = 'you@example.com';
```

Expect `role = admin` and `confirmed = true`.

The role is read at token-issue time, so **sign out and back in** if you were
already logged in.

### 4. Enrol 2FA — immediately, before the account is handed over

Log in at `/admin/login`, then go to `/admin/security`:

1. Scan the QR code with an authenticator app (Google Authenticator, Authy, 1Password).
2. Confirm with a generated code.

**There are no recovery codes.** An earlier version of this document promised
eight of them, "shown once and stored hashed". That was never true — no such
codes were ever generated or stored, and an admin who believed otherwise would
stop looking for a real backup. The backup path is a **second enrolled
authenticator**, which Supabase actually honours. Enrol one now if there is any
chance of losing the first device; a fully locked-out admin can only be restored
from the Supabase dashboard.

From then on, admin login requires the code, and the requirement is enforced in
three independent places — the proxy, the API (`get_current_admin`), and the
database (`public.is_admin()` requires `aal2` as of migration
`20260820000008`). A stolen password alone reaches none of them.

> ### ⚠ The enrolment window is the weak point
>
> Between granting the role in step 2 and completing step 4, the account is
> protected by **its password alone**. Anyone holding that password can enrol
> *their own* authenticator and become a fully verified admin — the second
> factor becomes something the attacker chose.
>
> This cannot be closed from application code. `supabase.auth.mfa.enroll()` is
> called by the client SDK directly against Supabase using the user's own
> session, so our UI is not in that path and cannot gate it. Hiding the
> enrolment screen would change nothing.
>
> What actually contains it:
>
> - **Do steps 1–4 in one sitting**, as one person, before the credentials are
>   shared with anyone.
> - **Never send a password and "set up 2FA when you get a chance"** — that
>   sentence *is* the vulnerability.
> - If an admin account has sat unenrolled, treat its password as burned:
>   rotate it, then enrol.
> - Audit for it with the query under *Listing admins* below, which flags any
>   admin carrying no verified factor.

---

## Revoking an admin

```sql
update auth.users
set raw_app_meta_data = raw_app_meta_data - 'role'
where email = 'former-admin@example.com';
```

The change takes effect when their **current access token expires** (30 minutes),
because the role is baked into the issued JWT. To cut access immediately, also
revoke their sessions:

```sql
delete from auth.sessions
where user_id = (select id from auth.users where email = 'former-admin@example.com');
```

---

## Listing admins

```sql
select u.email,
       u.raw_app_meta_data ->> 'role' as role,
       u.last_sign_in_at,
       count(f.id) filter (where f.status = 'verified') as verified_factors
from auth.users u
left join auth.mfa_factors f on f.user_id = u.id
where u.raw_app_meta_data ->> 'role' = 'admin'
group by u.id, u.email, u.raw_app_meta_data, u.last_sign_in_at
order by verified_factors asc, u.last_sign_in_at desc nulls last;
```

Worth running periodically. Two things to look for:

- **An unexpected row** — a serious incident.
- **`verified_factors = 0`** — an admin whose account is guarded by a password
  alone, and who is therefore takeover-able by anyone holding it. Sorted first
  deliberately. Fix it the same day: rotate the password, then enrol.

---

## Rules

1. **Never seed an admin.** `supabase/seed.sql` deliberately contains no users —
   a seeded account with a known password is exactly the thing that survives into
   production.
2. **Never expose the service-role key.** It bypasses Row Level Security entirely.
   It belongs in the FastAPI environment only — never in `NEXT_PUBLIC_*`, never in
   client code, never committed.
3. **One human, one account.** No shared admin logins — the audit trail
   (`activity_logs`) is worthless if two people share a row.
4. **2FA is not optional, and it is not deferrable.** An admin can publish
   content to a public site. Enrol at creation time — an unenrolled admin
   account is a password-only admin account (see the warning in step 4).
5. **Revoke on departure**, and delete the session as shown above.
6. **Admins sign in with a password, never with Google.** Enforced by two
   database triggers, not by convention — see below.

---

## Admins and federated sign-in

An account holding the admin role has exactly one identity: `email`. Two
triggers added in `…_separate_admin_and_federated_identities.sql` enforce it
in both directions, and both will make an operation *fail* rather than warn:

| Attempt | Result |
|---|---|
| Google sign-in on an account that is already an admin | Refused. The admin sees a generic sign-in failure. |
| Granting the admin role to an account with a Google identity | The `UPDATE` above raises `insufficient_privilege`. |

**Why.** Supabase links a federated identity into an existing account whenever
the provider asserts the same *verified* email. That is what makes "sign up
with Google" and "sign up with a password" converge on one shopper profile
instead of forking into two — correct there, and wrong here. If an admin's
address is a Gmail or Workspace one, control of that Google account becomes a
route into the admin row that never touches the admin's password. TOTP still
blocks the dashboard, but two independent factors have silently collapsed into
one, and if that admin has not yet enrolled a factor then `/admin/security` is
reachable at aal1 by design so the enrolment can happen — which closes the gap
completely.

**What this means for step 2.** Promote a *freshly created* user, as the steps
above describe. Promoting an existing shopper who signed up with Google will
fail. If you need to make that person an admin, create them a separate admin
account rather than removing their Google identity — rule 3 above wants one
human to one account, but an admin account and a shopping account are two
different roles for the same human, and the audit trail is clearer when the
staff actions are the only thing on the staff account.

---

## Sessions and automatic sign-out

Sessions used to last forever: the access token expired hourly but the refresh
token renewed it indefinitely, so nothing ever ended a session. Three bounds
now apply, and they stop different things.

| Bound | Value | Where | Stops |
|---|---|---|---|
| Inactivity | 14 days | `[auth.sessions]`, project-wide | The shared or lost device nobody signed out of. |
| Timebox | 30 days | `[auth.sessions]`, project-wide | A stolen refresh token that *is* being used — the case inactivity never catches. |
| Admin idle | 30 minutes | `components/admin/IdleLogout.tsx` | An admin console left open and unattended. |

The first two are deliberately shopper-length, because they are project-wide
and being logged out of a shopping site every day is a reason to stop using it.
The admin console layers its own much shorter bound on top, warns at two
minutes remaining, and then calls `signOut({ scope: "global" })` — a real
revocation at Supabase, not a screen lock. It is applied against a wall-clock
deadline shared across tabs rather than a `setTimeout`, because background tabs
throttle timers and a sleeping laptop suspends them entirely.

Push the project-wide values with
`bash supabase/scripts/push-google-provider.sh`; they are part of the same auth
config object.

---

## Local development

```bash
supabase start        # requires Docker
supabase db reset     # applies migrations + seed.sql
```

Then create a local admin with the same two steps against
`http://localhost:54323` (the local Studio). Local credentials never leave your
machine, but still do not commit them.
