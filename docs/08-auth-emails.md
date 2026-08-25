# Auth emails

> Every email Supabase Auth sends on our behalf, branded and generated from one
> layout. Thirteen templates, zero mention of Supabase.

---

## Where things live

| Path | What |
|---|---|
| `supabase/templates/build.mjs` | **Source of truth.** Layout, copy, brand tokens, verifier. |
| `supabase/templates/*.html` | Generated output. Committed, never hand-edited. |
| `supabase/templates/manifest.json` | Generated. Maps each template to its Management API keys. |
| `supabase/scripts/push-email-templates.sh` | Deploys to the hosted project. |
| `supabase/config.toml` | Wires the same files into the **local** stack. |

There is no include mechanism in Supabase templates — each one is a standalone
HTML blob. Thirteen hand-maintained copies of the same table shell means a brand
tweak is thirteen edits and one of them is silently wrong, so the shell lives in
the builder once and each template contributes only its content.

## Commands

```bash
node supabase/templates/build.mjs                    # regenerate + verify
node supabase/templates/build.mjs --check            # verify only, exits 1 on drift
node supabase/templates/build.mjs --preview out.html # contact sheet of all 13
bash supabase/scripts/push-email-templates.sh --dry-run
bash supabase/scripts/push-email-templates.sh        # needs SUPABASE_ACCESS_TOKEN
```

`--check` is the one to run before a release: it fails if the committed HTML no
longer matches the builder, which is the only way the two can disagree.

## Two configs, not one

`config.toml` configures the **local** stack only. The hosted project's templates
are separate state behind the Management API, and the Supabase MCP server exposes
no tool for them. That is the whole reason the push script exists. Change copy in
one place (the builder) and both consume it.

The push script generates its payload in memory from the builder rather than
reading the `.html` files, so a forgotten rebuild cannot ship a stale email.

## The templates

**Auth actions** — sent in response to something the user did.

| Key | Trigger | Variables |
|---|---|---|
| `confirmation` | Signup | `ConfirmationURL` |
| `recovery` | Password reset | `ConfirmationURL`, `Email` |
| `magic_link` | Passwordless sign-in | `ConfirmationURL`, `Email` |
| `email_change` | Address change | `ConfirmationURL`, `Email`, `NewEmail` |
| `invite` | Dashboard invite | `ConfirmationURL` |
| `reauthentication` | Sensitive action | `Token` |

**Security notifications** — sent after the fact. Currently `enabled = false`
everywhere; the templates exist so that turning them on is a one-line decision
rather than a design project.

`password_changed`, `email_changed`, `phone_changed`, `mfa_factor_enrolled`,
`mfa_factor_unenrolled`, `identity_linked`, `identity_unlinked`.

To turn them on: flip `enabled` in `config.toml` for local, and push with
`--enable-notifications` for the hosted project. A plain push never changes an
enabled flag — updating a template must not, by itself, start sending a class of
mail nobody signed off on.

## Rules the verifier enforces

The build fails, and nothing is written or pushed, if any of these break:

- **A template renders only the variables it actually receives.** Supabase
  substitutes per-flow; anything else reaches the user as literal
  `{{ .Whatever }}`. `reauthentication` has no `ConfirmationURL` at all.
- **No mention of Supabase**, including in comments.
- **Balanced markup** — catches a dropped `</td>` in the layout.
- **Under Gmail's ~102 KB clipping threshold.** Largest today is ~13 KB.
- **Every call to action kept its `href`.**
- **Notifications contain no `<a>` at all** — see the design note below.

## Design notes

- Table layout, inlined styles, 600px, VML button for Outlook. The `<style>`
  block only adds the dark theme, hover and the narrow breakpoint — a client
  that strips it still renders the light theme correctly.
- Colours mirror `frontend/src/styles/tokens.css` but are **duplicated
  deliberately**. An email is frozen the moment it is sent, so it should not
  silently follow a theme refactor it was never tested against.
- Notifications carry **no link**. A "something changed" email with a button is
  exactly the shape of the phishing mail that follows a real breach, so they
  describe what happened and let the user navigate themselves. That extends to
  the footer: the site host is clickable in the six auth-action mails, which
  already carry a link the user is meant to follow, and plain text in the seven
  notifications. "A security notice contains nothing to click" is worth more
  than a uniform footer, and the verifier enforces it.
- `email_change` is written to read correctly to **both** recipients, because
  `double_confirm_changes = true` sends it to the old and new address.

## Changing the domain

`SITE_URL` in the builder is the only place a host is written. Today it is the
Vercel deployment:

```js
const SITE_URL = "https://sortedchoice.com";
```

When the real domain is bought, change that line, rebuild, and push. Nothing
else in the templates hardcodes a host.

It is deliberately **not** `{{ .SiteURL }}`. Supabase only substitutes that
variable for the auth-action mails, so the seven notification templates would
ship it to the inbox as the literal string `{{ .SiteURL }}`. One constant renders
correctly in all thirteen.

Separately, the hosted project needs its **Site URL** and **Redirect URLs**
(`/auth/callback`) pointed at the same host in the dashboard, or the links in
these emails will bounce. That is dashboard state, not `config.toml` — the
`localhost:3000` in `config.toml` configures the local stack and is correct as-is.

## Gotchas

- Link lifetime is quoted as **24 hours**, from Supabase's `mailer_otp_exp`
  default (86400s), which `config.toml` does not override. It is a single
  constant in the builder — if you shorten it in the dashboard, change
  `LINK_LIFETIME` and rebuild.
- Local changes need `supabase stop && supabase start`; the templates are read
  at container boot.
- Local mail lands in Inbucket on `http://localhost:54324`, not a real inbox.
