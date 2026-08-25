import type { Metadata } from "next";
import { DocumentPage, DocLink } from "@/components/layout/DocumentPage";

export const metadata: Metadata = {
  title: "Help centre",
  description:
    "How SortedChoice works, what the scores mean, and what to do when something looks wrong.",
  alternates: { canonical: "/help" },
};

const UPDATED = "2026-08-20";

export default function HelpPage() {
  return (
    <DocumentPage
      eyebrow="Support"
      title="Help centre"
      lede="The questions we actually get asked, answered without a ticket."
      updated={UPDATED}
      sections={[
        {
          id: "buying",
          title: "Buying and prices",
          body: (
            <>
              <h3>Can I buy from you?</h3>
              <p>
                No, and that is deliberate. We do not sell products, take payment, or hold stock.
                We publish a verdict, and you buy wherever you like — which is what keeps us free
                to say a product is not worth it.
              </p>

              <h3>The price here does not match the retailer.</h3>
              <p>
                Prices are captured when we check them and move constantly. The retailer&rsquo;s
                own page is always the authoritative one — check it before you buy. If a price
                here is wildly out of date, <DocLink href="/contact">tell us</DocLink> and we will
                refresh it.
              </p>

              <h3>Do you make money if I buy?</h3>
              <p>
                Sometimes, through affiliate commission, at no extra cost to you. It never
                influences a verdict, and the rules that guarantee that are written down in the{" "}
                <DocLink href="/affiliate-disclosure">affiliate disclosure</DocLink>.
              </p>

              <h3>Something went wrong with my order.</h3>
              <p>
                We cannot help with that one, and we would be lying if we said otherwise —
                payment, delivery, warranty, and returns are entirely between you and the
                retailer. Contact them directly; your statutory rights are against them, not us.
              </p>
            </>
          ),
        },
        {
          id: "scores",
          title: "Scores and verdicts",
          body: (
            <>
              <h3>What is a PickD Score?</h3>
              <p>
                Our verdict as one number out of ten, built from a rubric fixed per category
                before testing begins. Every score breaks down into the criteria behind it, and
                carries the date it was last reviewed. There is a live worked example in{" "}
                <DocLink href="/how-we-research">How we research</DocLink>.
              </p>

              <h3>Why is an 8.6 ranked above a 9.4?</h3>
              <p>
                Because the <DocLink href="/top-picks">Top Picks board</DocLink> is ordered by our
                editors, not sorted automatically. The score is the measured half; position is an
                editorial judgement about what most people should buy right now. We show both so
                you can disagree with either.
              </p>

              <h3>Why can I not compare scores across categories?</h3>
              <p>
                Because the rubric changes. Headphones are judged on noise cancellation, a laptop
                on thermals and battery. A 9.0 headphone and a 9.0 laptop are each excellent
                against their own category — the numbers are not a shared currency.
              </p>

              <h3>Your score and the star rating disagree.</h3>
              <p>
                Good — that is the point of showing both. Ours is measured, the stars are reported
                by owners, and we never average them into one figure. A disagreement usually means
                something measures well but is annoying to live with, which is worth knowing.
              </p>
            </>
          ),
        },
        {
          id: "account",
          title: "Your account",
          body: (
            <>
              <h3>Do I need an account?</h3>
              <p>
                No. Every verdict is readable without one. An account only adds saved products and
                preferences.
              </p>

              <h3>I forgot my password.</h3>
              <p>
                <DocLink href="/forgot-password">Request a reset link</DocLink>. It goes to the
                address you signed up with and expires in an hour.
              </p>

              <h3>How do I get my data, or delete my account?</h3>
              <p>
                From <DocLink href="/account/settings">your settings</DocLink>. We respond within
                30 days, and asking never degrades the site for you.
              </p>
            </>
          ),
        },
        {
          id: "reviews",
          title: "Reviews you write",
          body: (
            <>
              <h3>Who can leave a review?</h3>
              <p>
                Anyone with an account who has actually used the product. Reviews are moderated
                for authenticity, never for whether they agree with us — a review that contradicts
                our verdict is not a problem, it is data.
              </p>

              <h3>My review was removed.</h3>
              <p>
                It will have hit one of the grounds in the{" "}
                <DocLink href="/editorial-policy">editorial policy</DocLink> — an undisclosed
                commercial interest, coordinated rating manipulation, abuse, or personal
                information. If you think that was wrong,{" "}
                <DocLink href="/contact">appeal it</DocLink> and a person will look again.
              </p>

              <h3>I want to report someone else&rsquo;s review.</h3>
              <p>
                Use the report control on the review itself, or read{" "}
                <DocLink href="/help/report">how reporting works</DocLink> first.
              </p>
            </>
          ),
        },
        {
          id: "coverage",
          title: "Coverage",
          body: (
            <>
              <h3>Why is this category empty?</h3>
              <p>
                Because the research is not finished. We publish a verdict when it is ready and
                not before, so the <DocLink href="/c">index</DocLink> shows the gaps honestly
                rather than padding them with filler.
              </p>

              <h3>Will you cover X?</h3>
              <p>
                Possibly — <DocLink href="/contact">ask</DocLink>. Requests genuinely change what
                we work on next, and they are the main signal we have.
              </p>

              <h3>Can my brand get listed or reviewed?</h3>
              <p>
                You can send us a product, and we may or may not write about it. What you cannot
                do is buy a place, a score, or a position. There is no rate card because nothing
                here is for sale.
              </p>
            </>
          ),
        },
      ]}
      footnote={
        <p>
          Not covered here? <DocLink href="/contact">Contact us</DocLink> — a person reads every
          message.
        </p>
      }
    />
  );
}
