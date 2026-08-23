/**
 * `?error=` codes on the two login pages, turned into something a person can
 * act on.
 *
 * Three places already redirected to a login page carrying a reason, and no
 * login page read it:
 *
 *   /auth/callback  ->  ?error=invalid_link | missing_code
 *   proxy.ts        ->  ?error=unconfigured
 *   the idle timer  ->  ?error=timeout
 *
 * So an expired confirmation link, a misconfigured deploy and an automatic
 * sign-out all landed on an ordinary, blank sign-in form. The person is left
 * to guess whether something broke, whether they did something wrong, or
 * whether they were simply never signed in — and the most likely reading,
 * "this site is broken", is the one that makes them leave.
 *
 * Every message here is written to be shown to anyone, because anyone can put
 * any value in the query string. None of them confirms that an account exists,
 * names a provider that rejected a sign-in, or repeats an upstream error
 * verbatim — the callback route deliberately collapses provider failures into
 * `invalid_link` for exactly that reason, and undoing that work here would be
 * a strange way to spend it.
 *
 * An unrecognised code returns null rather than echoing itself: `?error=` is
 * attacker-supplied, and reflecting it renders whatever they wrote inside our
 * own alert styling.
 */
/**
 * Tone matters as much as the words.
 *
 * "You were signed out after a period of inactivity" is the security control
 * working exactly as designed — rendering it in the same red alert box as
 * "those credentials were not accepted" tells the person something went wrong
 * when nothing did. Informational notices get neutral styling; only genuine
 * failures get the danger treatment.
 */
export type AuthNoticeTone = "info" | "error";

export interface AuthNotice {
  tone: AuthNoticeTone;
  message: string;
}

const MESSAGES: Record<string, AuthNotice> = {
  // The one-time code was already spent (a refresh, a link-prefetching mail
  // client) or it expired. Both are recoverable by asking for a new one.
  invalid_link: {
    tone: "error",
    message:
      "That link has expired or was already used. Sign in below, or request a new link.",
  },
  missing_code: {
    tone: "error",
    message: "That sign-in link was incomplete. Please try again.",
  },

  // Signed out by the inactivity timer rather than by a click. Saying so is
  // the difference between "the site logged me out for no reason" and a
  // sign-out the person understands and expects. Informational: this is the
  // system doing its job.
  timeout: {
    tone: "info",
    message: "You were signed out automatically after a period of inactivity.",
  },

  // The absolute session cap, not idleness. Also routine.
  session_expired: {
    tone: "info",
    message: "Your session has expired. Please sign in again.",
  },

  // Deployment problem, not a user problem. Says so without describing which
  // environment variable is missing.
  unconfigured: {
    tone: "error",
    message:
      "Sign-in is temporarily unavailable. This is a problem on our side — please try again shortly.",
  },
};

export function authErrorMessage(code: string | null | undefined): AuthNotice | null {
  if (!code) return null;
  return MESSAGES[code] ?? null;
}

/** Wrap a message raised by a form submit. Those are always failures. */
export function asError(message: string | null): AuthNotice | null {
  return message ? { tone: "error", message } : null;
}
