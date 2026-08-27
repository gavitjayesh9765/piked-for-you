import type { Metadata } from "next";
import { Fragment } from "react";

import { DocumentPage, DocLink } from "@/components/layout/DocumentPage";
import { FaqJsonLd, type FaqItem } from "@/components/seo/FaqJsonLd";

export const metadata: Metadata = {
  title: "Help centre",
  description:
    "How SortedChoice works, what the scores mean, and what to do when something looks wrong.",
  alternates: { canonical: "/help" },
};

const UPDATED = "2026-08-20";
const PATH = "/help";

/**
 * The help centre, as data rather than as prose.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS AN ARRAY NOW AND USED TO BE JSX
 *
 * Every section of this page was already an `<h3>` question followed by a `<p>`
 * answer — the shape was there, it just was not addressable. Nothing could
 * enumerate the questions, so nothing could tell an answer engine that this
 * page answers seventeen specific things.
 *
 * Splitting them into `{ question, answer }` pairs changes no rendered output —
 * the loop below emits the identical `<h3>` / `<p>` sequence — but it makes the
 * same objects available to `<FaqJsonLd>`, which derives its `Answer` text from
 * these exact nodes. One source, so the structured data cannot drift from the
 * page. See the long note in components/seo/FaqJsonLd.tsx for why FAQPage
 * markup is worth having in 2026 even though Google stopped rendering FAQ rich
 * results in 2023.
 *
 * WARNING: the `question` strings are JavaScript strings now, not JSX text, so
 * HTML entities do not resolve in them. Type the real character — a curly
 * apostrophe, not `&rsquo;` — or the entity ships literally into the
 * structured data and an assistant quotes us saying "someone else&rsquo;s".
 */
type HelpGroup = { id: string; title: string; questions: FaqItem[] };

const GROUPS: HelpGroup[] = [
  {
    id: "buying",
    title: "Buying and prices",
    questions: [
      {
        question: "Can I buy from you?",
        answer: (
          <>
            No, and that is deliberate. We do not sell products, take payment, or hold stock. We
            publish a verdict, and you buy wherever you like — which is what keeps us free to say
            a product is not worth it.
          </>
        ),
      },
      {
        question: "The price here does not match the retailer.",
        answer: (
          <>
            Prices are captured when we check them and move constantly. The retailer’s own page is
            always the authoritative one — check it before you buy. If a price here is wildly out
            of date, <DocLink href="/contact">tell us</DocLink> and we will refresh it.
          </>
        ),
      },
      {
        question: "Do you make money if I buy?",
        answer: (
          <>
            Sometimes, through affiliate commission, at no extra cost to you. It never influences a
            verdict, and the rules that guarantee that are written down in the{" "}
            <DocLink href="/affiliate-disclosure">affiliate disclosure</DocLink>.
          </>
        ),
      },
      {
        question: "Something went wrong with my order.",
        answer: (
          <>
            We cannot help with that one, and we would be lying if we said otherwise — payment,
            delivery, warranty, and returns are entirely between you and the retailer. Contact them
            directly; your statutory rights are against them, not us.
          </>
        ),
      },
    ],
  },
  {
    id: "scores",
    title: "Scores and verdicts",
    questions: [
      {
        question: "What is a PickD Score?",
        answer: (
          <>
            Our verdict as one number out of ten, built from a rubric fixed per category before
            testing begins. Every score breaks down into the criteria behind it, and carries the
            date it was last reviewed. There is a live worked example in{" "}
            <DocLink href="/how-we-research">How we research</DocLink>.
          </>
        ),
      },
      {
        question: "Why is an 8.6 ranked above a 9.4?",
        answer: (
          <>
            Because the <DocLink href="/top-picks">Top Picks board</DocLink> is ordered by our
            editors, not sorted automatically. The score is the measured half; position is an
            editorial judgement about what most people should buy right now. We show both so you
            can disagree with either.
          </>
        ),
      },
      {
        question: "Why can I not compare scores across categories?",
        answer: (
          <>
            Because the rubric changes. Headphones are judged on noise cancellation, a laptop on
            thermals and battery. A 9.0 headphone and a 9.0 laptop are each excellent against their
            own category — the numbers are not a shared currency.
          </>
        ),
      },
      {
        question: "Your score and the star rating disagree.",
        answer: (
          <>
            Good — that is the point of showing both. Ours is measured, the stars are reported by
            owners, and we never average them into one figure. A disagreement usually means
            something measures well but is annoying to live with, which is worth knowing.
          </>
        ),
      },
    ],
  },
  {
    id: "account",
    title: "Your account",
    questions: [
      {
        question: "Do I need an account?",
        answer: (
          <>
            No. Every verdict is readable without one. An account only adds saved products and
            preferences.
          </>
        ),
      },
      {
        question: "I forgot my password.",
        answer: (
          <>
            <DocLink href="/forgot-password">Request a reset link</DocLink>. It goes to the address
            you signed up with and expires in an hour.
          </>
        ),
      },
      {
        question: "How do I get my data, or delete my account?",
        answer: (
          <>
            From <DocLink href="/account/settings">your settings</DocLink>. We respond within 30
            days, and asking never degrades the site for you.
          </>
        ),
      },
    ],
  },
  {
    id: "reviews",
    title: "Reviews you write",
    questions: [
      {
        question: "Who can leave a review?",
        answer: (
          <>
            Anyone with an account who has actually used the product. Reviews are moderated for
            authenticity, never for whether they agree with us — a review that contradicts our
            verdict is not a problem, it is data.
          </>
        ),
      },
      {
        question: "My review was removed.",
        answer: (
          <>
            It will have hit one of the grounds in the{" "}
            <DocLink href="/editorial-policy">editorial policy</DocLink> — an undisclosed
            commercial interest, coordinated rating manipulation, abuse, or personal information.
            If you think that was wrong, <DocLink href="/contact">appeal it</DocLink> and a person
            will look again.
          </>
        ),
      },
      {
        question: "I want to report someone else’s review.",
        answer: (
          <>
            Use the report control on the review itself, or read{" "}
            <DocLink href="/help/report">how reporting works</DocLink> first.
          </>
        ),
      },
    ],
  },
  {
    id: "coverage",
    title: "Coverage",
    questions: [
      {
        question: "Why is this category empty?",
        answer: (
          <>
            Because the research is not finished. We publish a verdict when it is ready and not
            before, so the <DocLink href="/c">index</DocLink> shows the gaps honestly rather than
            padding them with filler.
          </>
        ),
      },
      {
        question: "Will you cover X?",
        answer: (
          <>
            Possibly — <DocLink href="/contact">ask</DocLink>. Requests genuinely change what we
            work on next, and they are the main signal we have.
          </>
        ),
      },
      {
        question: "Can my brand get listed or reviewed?",
        answer: (
          <>
            You can send us a product, and we may or may not write about it. What you cannot do is
            buy a place, a score, or a position. There is no rate card because nothing here is for
            sale.
          </>
        ),
      },
    ],
  },
];

export default function HelpPage() {
  return (
    <>
      <DocumentPage
        eyebrow="Support"
        title="Help centre"
        lede="The questions we actually get asked, answered without a ticket."
        updated={UPDATED}
        path={PATH}
        sections={GROUPS.map((group) => ({
          id: group.id,
          title: group.title,
          body: (
            <>
              {/* Fragment, not a wrapping <div>. `.doc-prose` styles its DIRECT
                  children — `> * + *` is what puts air between a question and
                  its answer — so boxing each pair would leave every answer
                  butted against its own heading. The fragment keeps the DOM
                  byte-identical to the hand-written version this replaced. */}
              {group.questions.map((item) => (
                <Fragment key={item.question}>
                  <h3>{item.question}</h3>
                  <p>{item.answer}</p>
                </Fragment>
              ))}
            </>
          ),
        }))}
        footnote={
          <p>
            Not covered here? <DocLink href="/contact">Contact us</DocLink> — a person reads every
            message.
          </p>
        }
      />
      <FaqJsonLd path={PATH} items={GROUPS.flatMap((group) => group.questions)} />
    </>
  );
}
