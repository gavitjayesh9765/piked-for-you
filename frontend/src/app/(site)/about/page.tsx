import type { Metadata } from "next";
import { DocumentPage, DocLink } from "@/components/layout/DocumentPage";
import { legalMailto, LEGAL_EMAIL, OPERATOR_COUNTRY, OPERATOR_NAME } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Our story",
  description:
    "Why SortedChoice exists, what it refuses to be, and who is actually writing it.",
  alternates: { canonical: "/about" },
};

const UPDATED = "2026-08-28";

export default function AboutPage() {
  return (
    <DocumentPage
      eyebrow="Our story"
      title="Why this exists."
      lede="Buying a decent thing should not take a weekend of tabs. That is the entire premise."
      updated={UPDATED}
      path="/about"
      schemaType="AboutPage"
      sections={[
        {
          id: "the-problem",
          title: "The problem we got tired of",
          body: (
            <>
              <p>
                Somewhere along the way, researching a purchase became a second job. Twenty tabs, a
                spec sheet you cannot interpret, a review site that liked everything, a video that
                was clearly sponsored, and a comment thread where two people are arguing about a
                model that has been discontinued for three years.
              </p>
              <p>
                And at the end of it you still are not sure. You just get tired and buy whatever is
                on the first page.
              </p>
              <p>
                The information exists. What is missing is <strong>someone willing to reach a
                conclusion</strong> — and to be accountable for it.
              </p>
            </>
          ),
        },
        {
          id: "what-we-do",
          title: "What we actually do",
          body: (
            <>
              <p>
                We read the reviews, compare the specifications that matter, and tell you which
                products are worth the money — and which are not. Then you buy wherever you like.
              </p>
              <p>Three things follow from that, and they shape everything else:</p>
              <ul>
                <li>
                  <strong>We reach a verdict.</strong> Not a list of options ranked by nothing. A
                  recommendation, in one line, saying who this is for and who should skip it.
                </li>
                <li>
                  <strong>We show our working.</strong> Every score breaks down into the criteria
                  behind it, dated, so you can disagree with us specifically rather than
                  generally.
                </li>
                <li>
                  <strong>We do not sell anything.</strong> There is no basket on this site and
                  there never will be. When you decide, you leave — and we are fine with that.
                </li>
              </ul>
            </>
          ),
        },
        {
          id: "what-we-refuse",
          title: "What we refuse to be",
          body: (
            <>
              <p>
                A shop. A comparison engine that ranks by whoever pays most. A review site where
                everything scores between eight and nine because nobody wants to lose access to
                review units.
              </p>
              <p>
                The pressure to become those things is real and it is mostly financial, which is
                why the rules are written down in public rather than kept as good intentions. Read{" "}
                <DocLink href="/affiliate-disclosure">how we make money</DocLink> and{" "}
                <DocLink href="/editorial-policy">the rules the verdicts are written under</DocLink>.
                If we ever drift, those pages are what you hold us to.
              </p>
            </>
          ),
        },
        {
          id: "two-voices",
          title: "Two voices, never merged",
          body: (
            <>
              <p>
                Our verdict is measured and ours. The community rating is reported and yours. We
                show both and never average them into one number, because a single blended figure
                would let a good measurement bury a chorus of owners saying the thing broke.
              </p>
              <p>
                If you own something we have covered,{" "}
                <DocLink href="/c">leave a rating</DocLink> — the long-term experience is the part
                no rubric can reach.
              </p>
            </>
          ),
        },
        {
          id: "who",
          title: "Who is actually writing this",
          body: (
            <>
              <p>
                <strong>{OPERATOR_NAME}.</strong> One person, in {OPERATOR_COUNTRY}, running
                SortedChoice as a sole proprietor. Not a masthead, not a newsroom, and not a
                content agency with a rotating byline.
              </p>
              <p>
                The site says &ldquo;we&rdquo; throughout, because that is how a publication
                talks and because the verdicts speak for the site rather than for a mood on a
                given afternoon. But it should not be read as a room full of staff. Every
                rubric, every score and every verdict here has one author, and the reason to
                tell you that is the same reason for publishing the method at all: you cannot
                weigh a recommendation without knowing who is making it.
              </p>
              <p>
                What follows from being one person is worth saying plainly. Coverage is narrower
                than a large site&rsquo;s and grows more slowly. There is no separate fact-checking
                desk, so the checks are procedural instead — a published rubric fixed before the
                research starts, an{" "}
                <DocLink href="/editorial-policy#ai">adversarial AI pass</DocLink> whose job is to
                attack the conclusion, and{" "}
                <DocLink href="/editorial-policy#corrections">corrections recorded on the page</DocLink>{" "}
                rather than quietly edited in. When a page says nobody has held the product, that
                is not modesty, it is the default.
              </p>
              <p>
                It also means there is a name attached to every mistake. Write to{" "}
                <DocLink href={legalMailto("SortedChoice")}>{LEGAL_EMAIL}</DocLink> and it reaches
                the person who wrote the thing you are complaining about — the formal route, with
                deadlines on it, is <DocLink href="/grievance">grievance redressal</DocLink>.
              </p>
            </>
          ),
        },
        {
          id: "where-we-are",
          title: "Where we are now",
          body: (
            <>
              <p>
                Early, and honest about it. Our <DocLink href="/c">index</DocLink> shows every
                category we intend to cover alongside how far the research has actually got in
                each one — including the many still sitting at nothing.
              </p>
              <p>
                We would rather show you the gaps than pad them out with filler. A verdict gets
                published when the research behind it is finished, and not before.
              </p>
            </>
          ),
        },
      ]}
      footnote={
        <p>
          Something we got wrong, or a category you want covered next?{" "}
          <DocLink href="/contact">Tell us</DocLink> — it genuinely changes what we work on.
        </p>
      }
    />
  );
}
