# Newsletter email

> The transport three modules were written around and none of them had. Brevo,
> on the free plan. Our list stays ours.

---

## Why a delivery API and not a newsletter platform

Two different kinds of product get recommended for this and only one of them
fits.

**Newsletter platforms** — Mailchimp, MailerLite, Beehiiv, Substack — own the
list. They host the signup form, the unsubscribe link, the preference centre
and the subscriber record. Adopting one means deleting
`newsletter_subscribers`, or keeping it and running two sources of truth that
drift the first time somebody unsubscribes from an email instead of the site.

**Delivery APIs** — Brevo, Resend, SES, Postmark — put bytes in inboxes and
nothing else. The list stays in our database, behind our RLS, with our
`unsubscribe_token`.

This project already had the entire subscription system — double opt-in,
persistent unsubscribe tokens, three cadences, a composite index built for the
send job — and no way to send a single message. So the missing piece was
delivery, not a platform.

## Why Brevo and not Resend

| Provider | Free allowance | The catch |
|---|---|---|
| **Brevo** | **300/day**, unlimited contacts | Transactional and campaigns share the 300 |
| Resend | 3,000/month but **100/day** | The daily cap is the documented reason teams leave |
| MailerLite | 12,000/month, 1,000 subscribers | A platform — see above |
| SendGrid | — | No longer has a free tier |
| SES | 3,000/month for 12 months | Sandbox approval, then ~$0.10/1,000 |

Resend has the better API and would also serve as Supabase custom SMTP for the
[thirteen auth templates](./08-auth-emails.md). It still loses here, on
arithmetic: **a newsletter is a burst, not a trickle.** One weekly send to 500
confirmed subscribers is 500 messages in a minute. Neither free plan absorbs
that, but 300/day drains it in two days and 100/day takes five, which is not a
weekly newsletter any more.

Worth being explicit about what the 300 is shared with: every confirmation
mail sent from `subscribe()` spends from the same budget a campaign would.

## Setup

### Brevo (once)

1. Create the account. Free plan, no card.
2. **Senders, Domains & Dedicated IPs → Domains → Add a domain.** Add the
   sending domain and publish the DKIM and SPF records it gives you. Do this
   before anything else — Brevo rejects a send from an unauthenticated domain
   at the API, so an unverified sender is a hard error, not a spam-folder
   problem.
3. **SMTP & API → API Keys → Generate a new API key.** This is `BREVO_API_KEY`.

### Environment

| Variable | What | Notes |
|---|---|---|
| `MAIL_PROVIDER` | `brevo` / `console` / `disabled` | `console` is refused in production — see below |
| `BREVO_API_KEY` | The v3 API key | Required when provider is `brevo`, checked at startup |
| `MAIL_FROM_EMAIL` | Sender address | Must be on the domain authenticated in step 2 |
| `MAIL_FROM_NAME` | Display name | Defaults to `SortedChoice` |
| `MAIL_REPLY_TO` | Optional | Empty means replies go to the sender |
| `SITE_URL` | The **frontend** origin | Not this API — see below |

`MAIL_PROVIDER` defaults to **`disabled`** — a host that has never heard of
these variables boots and sends nothing, which is what this codebase did
before the transport existed. Flip it to `brevo` once the above is done; that
is the one deliberate step.

> The blueprint is currently parked at `render.yaml.disabled`, so Render is
> not reading it. Set these in the dashboard, or rename the file back.

### Local

```bash
MAIL_PROVIDER=console
SITE_URL=http://localhost:3000
```

`console` logs the message and its links instead of sending. Reading the
confirm URL out of the log is how you exercise double opt-in without a key.
It is opt-in rather than the development default, because a default that is
unsafe in production is a default that eventually reaches production — see
the note on `MAIL_PROVIDER` in `config.py`.

## Collecting now, sending later

**`MAIL_PROVIDER` is `disabled`, on purpose, and that is the current state of
the product rather than an unfinished setup.** Brevo is wired up and tested;
the decision is to build the list first and send once there are enough verdicts
to make a newsletter worth opening. Everything below exists so that pause is
honest instead of a set of small lies that get discovered in two months.

**Nothing claims a mail was sent.** `MailTransport` carries a `delivers` flag —
true for Brevo and for `console`, false for `NullTransport`. Without it,
`NullTransport.send()` returned without raising, `_send_confirmation` read that
as success, and every subscriber collected during the pause was stamped with a
`confirmation_sent_at` for a message that never left the process. That column is
the only record of who has been asked to confirm, so forging it destroys the one
thing needed to mail the backlog later: the ability to tell the never-asked from
the asked-and-ignored.

**The signup form does not promise an email.** It used to say "We've sent a
confirmation to <address>" unconditionally. `subscribe()` now returns
`mailEnabled`, and the form says "the newsletter hasn't started yet" instead.
That field is a property of the **deployment**, identical for every caller —
deliberately not "did we mail *you*", which varies with whether the address was
already confirmed and would rebuild the enumeration oracle this module exists to
close.

**The admin panel says why.** `/admin/newsletter` lists every subscriber with
the same furniture as the other queues — state tabs with counts, email search,
cadence filter, CSV export — and carries a banner explaining that everyone is
unconfirmed because no mail is going out. Without it, "Confirmed: 0" against a
growing list reads as a broken signup flow, and the fix somebody reaches for is
marking people confirmed, which is consent nobody gave.

**Nothing in the panel can change a subscriber's state.** Confirming,
unsubscribing and changing cadence are each authorised by a token the subscriber
holds. An admin control that set `confirmed_at` would be a way to manufacture
consent — the single thing double opt-in exists to prevent — so the endpoint is
read-only and the export defaults to `confirmed` only.

### Turning it on

1. Verify the sending domain in Brevo (SPF + DKIM), per **Setup** above.
2. Set `BREVO_API_KEY`, then `MAIL_PROVIDER=brevo`. Restart.
3. Every new signup gets a confirmation from that moment.
4. The backlog is in `/admin/newsletter` under **Unconfirmed**, showing **"Not
   asked yet"** — those are the addresses collected while sending was off. They
   are knowable precisely because `confirmation_sent_at` was never faked.

Nothing needs a migration, and no subscriber data changes when the switch flips.

## Three decisions worth knowing about

### `SITE_URL` is the frontend, not the API

The confirmation link cannot be derived from the incoming request: that
request arrives at the API's host, and `/api/v1/newsletter/confirm` answers
with `{"accepted":true}`. A subscriber who clicks through to that sees a brace
on a white page, which is indistinguishable from a broken site. So the link
points at `frontend/src/app/(site)/newsletter/confirm`, which calls the API
and says something.

### The confirmation is completed by JavaScript, on purpose

Confirming is a write, and the API clears the token on success so the link is
single-use. Corporate mail gateways and inbox link-scanners fetch every URL in
an incoming message before the recipient sees it. Server-rendering the
confirmation would hand the scanner the one use, and the real click would then
be told the link is no longer valid — a failure that looks like a bug in the
email and leaves no trace on our side.

Scanners do not run JavaScript. `ConfirmSubscription` fires from `useEffect`,
which keeps it one click and makes the prefetch harmless.

### A delivery failure does not change the response

`subscribe()` returns the same 202 whether the mail was accepted or not, and
`_send_confirmation` never raises. That is not sloppiness — the module's whole
contract is that its response does not vary with the recipient, and an error
surfaced to the caller rebuilds the account-enumeration oracle
[migration 20260821000011](../supabase/migrations/) exists to close, out of
status codes.

What a failure does change: `confirmation_sent_at` stays NULL. It means "a
confirmation is in flight", not "we tried", and that distinction is what makes
re-submitting the address a working retry instead of a no-op.

There is no retry queue, deliberately. Render's `plan: free` spins down after
15 minutes idle, so an in-process retry holds a token in memory that the next
spin-down drops silently.

## The template

`app/emails/newsletter_confirmation.html` is **generated**, by the same
`supabase/templates/build.mjs` that builds the auth mails, from the same
layout and palette. It is the fourteenth template and the only one with
`kind: "transactional"` — Supabase never sees it, so it is excluded from
`manifest.json` and from the Management API payload.

```bash
node supabase/templates/build.mjs            # regenerate
node supabase/templates/build.mjs --check    # fails on drift
node supabase/templates/build.mjs --preview out.html
```

It is generated **into the backend package** rather than beside the auth
templates because `render.yaml` sets `rootDir: backend`. Reading
`../../supabase/templates/` at runtime would bet on the deploy shipping a
sibling directory the service has no other use for, and the failure mode is
the bad kind: fine locally, `FileNotFoundError` on the first real signup.

That in turn is why `pyproject.toml` carries

```toml
[tool.setuptools.package-data]
"app.emails" = ["*.html"]
```

Without it `pip install .` copies only `.py` files and reintroduces exactly
that failure. `tests/test_newsletter_mail.py::test_template_is_present_and_renders`
is the guard.

## Still not wired

Deliberately out of scope for this pass, both already noted in the code:

- **The campaign send job.** The index (`ix_newsletter_send`) and the cadence
  column are built for it; nothing reads them yet. It will need to respect the
  300/day ceiling and set `List-Unsubscribe` from each row's persistent token.
- **The contact-form acknowledgement** — `app/modules/contact/router.py` still
  carries its `⚠ No acknowledgement email is sent` note. The transport it
  needs now exists.
