#!/usr/bin/env node
/**
 * Builds every branded email from one layout.
 *
 * WHY A BUILD STEP
 * ----------------
 * Supabase templates are standalone HTML blobs — there is no include, no
 * partial, no shared stylesheet, and the client that renders them strips most
 * of what a stylesheet would do anyway. Thirteen hand-maintained copies of the
 * same table shell means a brand tweak is thirteen edits and one of them is
 * silently wrong. So the shell lives here once, each template contributes only
 * its content, and the .html files beside this script are generated output.
 *
 * Thirteen of the fourteen are Supabase auth mails. The fourteenth is
 * `newsletter_confirmation`, which our own API sends — it is here so the brand
 * has one home, and it is generated into backend/app/emails/ so the service
 * that sends it owns the file. See the `kind: "transactional"` block below.
 *
 *   node supabase/templates/build.mjs            # write templates + manifest
 *   node supabase/templates/build.mjs --check    # verify only, non-zero on drift
 *   node supabase/templates/build.mjs --payload  # Management API body on stdout
 *
 * The generated files ARE committed: config.toml and push-email-templates.sh
 * both read them, and CI should not need a Node step to deploy an email.
 *
 * Colours mirror frontend/src/styles/tokens.css. They are duplicated rather
 * than parsed out of the CSS on purpose — an email is frozen the moment it is
 * sent, so it should not silently follow a theme refactor it was never tested
 * against. When the brand moves, move it here deliberately.
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const CHECK_ONLY = process.argv.includes("--check");
const PAYLOAD = process.argv.includes("--payload");
const ENABLE_NOTIFICATIONS = process.argv.includes("--enable-notifications");
// indexOf returns -1 when the flag is absent, and argv[0] is the node binary —
// so guard the lookup rather than reading argv[-1 + 1] and always previewing.
const previewFlag = process.argv.indexOf("--preview");
const PREVIEW = previewFlag === -1 ? null : process.argv[previewFlag + 1] || null;

/* ── Brand ─────────────────────────────────────────────────────────────── */

const c = {
  bg: "#f4f1ed",
  card: "#ffffff",
  ink: "#16161a",
  inkMuted: "#4a4856",
  inkSub: "#65626f",
  inkFaint: "#a5a2ae",
  line: "#e0dad3",
  plate: "#ede9e3",
  brandFill: "#6c5ce7",
  brandHover: "#5b4bd6",
  brandText: "#5b4bd6",
  brandSoft: "#e7e4f6",
  brandSoftLine: "#cfc7f7",
  brandOnSoft: "#3a2ba8",
  warnSoft: "#f1e5d2",
  warnSoftLine: "#e3cfa8",
  warnOnSoft: "#7c4306",
};

const f = {
  display: "'Hanken Grotesk','Segoe UI',Helvetica,Arial,sans-serif",
  body: "'Inter','Segoe UI',Helvetica,Arial,sans-serif",
  label: "'Geist','Segoe UI',Helvetica,Arial,sans-serif",
  mono: "'Geist Mono',ui-monospace,Consolas,'Courier New',monospace",
};

/**
 * Supabase's `mailer_otp_exp` — 86400s by default and not overridden in
 * config.toml. Every link-bearing template quotes it, so it is stated once.
 * If you shorten the expiry in the dashboard, change this and rebuild.
 */
const LINK_LIFETIME = "24 hours";

/**
 * Where these emails say we live. The Vercel deployment until the real domain
 * is bought — change these two lines, rebuild, push. Nothing else in the
 * templates hardcodes a host.
 *
 * Deliberately NOT `{{ .SiteURL }}`: that variable is only substituted for the
 * auth-action mails, so the seven notification templates would ship it to the
 * inbox as literal text. One constant renders the same in all thirteen.
 */
const SITE_URL = "https://sortedchoice.com";
const SITE_HOST = SITE_URL.replace(/^https?:\/\//, "");

/* ── Layout ────────────────────────────────────────────────────────────── */

const label = (text, colour = c.inkSub) =>
  `<p style="margin:0 0 14px; font-family:${f.label}; font-size:11px; font-weight:600; letter-spacing:0.14em; text-transform:uppercase; color:${colour};" class="pd-ink-sub">${text}</p>`;

/** Bulletproof CTA: VML for Outlook, a padded anchor everywhere else. */
const button = ({ label: text, url }) => `
                  <tr>
                    <td class="pd-pad" align="left" style="padding:28px 40px 0;">
                      <!--[if mso]>
                        <v:roundrect
                          xmlns:v="urn:schemas-microsoft-com:vml"
                          xmlns:w="urn:schemas-microsoft-com:office:word"
                          href="${url}"
                          style="height:52px; v-text-anchor:middle; width:${Math.max(240, text.length * 11 + 68)}px;"
                          arcsize="20%"
                          stroke="f"
                          fillcolor="${c.brandFill}"
                        >
                          <w:anchorlock />
                          <center style="color:#ffffff; font-family:'Segoe UI',Arial,sans-serif; font-size:16px; font-weight:bold;">
                            ${text}
                          </center>
                        </v:roundrect>
                      <![endif]-->
                      <!--[if !mso]><!-- -->
                      <a
                        class="pd-btn"
                        href="${url}"
                        style="display:inline-block; background-color:${c.brandFill}; color:#ffffff; font-family:${f.body}; font-size:16px; font-weight:600; line-height:1; text-decoration:none; padding:18px 34px; border-radius:10px; mso-padding-alt:0;"
                        >${text}</a
                      >
                      <!--<![endif]-->
                    </td>
                  </tr>`;

/** Plain-text URL escape hatch, for clients that strip or rewrite the button. */
const urlFallback = (url) => `
                  <tr>
                    <td class="pd-pad" style="padding:24px 40px 0;">
                      <p
                        class="pd-ink-sub"
                        style="margin:0 0 6px; font-family:${f.body}; font-size:13px; line-height:1.5; color:${c.inkSub};"
                      >
                        Button not working? Paste this into your browser:
                      </p>
                      <p style="margin:0;">
                        <a
                          class="pd-link"
                          href="${url}"
                          style="font-family:${f.mono}; font-size:12px; line-height:1.5; color:${c.brandText}; text-decoration:underline; word-break:break-all;"
                          >${url}</a
                        >
                      </p>
                    </td>
                  </tr>`;

/**
 * One-time code plate. The negative right margin cancels the trailing gap
 * letter-spacing adds after the final digit, so the code stays optically
 * centred rather than sitting one track to the left.
 */
const codePlate = (token) => `
                  <tr>
                    <td class="pd-pad" style="padding:28px 40px 0;">
                      <table
                        role="presentation"
                        width="100%"
                        cellpadding="0"
                        cellspacing="0"
                        border="0"
                        class="pd-plate"
                        style="background-color:${c.plate}; border:1px solid ${c.line}; border-radius:12px;"
                      >
                        <tr>
                          <td align="center" style="padding:24px 16px;">
                            <span
                              class="pd-ink"
                              style="display:inline-block; font-family:${f.mono}; font-size:34px; font-weight:700; letter-spacing:0.26em; margin-right:-0.26em; color:${c.ink};"
                              >${token}</span
                            >
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>`;

const rule = () => `
                  <tr>
                    <td class="pd-pad" style="padding:32px 40px 0;">
                      <div
                        class="pd-rule"
                        style="height:1px; background-color:${c.line}; line-height:1px; font-size:0;"
                      >
                        &nbsp;
                      </div>
                    </td>
                  </tr>`;

const numberedList = ({ title, items }) => `
                  <tr>
                    <td class="pd-pad" style="padding:28px 40px 0;">
                      ${label(title).replace("margin:0 0 14px", "margin:0 0 16px")}

                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${items
  .map(
    (text, i) => `                        <tr>
                          <td width="28" valign="top" style="padding:0 0 ${i === items.length - 1 ? "0" : "12px"};">
                            <span
                              class="pd-ink-sub"
                              style="font-family:${f.mono}; font-size:12px; color:${c.inkSub};"
                              >${String(i + 1).padStart(2, "0")}</span
                            >
                          </td>
                          <td valign="top" style="padding:0 0 ${i === items.length - 1 ? "0" : "12px"};">
                            <span
                              class="pd-ink-muted"
                              style="font-family:${f.body}; font-size:15px; line-height:1.55; color:${c.inkMuted};"
                              >${text}</span
                            >
                          </td>
                        </tr>`,
  )
  .join("\n")}
                      </table>
                    </td>
                  </tr>`;

/**
 * The "if this wasn't you" container. `warn` is for notices about a change
 * that has ALREADY happened — amber says act now in a way brand purple, which
 * this system uses for ordinary product chrome, does not.
 */
const noticeBox = ({ text, tone }) => {
  const warn = tone === "warn";
  return `
                  <tr>
                    <td class="pd-pad" style="padding:28px 40px 40px;">
                      <table
                        role="presentation"
                        width="100%"
                        cellpadding="0"
                        cellspacing="0"
                        border="0"
                        class="${warn ? "pd-warn" : "pd-soft"}"
                        style="background-color:${warn ? c.warnSoft : c.brandSoft}; border:1px solid ${warn ? c.warnSoftLine : c.brandSoftLine}; border-radius:10px;"
                      >
                        <tr>
                          <td style="padding:16px 18px;">
                            <p
                              class="${warn ? "pd-warn-ink" : "pd-soft-ink"}"
                              style="margin:0; font-family:${f.body}; font-size:13px; line-height:1.6; color:${warn ? c.warnOnSoft : c.brandOnSoft};"
                            >
                              ${text}
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>`;
};

function layout({ title, preheader, eyebrow, heading, lede, cta, code, list, notice, kind }) {
  // The footer host is clickable in the auth-action mails, which already carry
  // a link the user is meant to follow, and plain text in the notifications,
  // which carry none on purpose. Keeping "a security notice contains nothing
  // to click" absolutely true is worth more than a consistent footer.
  const siteLine =
    kind === "notification"
      ? `<span class="pd-ink-sub" style="color:${c.inkFaint};"
                    >&copy; SortedChoice &nbsp;&middot;&nbsp; ${SITE_HOST}</span
                  >`
      : `<span class="pd-ink-sub" style="color:${c.inkFaint};">&copy; SortedChoice &nbsp;&middot;&nbsp; </span
                  ><a
                    class="pd-ink-sub"
                    href="${SITE_URL}"
                    style="color:${c.inkFaint}; text-decoration:none;"
                    >${SITE_HOST}</a
                  >`;

  const body = [
    `                  <tr>
                    <td class="pd-pad" style="padding:40px 40px 0;">
                      ${label(eyebrow)}

                      <h1
                        class="pd-ink pd-h1"
                        style="margin:0 0 16px; font-family:${f.display}; font-size:32px; line-height:1.1; font-weight:800; letter-spacing:-0.03em; color:${c.ink};"
                      >
                        ${heading}
                      </h1>

                      <p
                        class="pd-ink-muted"
                        style="margin:0; font-family:${f.body}; font-size:16px; line-height:1.6; color:${c.inkMuted};"
                      >
                        ${lede}
                      </p>
                    </td>
                  </tr>`,
    cta ? button(cta) : "",
    cta ? urlFallback(cta.url) : "",
    code ? codePlate(code) : "",
    list ? rule() : "",
    list ? numberedList(list) : "",
    notice ? noticeBox(notice) : `\n                  <tr><td style="height:40px; font-size:0; line-height:0;">&nbsp;</td></tr>`,
  ]
    .filter(Boolean)
    .join("\n");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta name="color-scheme" content="light dark" />
    <meta name="supported-color-schemes" content="light dark" />
    <title>${title}</title>
    <!-- Generated by templates/build.mjs — edit that, not this file. -->
    <!--[if mso]>
      <style>
        * { font-family: "Segoe UI", Arial, sans-serif !important; }
      </style>
    <![endif]-->
    <style>
      /* Clients that honour a head stylesheet get the dark theme, the hover
         state and the narrow breakpoint. Everything structural is inlined
         below, so a client that strips this block still renders the light
         theme as designed. */
      @media (prefers-color-scheme: dark) {
        .pd-page      { background-color: #0a0a0a !important; }
        .pd-card      { background-color: #141416 !important; border-color: #262629 !important; }
        .pd-ink       { color: #f5f3f2 !important; }
        .pd-ink-muted { color: #a8a5b3 !important; }
        .pd-ink-sub   { color: #7c7986 !important; }
        .pd-rule      { background-color: #262629 !important; }
        .pd-plate     { background-color: #1c1c1f !important; border-color: #2f2f34 !important; }
        .pd-soft      { background-color: #1b1830 !important; border-color: #2e2856 !important; }
        .pd-soft-ink  { color: #c9c2f5 !important; }
        .pd-warn      { background-color: #2a1f0f !important; border-color: #4a3618 !important; }
        .pd-warn-ink  { color: #e8c48a !important; }
        .pd-link      { color: #a89bf3 !important; }
      }
      a.pd-btn:hover { background-color: ${c.brandHover} !important; }
      @media only screen and (max-width: 620px) {
        .pd-pad { padding-left: 24px !important; padding-right: 24px !important; }
        .pd-h1  { font-size: 26px !important; line-height: 1.15 !important; }
        .pd-btn { display: block !important; text-align: center !important; }
      }
    </style>
  </head>

  <body class="pd-page" style="margin:0; padding:0; width:100%; background-color:${c.bg};">
    <!-- Preheader: the grey line clients show beside the subject. Padded with
         zero-width characters so the client can't pull body copy in after it. -->
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">
      ${preheader}
      &#8203;&#847;&#8203;&#847;&#8203;&#847;&#8203;&#847;&#8203;&#847;&#8203;&#847;&#8203;&#847;&#8203;&#847;&#8203;&#847;&#8203;&#847;&#8203;&#847;&#8203;&#847;&#8203;&#847;&#8203;&#847;
    </div>

    <table
      role="presentation"
      class="pd-page"
      width="100%"
      cellpadding="0"
      cellspacing="0"
      border="0"
      style="background-color:${c.bg};"
    >
      <tr>
        <td align="center" style="padding:40px 12px;">
          <table
            role="presentation"
            width="600"
            cellpadding="0"
            cellspacing="0"
            border="0"
            style="width:600px; max-width:600px;"
          >
            <tr>
              <td align="left" style="padding:0 8px 20px;">
                <span
                  class="pd-ink"
                  style="font-family:${f.display}; font-size:22px; font-weight:800; letter-spacing:-0.045em; color:${c.ink};"
                  >SortedChoice</span
                >
              </td>
            </tr>

            <tr>
              <td
                class="pd-card"
                style="background-color:${c.card}; border:1px solid ${c.line}; border-radius:16px;"
              >
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${body}
                </table>
              </td>
            </tr>

            <tr>
              <td class="pd-pad" style="padding:28px 8px 0;">
                <p
                  class="pd-ink-sub"
                  style="margin:0 0 10px; font-family:${f.body}; font-size:12px; line-height:1.7; color:${c.inkSub};"
                >
                  SortedChoice researches products so you can choose with confidence. We do not sell
                  anything &mdash; we hand you off to the retailer once you have decided.
                </p>
                <p
                  style="margin:0; font-family:${f.label}; font-size:11px; letter-spacing:0.1em; text-transform:uppercase; color:${c.inkFaint};"
                >
                  ${siteLine}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
}

/* ── Templates ─────────────────────────────────────────────────────────── */

/**
 * `vars` is the whitelist the checker enforces. Supabase substitutes only the
 * variables that belong to a given mail — anything else ships to the user as
 * literal `{{ .Whatever }}`, which is how a template quietly leaks a bug into
 * an inbox. Reauthentication in particular has NO ConfirmationURL.
 */
const templates = [
  {
    key: "confirmation",
    kind: "auth",
    subjectKey: "mailer_subjects_confirmation",
    contentKey: "mailer_templates_confirmation_content",
    subject: "Confirm your email address",
    vars: ["ConfirmationURL"],
    content: {
      title: "Confirm your email address",
      preheader: "Confirm your email address to finish setting up your SortedChoice account.",
      eyebrow: "Account setup",
      heading: "Confirm your email address",
      lede: `One step left. Confirm this address and your SortedChoice account is ready &mdash; saved
                        shortlists, price alerts, and verdicts you can come back to.`,
      cta: { label: "Confirm email address", url: "{{ .ConfirmationURL }}" },
      list: {
        title: "Once you are in",
        items: [
          "Save products to shortlists and compare them side by side.",
          "Track prices across retailers and hear about it when one moves.",
          "Ask the desk when the research does not settle it for you.",
        ],
      },
      notice: {
        text: `This link works once and expires in ${LINK_LIFETIME}. If you did not sign up for
                              SortedChoice, you can ignore this email &mdash; the account stays
                              unconfirmed and unusable.`,
      },
    },
  },

  {
    key: "recovery",
    kind: "auth",
    subjectKey: "mailer_subjects_recovery",
    contentKey: "mailer_templates_recovery_content",
    subject: "Reset your SortedChoice password",
    vars: ["ConfirmationURL", "Email"],
    content: {
      title: "Reset your password",
      preheader: "Choose a new password for your SortedChoice account.",
      eyebrow: "Password reset",
      heading: "Reset your password",
      lede: `Someone asked to reset the password for the SortedChoice account on
                        <span style="color:${c.ink};">{{ .Email }}</span>. If that was you, pick a new
                        one below.`,
      cta: { label: "Choose a new password", url: "{{ .ConfirmationURL }}" },
      notice: {
        text: `This link works once and expires in ${LINK_LIFETIME}. If you did not ask for a reset,
                              ignore this email &mdash; your current password still works and nothing
                              about your account has changed.`,
      },
    },
  },

  {
    key: "magic_link",
    kind: "auth",
    subjectKey: "mailer_subjects_magic_link",
    contentKey: "mailer_templates_magic_link_content",
    subject: "Your SortedChoice sign-in link",
    vars: ["ConfirmationURL", "Email"],
    content: {
      title: "Your sign-in link",
      preheader: "Your single-use link to sign in to SortedChoice. No password needed.",
      eyebrow: "Sign in",
      heading: "Your sign-in link",
      lede: `Use the link below to sign in to SortedChoice as
                        <span style="color:${c.ink};">{{ .Email }}</span>. No password needed &mdash;
                        the link is the credential, so treat it like one.`,
      cta: { label: "Sign in to SortedChoice", url: "{{ .ConfirmationURL }}" },
      notice: {
        text: `This link works once and expires in ${LINK_LIFETIME}. If you did not ask to sign in,
                              ignore this email and do not forward it &mdash; anyone who opens the link
                              is signed in as you.`,
      },
    },
  },

  {
    key: "email_change",
    kind: "auth",
    subjectKey: "mailer_subjects_email_change",
    contentKey: "mailer_templates_email_change_content",
    subject: "Confirm your new email address",
    vars: ["ConfirmationURL", "Email", "NewEmail"],
    content: {
      title: "Confirm your new email address",
      preheader: "Approve the email address change on your SortedChoice account.",
      eyebrow: "Email change",
      heading: "Confirm your new email address",
      // config.toml sets double_confirm_changes = true, so this mail lands in
      // BOTH the old and the new inbox and the copy has to read correctly to
      // either recipient. Hence "from this address" rather than "your address".
      lede: `A request was made to move this SortedChoice account from
                        <span style="color:${c.ink};">{{ .Email }}</span> to
                        <span style="color:${c.ink};">{{ .NewEmail }}</span>. Both addresses have to
                        approve, so confirm from this one below.`,
      cta: { label: "Confirm this change", url: "{{ .ConfirmationURL }}" },
      notice: {
        text: `This link works once and expires in ${LINK_LIFETIME}. If you did not request the change,
                              do not confirm &mdash; the account keeps its current address until every
                              confirmation is in.`,
      },
    },
  },

  {
    key: "invite",
    kind: "auth",
    subjectKey: "mailer_subjects_invite",
    contentKey: "mailer_templates_invite_content",
    subject: "You have been invited to SortedChoice",
    vars: ["ConfirmationURL"],
    content: {
      title: "You have been invited",
      preheader: "Accept your invitation and set up your SortedChoice account.",
      eyebrow: "Invitation",
      heading: "You have been invited to SortedChoice",
      lede: `Someone at SortedChoice invited this address to an account. Accept below to set a
                        password and get in &mdash; it takes about a minute.`,
      cta: { label: "Accept invitation", url: "{{ .ConfirmationURL }}" },
      notice: {
        text: `This invitation works once and expires in ${LINK_LIFETIME}. If you were not expecting
                              it, you can ignore this email &mdash; no account exists until the
                              invitation is accepted.`,
      },
    },
  },

  {
    key: "reauthentication",
    kind: "auth",
    subjectKey: "mailer_subjects_reauthentication",
    contentKey: "mailer_templates_reauthentication_content",
    // The code in the subject line means it is readable from a notification
    // without opening anything, which is the whole point of a reauth code.
    subject: "{{ .Token }} is your SortedChoice verification code",
    vars: ["Token"],
    content: {
      title: "Your verification code",
      preheader: "Your single-use SortedChoice verification code.",
      eyebrow: "Security check",
      heading: "Your verification code",
      // Deliberately no button and no URL fallback: this flow has no
      // ConfirmationURL, and inventing a link would render as literal text.
      lede: `Enter this code back in SortedChoice to confirm it is you. We ask for it before a
                        change that would be expensive to undo.`,
      code: "{{ .Token }}",
      notice: {
        tone: "warn",
        text: `The code is single use and expires shortly. If you did not trigger it, someone may
                              already have your password &mdash; change it as soon as you can.`,
      },
    },
  },

  /* ── Security notifications ──────────────────────────────────────────
     Sent after the fact, so no call to action: a link in a "something
     changed" email is exactly the shape of the phishing mail that follows a
     real breach. These tell the user what happened and where to go on their
     own. Disabled in config.toml until you decide to turn them on. */

  {
    key: "password_changed",
    kind: "notification",
    subjectKey: "mailer_subjects_password_changed_notification",
    contentKey: "mailer_templates_password_changed_notification_content",
    enabledKey: "mailer_notifications_password_changed_enabled",
    subject: "Your SortedChoice password was changed",
    vars: [],
    content: {
      title: "Your password was changed",
      preheader: "The password on your SortedChoice account was just changed.",
      eyebrow: "Security notice",
      heading: "Your password was changed",
      lede: `The password for your SortedChoice account was changed just now. If that was you,
                        there is nothing to do &mdash; this note is only so a change never happens
                        quietly.`,
      notice: {
        tone: "warn",
        text: `If this was not you, reset your password immediately from the sign-in page and
                              contact us. Do not use a link in an email to do it &mdash; type the address
                              in yourself.`,
      },
    },
  },

  {
    key: "email_changed",
    kind: "notification",
    subjectKey: "mailer_subjects_email_changed_notification",
    contentKey: "mailer_templates_email_changed_notification_content",
    enabledKey: "mailer_notifications_email_changed_enabled",
    subject: "Your SortedChoice email address was changed",
    vars: ["OldEmail", "Email"],
    content: {
      title: "Your email address was changed",
      preheader: "The email address on your SortedChoice account was just changed.",
      eyebrow: "Security notice",
      heading: "Your email address was changed",
      lede: `The email address on your SortedChoice account moved from
                        <span style="color:${c.ink};">{{ .OldEmail }}</span> to
                        <span style="color:${c.ink};">{{ .Email }}</span>.`,
      notice: {
        tone: "warn",
        text: `If this was not you, someone else may have access to the account. Reset your password
                              from the sign-in page and contact us straight away.`,
      },
    },
  },

  {
    key: "phone_changed",
    kind: "notification",
    subjectKey: "mailer_subjects_phone_changed_notification",
    contentKey: "mailer_templates_phone_changed_notification_content",
    enabledKey: "mailer_notifications_phone_changed_enabled",
    subject: "Your SortedChoice phone number was changed",
    vars: ["OldPhone", "Phone"],
    content: {
      title: "Your phone number was changed",
      preheader: "The phone number on your SortedChoice account was just changed.",
      eyebrow: "Security notice",
      heading: "Your phone number was changed",
      lede: `The phone number on your SortedChoice account moved from
                        <span style="color:${c.ink};">{{ .OldPhone }}</span> to
                        <span style="color:${c.ink};">{{ .Phone }}</span>.`,
      notice: {
        tone: "warn",
        text: `If this was not you, reset your password from the sign-in page and contact us &mdash;
                              a changed number can be used to take over the account.`,
      },
    },
  },

  {
    key: "mfa_factor_enrolled",
    kind: "notification",
    subjectKey: "mailer_subjects_mfa_factor_enrolled_notification",
    contentKey: "mailer_templates_mfa_factor_enrolled_notification_content",
    enabledKey: "mailer_notifications_mfa_factor_enrolled_enabled",
    subject: "A new verification method was added to your SortedChoice account",
    vars: ["FactorType"],
    content: {
      title: "A new verification method was added",
      preheader: "A two-factor verification method was added to your SortedChoice account.",
      eyebrow: "Security notice",
      heading: "A new verification method was added",
      lede: `A <span style="color:${c.ink};">{{ .FactorType }}</span> verification method was added
                        to your SortedChoice account. You will be asked for it the next time you sign in.`,
      notice: {
        tone: "warn",
        text: `If you did not add it, remove it from your account settings and change your password
                              &mdash; someone else may be able to sign in.`,
      },
    },
  },

  {
    key: "mfa_factor_unenrolled",
    kind: "notification",
    subjectKey: "mailer_subjects_mfa_factor_unenrolled_notification",
    contentKey: "mailer_templates_mfa_factor_unenrolled_notification_content",
    enabledKey: "mailer_notifications_mfa_factor_unenrolled_enabled",
    subject: "A verification method was removed from your SortedChoice account",
    vars: ["FactorType"],
    content: {
      title: "A verification method was removed",
      preheader: "A two-factor verification method was removed from your SortedChoice account.",
      eyebrow: "Security notice",
      heading: "A verification method was removed",
      lede: `The <span style="color:${c.ink};">{{ .FactorType }}</span> verification method was
                        removed from your SortedChoice account. Your account is now protected by its
                        password alone.`,
      notice: {
        tone: "warn",
        text: `If you did not remove it, change your password now and add the method back from your
                              account settings.`,
      },
    },
  },

  {
    key: "identity_linked",
    kind: "notification",
    subjectKey: "mailer_subjects_identity_linked_notification",
    contentKey: "mailer_templates_identity_linked_notification_content",
    enabledKey: "mailer_notifications_identity_linked_enabled",
    subject: "A sign-in method was linked to your SortedChoice account",
    vars: ["Provider", "Email"],
    content: {
      title: "A sign-in method was linked",
      preheader: "A new sign-in method was linked to your SortedChoice account.",
      eyebrow: "Security notice",
      heading: "A sign-in method was linked",
      lede: `Your <span style="color:${c.ink};">{{ .Provider }}</span> account was linked as a way to
                        sign in to SortedChoice as <span style="color:${c.ink};">{{ .Email }}</span>.`,
      notice: {
        tone: "warn",
        text: `If you did not link it, unlink it from your account settings and change your password
                              &mdash; a linked provider is a second door into the same account.`,
      },
    },
  },

  {
    key: "identity_unlinked",
    kind: "notification",
    subjectKey: "mailer_subjects_identity_unlinked_notification",
    contentKey: "mailer_templates_identity_unlinked_notification_content",
    enabledKey: "mailer_notifications_identity_unlinked_enabled",
    subject: "A sign-in method was removed from your SortedChoice account",
    vars: ["Provider", "Email"],
    content: {
      title: "A sign-in method was removed",
      preheader: "A sign-in method was removed from your SortedChoice account.",
      eyebrow: "Security notice",
      heading: "A sign-in method was removed",
      lede: `Your <span style="color:${c.ink};">{{ .Provider }}</span> account is no longer a way to
                        sign in to SortedChoice as <span style="color:${c.ink};">{{ .Email }}</span>.`,
      notice: {
        tone: "warn",
        text: `If you did not remove it, change your password &mdash; losing a sign-in method you did
                              not remove usually means someone else is in the account.`,
      },
    },
  },

  /* ── Transactional ──────────────────────────────────────────────────────
     Not an auth mail. Supabase never sees this one: our own API sends it,
     from app/core/mail.py, and substitutes the variables itself. It lives
     here anyway because the alternative is a second copy of the brand shell
     in Python that drifts the first time the palette moves.

     `out` routes the generated file into the backend package instead of
     beside the auth templates. render.yaml sets `rootDir: backend`, so a
     runtime read of ../../supabase/templates is a bet on the deploy shipping
     a sibling directory the service does not otherwise need. Generating into
     app/emails/ makes the file part of the thing that gets installed. */
  {
    key: "newsletter_confirmation",
    kind: "transactional",
    out: "../../backend/app/emails/newsletter_confirmation.html",
    subject: "Confirm your SortedChoice newsletter subscription",
    vars: ["ConfirmURL", "Frequency"],
    content: {
      title: "Confirm your newsletter subscription",
      preheader: "One click confirms your SortedChoice newsletter subscription.",
      eyebrow: "Newsletter",
      heading: "Confirm your subscription",
      lede: `Someone &mdash; we hope you &mdash; asked for the SortedChoice newsletter at this address,
                        on the <span style="color:${c.ink};">{{ .Frequency }}</span> cadence. Confirm it
                        below and the next one comes to you.`,
      cta: { label: "Confirm subscription", url: "{{ .ConfirmURL }}" },
      notice: {
        text: `This link works once and expires in ${LINK_LIFETIME}. If you did not ask for this,
                              ignore this email &mdash; nothing further is sent to an address that
                              never confirms, and we do not email you again to ask.`,
      },
    },
  },
  {
    // The second of our own transactional mails. Sent by
    // backend/app/modules/alerts/service.py after an admin applies a price run
    // — never on a schedule, because nothing on this site checks a price on a
    // schedule.
    key: "price_drop",
    kind: "transactional",
    out: "../../backend/app/emails/price_drop.html",
    subject: "A product on your shortlist got cheaper",
    vars: ["ProductName", "NewPrice", "OldPrice", "Saving", "ProductURL", "PreferencesURL"],
    content: {
      title: "A product on your shortlist got cheaper",
      preheader: "{{ .ProductName }} is now {{ .NewPrice }} — {{ .Saving }} less than when you saved it.",
      eyebrow: "Price drop",
      heading: "{{ .ProductName }} is now {{ .NewPrice }}",
      lede: `That is <span style="color:${c.ink};">{{ .Saving }}</span> below the
                        <span style="color:${c.ink};">{{ .OldPrice }}</span> it was at when you saved it.
                        Our verdict has not changed &mdash; only the price has.`,
      cta: { label: "Read the verdict", url: "{{ .ProductURL }}" },
      notice: {
        // The paragraph that separates this from every other price-alert email
        // a reader gets. We are not tracking continuously and should not imply
        // it, and a price we observed can move again ten minutes later.
        text: `We check prices by hand rather than on a timer, so this is a figure a person
                              actually looked at &mdash; and one that can go back up. Always confirm at the
                              retailer before you buy.
                              <br /><br />
                              <a href="{{ .PreferencesURL }}" style="color:${c.brand}; text-decoration:underline;">Turn these emails off</a>`,
      },
    },
  },
  {
    // The digest. Composed in /admin/newsletter and sent by
    // backend/app/modules/admin/newsletter.py — again, by a person pressing a
    // button, not by a schedule.
    //
    // `Picks` is the one placeholder in the whole system that is substituted
    // WITHOUT escaping: it is a repeated block, one row per product, which no
    // fixed set of placeholders can express. The Python side builds it and
    // escapes every field it interpolates. See the `raw` argument on
    // backend/app/emails/render for why that is a separate, awkward door.
    key: "newsletter_digest",
    kind: "transactional",
    out: "../../backend/app/emails/newsletter_digest.html",
    subject: "The latest from SortedChoice",
    vars: ["Subject", "Intro", "Picks", "UnsubscribeURL"],
    content: {
      title: "{{ .Subject }}",
      preheader: "{{ .Intro }}",
      eyebrow: "SortedChoice",
      heading: "{{ .Subject }}",
      // Intro, then the picks, in one block.
      //
      // The picks are INLINE markup — anchors and spans and breaks, no table,
      // no image. Partly because the lede sits inside a <p> and block elements
      // there are invalid; mostly because it is the right form anyway. Mail
      // clients block remote images by default, so a card layout arrives as a
      // column of grey boxes, and the site's own grammar for "here are things
      // worth comparing" is already type rather than thumbnails.
      lede: `{{ .Intro }}<br /><br />{{ .Picks }}`,
      notice: {
        text: `You are getting this because you asked for it at this address, and confirmed it.
                              Every product above links to our full verdict &mdash; we research, you decide
                              where to buy.
                              <br /><br />
                              <a href="{{ .UnsubscribeURL }}" style="color:${c.brand}; text-decoration:underline;">Unsubscribe</a>`,
      },
    },
  },
];

/* ── Verify ────────────────────────────────────────────────────────────── */

/** Gmail clips a message past ~102KB and hides everything after the cut. */
const GMAIL_CLIP_BYTES = 102 * 1024;

function verify(t, html) {
  const problems = [];

  const used = new Set([...html.matchAll(/\{\{\s*\.([A-Za-z]+)/g)].map((m) => m[1]));
  const allowed = new Set(t.vars);
  for (const v of used) {
    if (!allowed.has(v)) problems.push(`uses {{ .${v} }}, which this template does not receive`);
  }
  for (const v of allowed) {
    if (!used.has(v)) problems.push(`declares ${v} in vars but never renders it`);
  }

  if (/supabase/i.test(html)) problems.push("mentions Supabase");

  // Rough balance check. Comments (which is where the MSO conditionals and
  // their VML live) and stylesheet bodies are scrubbed first — CSS is not
  // markup, and prose inside a CSS comment must not read as a tag. This is
  // here to catch a dropped </td> in the layout, not to be a parser.
  const stack = [];
  const scrubbed = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
  for (const m of scrubbed.matchAll(/<(\/?)([a-z][a-z0-9]*)\b[^>]*?(\/?)>/gi)) {
    const [, closing, tag, selfClose] = m;
    if (["meta", "br", "img", "link", "hr", "input"].includes(tag.toLowerCase())) continue;
    if (selfClose) continue;
    if (closing) {
      if (stack.pop() !== tag.toLowerCase()) problems.push(`unbalanced </${tag}>`);
    } else {
      stack.push(tag.toLowerCase());
    }
  }
  if (stack.length) problems.push(`unclosed: ${stack.join(", ")}`);

  const bytes = Buffer.byteLength(html, "utf8");
  if (bytes > GMAIL_CLIP_BYTES) problems.push(`${bytes}B exceeds Gmail's clipping threshold`);

  // A link-bearing mail with no anchor is a dead end for the user.
  if (t.content.cta && !html.includes(`href="${t.content.cta.url}"`)) {
    problems.push("call to action lost its href");
  }

  // Security notifications must stay unclickable — see the note on siteLine.
  if (t.kind === "notification" && /<a[\s/>]/i.test(html)) {
    problems.push("notification contains a link; these must have nothing to click");
  }

  return { problems, bytes };
}

/* ── Run ───────────────────────────────────────────────────────────────── */

// In payload mode stdout is the JSON body and nothing else, so every log line
// goes to stderr. A stray console.log here is a corrupted PATCH.
const log = (line) => process.stderr.write(`${line}\n`);

const built = templates.map((t) => {
  const html = layout({ ...t.content, kind: t.kind });
  return { t, html, ...verify(t, html) };
});

const broken = built.filter((b) => b.problems.length);
if (broken.length) {
  for (const b of broken) {
    log(`FAIL ${b.t.key}`);
    for (const p of b.problems) log(`     - ${p}`);
  }
  log("\nbuild failed — nothing was written or pushed");
  process.exit(1);
}

// The manifest describes what the push script sends to Supabase, so a
// template we deliver ourselves must not appear in it — a key of `undefined`
// in the PATCH body is a silent no-op at best.
const manifest = built
  .filter(({ t }) => t.contentKey)
  .map(({ t }) => ({
    key: t.key,
    kind: t.kind,
    file: `${t.key}.html`,
    subject: t.subject,
    subjectKey: t.subjectKey,
    contentKey: t.contentKey,
    ...(t.enabledKey ? { enabledKey: t.enabledKey } : {}),
  }));
const manifestPath = join(HERE, "manifest.json");
const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;

/* --payload: emit the Management API body. Built from memory, never from the
   .html files on disk, so a forgotten rebuild cannot ship a stale email. */
if (PAYLOAD) {
  const body = {};
  for (const { t, html } of built) {
    if (!t.contentKey) continue;  // ours to send, not Supabase's
    body[t.subjectKey] = t.subject;
    body[t.contentKey] = html;
    // Enablement is opt-in: pushing a template must never, on its own, start
    // sending a class of mail that was previously off.
    if (t.enabledKey && ENABLE_NOTIFICATIONS) body[t.enabledKey] = true;
  }
  process.stdout.write(JSON.stringify(body));
  log(
    `payload: ${Object.keys(body).length} keys, ${Buffer.byteLength(JSON.stringify(body))}B` +
      `${ENABLE_NOTIFICATIONS ? ", notifications ENABLED" : ", notification enablement untouched"}`,
  );
  process.exit(0);
}

/* --preview <file>: a contact sheet of all thirteen with sample data filled
   in, because the only way to know an email is right is to look at it. The
   dark theme follows the OS setting — the templates key off
   prefers-color-scheme, which an iframe inherits and a page cannot fake. */
if (PREVIEW) {
  const samples = {
    ConfirmationURL:
      "https://sortedchoice.com/auth/callback?code=6f2a1c9e-4b81-9d3e-a7f2-preview&next=%2Faccount%2Fsettings",
    Email: "jayesh@example.com",
    NewEmail: "jayesh.new@example.com",
    OldEmail: "jayesh.old@example.com",
    Token: "418205",
    Phone: "+91 98765 43210",
    OldPhone: "+91 91234 56780",
    Provider: "Google",
    FactorType: "TOTP",
    ConfirmURL:
      "https://sortedchoice.com/newsletter/confirm?token=preview-3f9a2c7e14b8d05a6c3f8e21",
    Frequency: "weekly",
  };
  const fill = (s) =>
    s.replace(/\{\{\s*\.([A-Za-z]+)\s*\}\}/g, (m, v) => samples[v] ?? m);
  const attr = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

  const cards = built
    .map(
      ({ t, html, bytes }) => `
    <section class="card">
      <header>
        <span class="key">${t.key}</span>
        <span class="kind ${t.kind}">${t.kind}</span>
        <span class="size">${(bytes / 1024).toFixed(1)} KB</span>
      </header>
      <p class="subject"><span>Subject</span> ${fill(t.subject)}</p>
      <iframe title="${t.key}" loading="lazy" srcdoc="${attr(fill(html))}"></iframe>
    </section>`,
    )
    .join("");

  const sheet = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>SortedChoice auth emails</title>
<style>
  :root { color-scheme: light dark; --bg:#f4f1ed; --fg:#16161a; --mut:#65626f; --line:#e0dad3; --card:#fff; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#0a0a0a; --fg:#f5f3f2; --mut:#a8a5b3; --line:#262629; --card:#141416; }
  }
  * { box-sizing: border-box; }
  body { margin:0; padding:32px; background:var(--bg); color:var(--fg);
         font:15px/1.5 'Inter',system-ui,-apple-system,sans-serif; }
  h1 { font-size:26px; letter-spacing:-0.03em; margin:0 0 4px; }
  .lede { color:var(--mut); margin:0 0 28px; font-size:14px; max-width:70ch; }
  .grid { display:grid; gap:24px; grid-template-columns:repeat(auto-fill,minmax(520px,1fr)); }
  @media (max-width:1100px) { .grid { grid-template-columns:1fr; } }
  .card { border:1px solid var(--line); border-radius:14px; overflow:hidden; background:var(--card); }
  header { display:flex; align-items:center; gap:10px; padding:12px 16px; border-bottom:1px solid var(--line); }
  .key { font-family:ui-monospace,Consolas,monospace; font-size:13px; font-weight:600; }
  .kind { font-size:10px; letter-spacing:.1em; text-transform:uppercase; padding:3px 8px; border-radius:999px;
          background:#e7e4f6; color:#3a2ba8; }
  .kind.notification { background:#f1e5d2; color:#7c4306; }
  .kind.transactional { background:#d8ede2; color:#1f5c42; }
  .size { margin-left:auto; font-family:ui-monospace,monospace; font-size:11px; color:var(--mut); }
  .subject { margin:0; padding:10px 16px; border-bottom:1px solid var(--line); font-size:13px; }
  .subject span { font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:var(--mut); margin-right:8px; }
  iframe { display:block; width:100%; height:760px; border:0; background:#fff; }
  @media (prefers-color-scheme: dark) { iframe { background:#0a0a0a; } }
</style></head>
<body>
  <h1>SortedChoice auth emails</h1>
  <p class="lede">All ${built.length} templates with sample values substituted. Light or dark follows
     your OS setting, the same way a mail client decides. Generated by
     <code>build.mjs --preview</code>; not a deployable artefact.</p>
  <div class="grid">${cards}
  </div>
  <script>
    // Fit each frame to its email so nothing is judged through a scrollport.
    for (const f of document.querySelectorAll("iframe")) {
      f.addEventListener("load", () => {
        try { f.style.height = f.contentDocument.body.scrollHeight + 24 + "px"; } catch {}
      });
    }
  </script>
</body></html>
`;
  writeFileSync(PREVIEW, sheet, "utf8");
  log(`preview: ${PREVIEW} (${(Buffer.byteLength(sheet) / 1024).toFixed(0)} KB, ${built.length} templates)`);
  process.exit(0);
}

let drifted = false;
for (const { t, html, bytes } of built) {
  // `out` lets a template land outside this directory — see the transactional
  // block in the template list for why the newsletter mail is generated into
  // the backend package rather than here.
  const file = t.out ? join(HERE, t.out) : join(HERE, `${t.key}.html`);
  const stale = !existsSync(file) || readFileSync(file, "utf8") !== html;
  if (CHECK_ONLY) {
    if (stale) {
      drifted = true;
      log(`DRIFT ${t.key}.html differs from build output`);
    } else {
      log(`ok    ${t.key.padEnd(22)} ${String(bytes).padStart(6)}B`);
    }
  } else {
    if (stale) {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, html, "utf8");
    }
    log(`${stale ? "write" : "same "} ${t.key.padEnd(22)} ${String(bytes).padStart(6)}B`);
  }
}

if (CHECK_ONLY) {
  if (!existsSync(manifestPath) || readFileSync(manifestPath, "utf8") !== manifestJson) {
    drifted = true;
    log("DRIFT manifest.json differs from build output");
  }
} else {
  writeFileSync(manifestPath, manifestJson, "utf8");
}

if (drifted) {
  log("\nrun `node supabase/templates/build.mjs` and commit the result");
  process.exit(1);
}
log(`\n${templates.length} templates ${CHECK_ONLY ? "verified" : "built"}`);
