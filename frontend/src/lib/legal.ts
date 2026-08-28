/**
 * Legal identity, and the wording other people's rules oblige us to use.
 *
 * ---------------------------------------------------------------------------
 * WHY A MODULE AND NOT JUST PROSE ON THE PAGES
 *
 * Almost everything in this file is a string that is only correct if it is
 * IDENTICAL everywhere it appears. An affiliate disclosure that says one thing
 * in the footer and a slightly different thing on /affiliate-disclosure is not
 * two disclosures — it is one disclosure and one contradiction, and the
 * contradiction is what a complaint quotes.
 *
 * Three of these strings are not ours to edit:
 *
 *   AMAZON_ASSOCIATES_DISCLOSURE  Prescribed verbatim by the Amazon Associates
 *                                 Operating Agreement. Paraphrasing it is a
 *                                 breach of the agreement, and the penalty for
 *                                 breaching it is account closure with unpaid
 *                                 fees forfeited. Do not "improve" this line.
 *   AMAZON_TRADEMARK_NOTICE       Required alongside it.
 *   FLIPKART_TRADEMARK_NOTICE     Same courtesy, not contractually prescribed.
 *
 * The rest exist because Indian law requires a NAMED, REACHABLE human on the
 * site rather than a contact form — see /grievance for which rules and what
 * they oblige us to do once someone writes in.
 */

/**
 * The operator of the site, as a legal person.
 *
 * SortedChoice is not a registered company. It is one individual publishing
 * under a trading name, and saying so plainly is both the truth and the safer
 * position: implying a corporate entity that does not exist is a
 * misrepresentation in its own right, and it is the first thing a regulator
 * checks when it wants to know who to write to.
 */
export const OPERATOR_NAME = "Jayesh Gavit";

/** How the operator is described where a legal document needs a legal person. */
export const OPERATOR_DESCRIPTION = `${OPERATOR_NAME}, an individual operating as a sole proprietor in India, trading as SortedChoice`;

export const OPERATOR_COUNTRY = "India";

/**
 * The published contact address of record.
 *
 * ⚠ This is a REAL, MONITORED inbox and it is published deliberately. Four
 * separate obligations converge on it and none of them are satisfied by a
 * contact form alone:
 *
 *   - IT Rules 2021 r.3(2)  — the Grievance Officer must be contactable
 *   - DPDP Act 2023 s.13    — data principals need a route to exercise rights
 *   - The Amazon Associates agreement expects a reachable operator
 *   - A rights holder sending a takedown notice must be able to send it
 *
 * If this ever changes, change it here — every page that shows an address
 * reads this constant, so there is exactly one edit and no page left behind
 * quoting a dead mailbox.
 */
export const LEGAL_EMAIL = "gavitjayesh08@gmail.com";

/** `mailto:` for the address above, optionally pre-filling a subject line. */
export function legalMailto(subject?: string): string {
  return subject
    ? `mailto:${LEGAL_EMAIL}?subject=${encodeURIComponent(subject)}`
    : `mailto:${LEGAL_EMAIL}`;
}

/**
 * The Grievance Officer under the IT Rules 2021.
 *
 * On a one-person site this is the same person as the operator, and pretending
 * otherwise — inventing a compliance department — would be worse than the
 * candour. The rules require a name and a contact, not a department.
 */
export const GRIEVANCE_OFFICER = {
  name: OPERATOR_NAME,
  role: "Grievance Officer",
  email: LEGAL_EMAIL,
} as const;

/** Acknowledge within this, per IT Rules 2021 r.3(2)(i). */
export const GRIEVANCE_ACKNOWLEDGE_HOURS = 24;

/** Dispose of within this, per the same rule. */
export const GRIEVANCE_RESOLVE_DAYS = 15;

/**
 * Prescribed verbatim by the Amazon Associates Operating Agreement.
 *
 * ⚠ DO NOT EDIT THIS STRING. Not the pronoun, not the punctuation. The
 * agreement specifies the sentence; a rewrite that reads better is still a
 * rewrite, and compliance here is a string comparison, not a sentiment.
 *
 * First person singular is also simply accurate — see OPERATOR_NAME.
 */
export const AMAZON_ASSOCIATES_DISCLOSURE =
  "As an Amazon Associate I earn from qualifying purchases.";

export const AMAZON_TRADEMARK_NOTICE =
  "Amazon, Amazon.in and the Amazon logo are trademarks of Amazon.com, Inc. or its affiliates.";

export const FLIPKART_TRADEMARK_NOTICE =
  "Flipkart and the Flipkart logo are trademarks of Flipkart Internet Private Limited.";
