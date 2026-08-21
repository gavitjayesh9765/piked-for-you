/**
 * Tell the server an admin session just reached aal2.
 *
 * Called from the three places a session can become fully authenticated: the
 * login form's code step, the standalone MFA challenge, and first-time
 * enrolment. All three end in the same state, and the audit log should not
 * care which door was used.
 *
 * **Never throws, never blocks.** A failure to write an arrival note must not
 * be the thing that stops someone signing in — so this swallows everything and
 * the callers do not await a result they would ignore anyway. The record is
 * useful, not load-bearing.
 */
export function recordAdminSignIn(): void {
  void fetch("/admin/api/sign-in-event", {
    method: "POST",
    // Same-origin is the default, but the guard on the other end tests
    // `Sec-Fetch-Site`, and being explicit documents that this is deliberate.
    credentials: "same-origin",
    cache: "no-store",
  }).catch(() => {
    // Deliberately silent. There is no user-facing consequence, and an error
    // toast here would be alarming noise on an otherwise successful sign-in.
  });
}
