import { isValidElement, type ReactNode } from "react";

import { jsonLd } from "@/lib/json-ld";
import { absoluteUrl } from "@/lib/site";

/**
 * `FAQPage` structured data for a page that is genuinely a list of questions
 * and answers.
 *
 * ---------------------------------------------------------------------------
 * ⚠ THIS IS NOT A RICH-RESULT PLAY. DO NOT ADD IT EXPECTING ONE.
 *
 * Google withdrew FAQ rich results in August 2023 for everyone except
 * government and health sites. Marking up a page like this one will not put an
 * accordion under our blue link, and anybody who adds `FAQPage` to a new page
 * on the theory that it will is going to be disappointed and then delete it.
 *
 * It is here for the other consumers, which did not withdraw anything:
 *
 *   - Answer engines. ChatGPT Search, Perplexity, Copilot and Gemini all read
 *     schema.org to decide what a page asserts. A `Question`/`acceptedAnswer`
 *     pair is the single most machine-legible shape on the web for "this page
 *     answers exactly this" — it hands over the question boundary, the answer
 *     boundary, and the claim that we consider the answer authoritative, none
 *     of which a model has to infer from `<h3>` nesting.
 *
 *   - Our own entity graph. Several of these answers are the load-bearing
 *     trust claims of the whole site — that we do not sell anything, that a
 *     verdict cannot be bought, that our score and the community stars are
 *     never merged. Those are the facts we want quoted back when somebody asks
 *     an assistant whether SortedChoice is independent, and prose in a <div>
 *     is a weaker way to say them than a typed assertion.
 *
 * The payoff is a citation in a generated answer rather than a click from a
 * SERP feature, which is the traffic shape this site should be optimising for
 * anyway.
 *
 * ---------------------------------------------------------------------------
 * WHY THE ANSWERS ARE DERIVED FROM THE RENDERED JSX
 *
 * The obvious implementation is a second array of plain-text answers beside
 * the JSX ones. That is also how structured data goes stale: the two copies
 * are edited months apart, and the version Google reads quietly stops being
 * the version on the page. Google calls that out explicitly — markup that
 * disagrees with visible content is a manual-action category, not a warning.
 *
 * So there is one source. `plainText` walks the same nodes the page renders
 * and flattens them, which makes divergence structurally impossible: an editor
 * changing an answer changes the markup in the same keystroke.
 */

/**
 * Flatten a React tree to its text content.
 *
 * Handles what the answer bodies on this site actually contain: strings,
 * fragments, arrays, and inline links whose children are text. Anything else —
 * an image, a component that renders from props rather than children —
 * contributes nothing rather than throwing, which is the right failure mode
 * for a metadata block: a slightly short answer string is recoverable, a
 * crashed page is not.
 */
function plainText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(plainText).join("");
  if (isValidElement(node)) {
    return plainText((node.props as { children?: ReactNode }).children);
  }
  return "";
}

export type FaqItem = {
  question: string;
  /** The same node the page renders. Never a second copy — see the note above. */
  answer: ReactNode;
};

export function FaqJsonLd({
  items,
  /**
   * Site-relative path of the page carrying this FAQ. Used to build the `@id`,
   * so a crawler can tell this FAQPage apart from any other on the site rather
   * than treating two anonymous FAQPage nodes as competing descriptions of one
   * thing.
   */
  path,
}: {
  items: FaqItem[];
  path: string;
}) {
  const entities = items
    .map((item) => ({ question: item.question, text: plainText(item.answer).replace(/\s+/g, " ").trim() }))
    // An empty answer is a positive claim that we answer the question with
    // nothing. Drop it rather than emitting it — see the ItemList component
    // for the same reasoning about empty structured data.
    .filter((entity) => entity.text.length > 0);

  if (entities.length === 0) return null;

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: jsonLd({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "@id": `${absoluteUrl(path)}#faq`,
          // Ties these answers back to the publisher declared on the homepage,
          // so "who says so" resolves to the same Organization node that the
          // editorial policy and every product Review point at.
          publisher: { "@id": absoluteUrl("/#organization") },
          mainEntity: entities.map((entity) => ({
            "@type": "Question",
            name: entity.question,
            acceptedAnswer: { "@type": "Answer", text: entity.text },
          })),
        }),
      }}
    />
  );
}
