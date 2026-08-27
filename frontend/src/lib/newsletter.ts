/**
 * Newsletter vocabulary, in a plain module.
 *
 * Not exported from the `"use client"` filter control that uses it, and that
 * is a correctness requirement rather than filing preference: a plain array
 * exported from a client module reaches a Server Component as a client
 * reference proxy, and `.map` on it throws at build time. `lib/contact-topics`
 * carries the same note for the same reason.
 *
 * The values are the send job's filter keys and the three the CHECK constraint
 * on `newsletter_subscribers.frequency` allows. The labels are the words the
 * signup form offers, so an admin reading the list sees what the subscriber
 * chose from rather than a column value — "deals_only" reads like a leak.
 */
export const NEWSLETTER_FREQUENCIES: readonly { value: string; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "deals_only", label: "Deals only" },
];

export const NEWSLETTER_FREQUENCY_LABEL: Record<string, string> = Object.fromEntries(
  NEWSLETTER_FREQUENCIES.map((f) => [f.value, f.label]),
);

/**
 * The four tabs, and what each one actually means.
 *
 * `pending` is the one worth a sentence: it is not a failure state. While the
 * transport is off it is where every new signup lands and stays, because a
 * confirmation cannot be clicked if it was never sent. It becomes a queue of
 * people to ask the moment mail is switched on.
 */
export const SUBSCRIBER_STATES = [
  { value: "all", label: "All" },
  { value: "pending", label: "Unconfirmed" },
  { value: "confirmed", label: "Confirmed" },
  { value: "unsubscribed", label: "Unsubscribed" },
] as const;
