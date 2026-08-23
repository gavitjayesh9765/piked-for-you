# Google sign-in

> "Continue with Google" for shoppers. Google is an *additional* door onto the
> same account, not a second kind of user.

---

## What is already true

Most of this flow predates the feature. The `/auth/callback` route was built for
email confirmation links, and Supabase sends OAuth returns to the same place with
the same one-time `code`:

| Piece | State |
|---|---|
| `frontend/src/app/auth/callback/route.ts` | Already exchanges `code` for a session **server-side**, already validates `next` through `safePublicPath`. Unchanged. |
| `frontend/src/components/auth/PublicAuthForm.tsx` | Gained the button and `signInWithOAuth`. |
| `supabase/migrations/…_oauth_profile_metadata.sql` | `handle_new_user()` now reads the provider's name and avatar. |
| `frontend/src/lib/display-name.ts` | Shared name/avatar/provider resolution. Google sends `full_name`, not our `display_name`. |
| `supabase/config.toml` | `[auth.external.google]` — **local stack only**. |
| `supabase/scripts/push-google-provider.sh` | Configures the hosted project. |
| Google Cloud Console | The OAuth client. Manual, once — the only manual step. |

## Google Cloud Console (once)

1. **APIs & Services → OAuth consent screen.** External. App name *PickDForYou*,
   support email, logo, and the app domain. Scopes: `email`, `profile`, `openid`
   — nothing more. Anything beyond those three drags the project into Google's
   verification review for no gain, since the only claims we read are the name
   and the picture.
2. Publish the consent screen. While it is in *Testing*, only the addresses
   listed under **Test users** can sign in, and everyone else gets a flat
   "access blocked" with no explanation on our side to soften it.
3. **Credentials → Create credentials → OAuth client ID → Web application.**
   - Authorised JavaScript origins: `https://pickdforyou.com` (and
     `http://localhost:3000` for local work).
   - Authorised redirect URIs: **the Supabase callback, not ours.**
     ```
     https://<project-ref>.supabase.co/auth/v1/callback
     http://localhost:54321/auth/v1/callback
     ```
     This is the step that is wrong most often. The browser's journey is
     Google → *Supabase* → `/auth/callback` on our domain; Google never
     redirects to us directly, so putting `https://pickdforyou.com/auth/callback`
     here produces `redirect_uri_mismatch` and nothing else.
4. Copy the client ID and client secret.

## Hosted project (once) — scripted, not clicked

`config.toml` does not sync to the hosted project; its auth config is separate
state behind the Management API. Same split as the
[auth emails](./08-auth-emails.md), and the same answer — a script, so the live
settings are readable from the repo instead of only from a dashboard:

```bash
export SUPABASE_ACCESS_TOKEN=sbp_...        # dashboard → account → tokens
export SUPABASE_AUTH_GOOGLE_CLIENT_ID=...   # from step 4 above
export SUPABASE_AUTH_GOOGLE_SECRET=...
bash supabase/scripts/push-google-provider.sh --dry-run
bash supabase/scripts/push-google-provider.sh
```

It enables the provider, and — the half that gets forgotten — writes the
**redirect allow-list**. Supabase validates the `redirectTo` we send against
that list and silently falls back to the site URL when it fails. That is not an
error anyone sees: sign-in succeeds and the shopper simply lands on the
homepage instead of the page they were reading, every time, with nothing logged
on our side.

The script reads its own work back and exits non-zero if the provider is off,
the client ID did not stick, or the production callback is missing from the
list. `--disable` turns Google sign-in off again.

It also sets two things that are not about Google but share this config object:
`password_hibp_enabled` (the database linter's
`auth_leaked_password_protection` finding — a hosted-only feature with no local
equivalent) and `password_min_length: 10`, which is the floor the signup form
already claims in the browser.

## Local stack

```bash
cp supabase/.env.example supabase/.env    # fill in the two Google values
# then in supabase/config.toml: [auth.external.google] enabled = true
supabase stop && supabase start
```

`enabled` has to be a literal `true`/`false` — it cannot key off whether the
secret happens to be set — and the CLI refuses to start an enabled provider with
an empty `client_id`. So it ships as `false`, and a developer who has not set up
credentials gets a button that reports it could not start sign-in, rather than a
stack that will not boot.

## What a Google account gets

Nothing a password account does not.

- **No admin, and no route to it.** The role lives in `app_metadata`, writable
  only with the service_role key and re-derived from the signed JWT by three
  independent gates — `verify_token()` in the API, `is_admin()` in RLS, and the
  proxy. `signInWithOAuth` is not an exception to any of them.
- **No Google identity on an admin account, either.** This is the part that
  enabling Google actually created, and it runs the opposite way to the
  question people ask. Supabase links a federated identity into an existing
  account on a matching verified email — desirable for shoppers, and something
  else entirely for an admin whose address is a Gmail one, because control of
  that Google account then becomes a way into the admin row that never touches
  the admin password. TOTP still stands in the way, but two factors have
  quietly become one.

  Two database triggers make that account shape impossible in both directions
  (`…_separate_admin_and_federated_identities.sql`): a federated identity
  cannot attach to an admin account, and the admin role cannot be granted to an
  account that already has one. An admin who tries "Continue with Google" is
  refused and sees a generic failure — the sign-in page is not the place to
  disclose which addresses hold staff roles.

  **This changes admin creation.** Promoting an existing shopper who signed up
  with Google now fails, deliberately. See `docs/05-admin-setup.md`.
- **One profile, not two.** Supabase links a Google identity to an existing
  account when the provider asserts the *same verified email*. Someone who
  registered with a password and later taps "Continue with Google" on that
  address lands in the same account, keeping their reviews.
- **A real display name.** `handle_new_user()` reads `display_name` (ours),
  then `full_name`/`name` (Google's), then the email local part. Before the
  migration it read only the first, so every Google signup would have been
  published on their reviews as the front half of their email address. The
  header, the account page and the settings page had the same bug for the live
  session; `lib/display-name.ts` now holds that order once, and it is
  deliberately the same order as the SQL.
- **An avatar, if it is https.** The trigger and `PATCH /me/profile` apply the
  identical rule to `profiles.avatar_url`, because that column ends up as an
  image URL in other shoppers' browsers and the provider claim it is now seeded
  from arrives inside user-writable metadata.
- **No password to reset.** The settings page hides the password-reset link for
  an account with no `email` identity — "reset your password" is an instruction
  a Google-only account cannot follow — and says where the password actually
  lives instead.

## Failure modes worth recognising

| Symptom | Cause |
|---|---|
| `redirect_uri_mismatch` at Google | The console has our callback instead of Supabase's. See step 3. |
| Signs in, always lands on `/` | `redirectTo` is not in the Supabase redirect allow-list, so it fell back to the site URL. |
| `?error=invalid_link` on `/login` | The `code` was already exchanged (a refresh, or a link-prefetching mail client) or it expired. |
| "Access blocked" for everyone but you | Consent screen still in *Testing*. |
| Works locally, not in production | Two OAuth clients, or one client missing the production origin. Check which client ID the hosted project holds. |
