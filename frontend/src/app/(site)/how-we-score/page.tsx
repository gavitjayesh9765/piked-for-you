import type { Metadata } from "next";
import { DocumentPage, DocLink } from "@/components/layout/DocumentPage";

export const metadata: Metadata = {
  title: "How we score products",
  description:
    "What the SortedChoice Score is, what the four verdicts mean, how criteria are set per category, and why our score is never merged with the community rating.",
  alternates: { canonical: "/how-we-score" },
};

const UPDATED = "2026-08-28";

/**
 * How we score products.
 *
 * Separate from /how-we-research on purpose. That page answers "what is your
 * method?" — this one answers the narrower question a reader has while looking
 * at a specific number on a specific product page: *what does 8.2 mean, and
 * what does BUY NOW mean?*
 *
 * Both are linked from every product page's trust row, which is the only place
 * either of them is likely to be read.
 */
export default function HowWeScorePage() {
  return (
    <DocumentPage
      eyebrow="Method"
      title="How we score products"
      lede="What the number means, what the four verdicts mean, and what neither of them can be bought with."
      updated={UPDATED}
      path="/how-we-score"
      schemaType="Article"
      sections={[
        {
          id: "the-verdict",
          title: "The verdict comes first",
          body: (
            <>
              <p>
                Every product page leads with one of four answers. They are a closed set,
                deliberately — a fifth option meaning &ldquo;it depends&rdquo; is where every
                undecided verdict would quietly end up, and a recommendation that can say
                anything says nothing.
              </p>
              <ul>
                <li>
                  <strong>Buy now</strong> — worth its current price today. Not
                  &ldquo;the best in the world&rdquo;; worth what it costs, now.
                </li>
                <li>
                  <strong>Wait for a sale</strong> — the right product at the wrong price. The
                  product is sound, the number on it is not, and history says the number moves.
                </li>
                <li>
                  <strong>Skip</strong> — not worth it at any price we expect it to reach. A
                  recommendation nobody can fail is not a recommendation.
                </li>
                <li>
                  <strong>Consider an alternative</strong> — nothing wrong with it, but
                  something else does the job you are buying it for noticeably better. The
                  alternatives block at the bottom of the page names which, and why.
                </li>
              </ul>
              <p>
                The verdict is a judgement, not a threshold. A 7.1 can be a Buy now if it is
                cheap for what it does, and an 8.6 can be a Wait for a sale if it has just
                launched at a launch price.
              </p>
            </>
          ),
        },
        {
          id: "the-score",
          title: "What the SortedChoice Score is",
          body: (
            <>
              <p>
                The SortedChoice Score runs from 0 to 10 with one decimal place. It is our
                evaluation of a product against the standard for its category — not against
                the other products that happen to be in the same round-up, and not against
                everything ever made.
              </p>
              <p>Roughly what the bands mean:</p>
              <ul>
                <li>
                  <strong>9.0 and above</strong> — exceptional. Rare, and getting rarer as
                  categories mature.
                </li>
                <li>
                  <strong>8.0–8.9</strong> — very good. Few real compromises at its price.
                </li>
                <li>
                  <strong>7.0–7.9</strong> — good, with trade-offs worth knowing about before
                  you buy.
                </li>
                <li>
                  <strong>6.0–6.9</strong> — fair. Competent, but beaten in its price band.
                </li>
                <li>
                  <strong>Below 6.0</strong> — weak. There is a better use of the money, and
                  the page will say what it is.
                </li>
              </ul>
              <p>
                A score carries the date it was set. Prices move, firmware changes things, and
                successors arrive — a score from eighteen months ago is a historical fact, not
                a current recommendation, and the date is there so you can weigh it yourself.
              </p>
            </>
          ),
        },
        {
          id: "criteria",
          title: "The criteria are set per category",
          body: (
            <>
              <p>
                Before any product in a category is scored, the criteria for that category are
                fixed. Headphones are judged on noise cancellation, call quality, comfort and
                battery. A mouse is judged on sensor accuracy, ergonomics, buttons and build.
                A single five-star scale stretched across unrelated things measures nothing at
                all.
              </p>
              <p>
                Every criterion is scored on its own, 0 to 10, against the category standard.
                The overall score is a weighted combination of those criteria — the weights
                are part of the category&rsquo;s configuration, not something an editor picks
                per product to reach a number they had in mind.
              </p>
              <p>
                The breakdown is published on the product page. If the overall looks generous,
                you can see exactly which criterion carried it.
              </p>
            </>
          ),
        },
        {
          id: "two-numbers",
          title: "Our score and your rating never merge",
          body: (
            <>
              <p>
                Two numbers appear on a product page and they measure different things. The
                SortedChoice Score is ours, on a 0–10 scale, and it is an evaluation. The community
                rating is yours, on a 1–5 scale, and it is a report of experience.
              </p>
              <p>
                They are never averaged into one figure. Blending an editorial judgement with
                an owner poll produces a number that means neither, and hides the far more
                useful signal — the cases where they disagree. A product we score well that
                owners rate badly is telling you something specific, and merging the two would
                erase exactly that.
              </p>
            </>
          ),
        },
        {
          id: "our-view",
          title: "It is our view, and yours may differ",
          body: (
            <>
              <p>
                A score is a judgement, not a measurement, and it is written from somewhere: a
                general reader in India, buying at today&rsquo;s price, with no strong prior
                commitments. That reader is a composite. You are not them, and where you differ,
                our number may be the wrong number for you.
              </p>
              <p>The weights are where this shows up most:</p>
              <ul>
                <li>
                  <strong>We chose them; you did not.</strong> If a category rubric puts battery at
                  25% and you never leave a desk, a quarter of the score is measuring something
                  irrelevant to you. The breakdown is published on every product page for exactly
                  this reason — read the criterion you care about rather than the total.
                </li>
                <li>
                  <strong>Price is inside the judgement.</strong> Most verdicts are as much about
                  what a thing costs as about what it is, so a discount can turn a &ldquo;wait&rdquo;
                  into a &ldquo;buy&rdquo; without a single fact about the product changing.
                </li>
                <li>
                  <strong>Fit beats rank.</strong> An 8.6 that is wrong for your use loses to a 7.2
                  that is right for it. <strong>Best for</strong> and{" "}
                  <strong>Not ideal for</strong> on each page are there to be read before the
                  number, not after.
                </li>
                <li>
                  <strong>Some of it is taste.</strong> Sound signature, screen tuning, keyboard
                  feel. We describe these as precisely as we can and we try not to dress a
                  preference up as a defect.
                </li>
              </ul>
              <p>
                So: disagree with us. A reader who reads the breakdown, decides our weighting is
                wrong for them, and buys the product we ranked second has used this site correctly.
                The fuller version of this is in our{" "}
                <DocLink href="/disclaimer#varies">disclaimer</DocLink>.
              </p>
            </>
          ),
        },
        {
          id: "not-for-sale",
          title: "What cannot influence a score",
          body: (
            <>
              <p>
                No brand, advertiser, or affiliate partner has any input into a score or a
                verdict. There is no rate card, because there is nothing on sale.
              </p>
              <p>
                The order is fixed and not negotiable:{" "}
                <strong>the research finishes, the verdict is written, and only then is a
                retailer link attached.</strong>{" "}
                Whether a product has an affiliate link, and which retailer pays the better
                commission, are facts nobody scoring it is working from.
              </p>
              <p>
                Where a product page earns us a commission, the link itself says so — not just
                the footer. See{" "}
                <DocLink href="/affiliate-disclosure">how we make money</DocLink> and{" "}
                <DocLink href="/editorial-policy">the rules the verdicts are written under</DocLink>.
              </p>
            </>
          ),
        },
        {
          id: "testing",
          title: "Researched, tested, and the difference",
          body: (
            <>
              <p>
                Most verdicts on this site are <strong>research verdicts</strong>. That means
                published specifications, independent measurements, long-form reviews,
                teardowns, and the pattern in what owners report once a product has been out
                long enough to have one — assessed against the category standard and against
                the price.
              </p>
              <p>
                Where somebody here has physically used a product, the &ldquo;How we reviewed
                this&rdquo; box on that page says so. Where it does not say so, nobody has. We
                would rather under-claim on every page than let one page imply a test that
                never happened.
              </p>
              <p>
                No verdict on this site is generated automatically. Software helps gather
                specifications and track prices; a person decides what a product is worth,
                writes the line that says so, and is accountable for it.
              </p>
            </>
          ),
        },
      ]}
      footnote={
        <p>
          Think a score is wrong? That is a useful thing to hear, and specific beats general —{" "}
          <DocLink href="/contact">tell us which product and which criterion</DocLink>, and we
          will look at it again. The method behind all of this is set out in{" "}
          <DocLink href="/how-we-research">How we research</DocLink>.
        </p>
      }
    />
  );
}
