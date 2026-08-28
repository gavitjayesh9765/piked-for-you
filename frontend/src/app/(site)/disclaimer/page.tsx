import type { Metadata } from "next";
import { DocumentPage, DocLink } from "@/components/layout/DocumentPage";
import { legalMailto, LEGAL_EMAIL, OPERATOR_DESCRIPTION } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Disclaimer",
  description:
    "Our verdicts are opinions formed for a typical buyer, not universal truths. What that means, where it stops, and what we do not warrant.",
  alternates: { canonical: "/disclaimer" },
};

const UPDATED = "2026-08-28";

/**
 * The disclaimer.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS A SEPARATE DOCUMENT AND NOT A CLAUSE IN /terms
 *
 * §07 of /terms already limits liability, and a lawyer would tell you that is
 * sufficient. It is sufficient legally and useless practically, because nobody
 * reads the terms of service of a site they are reading for free.
 *
 * The thing this page exists to say is not a liability limitation, it is an
 * epistemic one: every verdict on this site is ONE view, formed for a reader
 * we had to imagine, and a reader who is not that person may correctly reach
 * the opposite conclusion from the same evidence. That is not a caveat we are
 * forced to print — it is true, it is the single most useful thing a reader
 * can know about how to use a recommendation site, and burying it in §07 of a
 * contract would be hiding it.
 *
 * So it is a document with its own name in the footer, written to be read. The
 * enforceable version still lives in /terms; the two are linked in both
 * directions and must not be allowed to drift apart.
 */
export default function DisclaimerPage() {
  return (
    <DocumentPage
      eyebrow="Legal"
      title="Disclaimer"
      lede="Every verdict here is our opinion, formed for a reader we had to imagine. You are a specific person, and that difference matters."
      updated={UPDATED}
      path="/disclaimer"
      sections={[
        {
          id: "opinion",
          title: "Our verdicts are opinions",
          body: (
            <>
              <p>
                A PickD Score is not a measurement of a product the way a weight or a battery
                capacity is a measurement. It is a <strong>judgement</strong> — evidence assembled
                by people, weighed against a rubric those same people wrote, and expressed as a
                number so it can be compared. Two careful teams working from the same evidence can
                land on different numbers, and neither of them is lying.
              </p>
              <p>
                We publish <DocLink href="/how-we-research">the method</DocLink> and{" "}
                <DocLink href="/how-we-score">the rubric</DocLink> precisely because the
                conclusion is arguable. A verdict you cannot inspect is one you have to take on
                faith; a verdict with the reasoning attached is one you can disagree with — and
                disagreeing with us on a stated ground is a completely legitimate outcome of
                reading this site.
              </p>
              <p>
                Nothing here is a statement of fact about a product&rsquo;s merit, a guarantee of
                performance, or a promise about what you will experience.
              </p>
            </>
          ),
        },
        {
          id: "varies",
          title: "The right answer varies, and it varies a lot",
          body: (
            <>
              <p>
                Our verdict is written for a general reader in India buying at the current price.
                That reader is a composite, and you are not them. The gap between the two is where
                most of the disagreement about any recommendation actually lives:
              </p>
              <ul>
                <li>
                  <strong>What you are buying it for.</strong> We score a laptop on a blend of
                  thermals, battery, screen and build. If you only ever edit video on mains power,
                  the battery weighting is noise to you and the thermals are everything. Our
                  weighting is a reasonable default, not your priorities.
                </li>
                <li>
                  <strong>What you already own.</strong> A product that is a poor buy on its own
                  can be the obvious one if it is the only thing that works with the ecosystem,
                  the charger, or the software you are already committed to.
                </li>
                <li>
                  <strong>What you would pay.</strong> Almost every verdict is a judgement about
                  price as much as about product. A &ldquo;wait for a sale&rdquo; becomes a
                  &ldquo;buy now&rdquo; the moment the sale happens, and prices here move fast
                  enough that a page can be right on Monday and stale by Friday.
                </li>
                <li>
                  <strong>Where you are.</strong> Availability, warranty terms, service-centre
                  coverage and the price itself differ by city, by platform, and between the
                  Indian model and the one reviewed abroad. A regional variant is not always the
                  same hardware under the same name.
                </li>
                <li>
                  <strong>Which unit you get.</strong> Manufacturing varies, batches vary, and
                  firmware changes behaviour after launch. Aggregate reliability is a pattern
                  across many owners, not a prediction about your particular box.
                </li>
                <li>
                  <strong>Taste.</strong> Sound signature, screen calibration, keyboard feel and
                  the weight of a thing in the hand are preferences. We describe them as precisely
                  as we can, and we do not pretend ours is the correct one.
                </li>
              </ul>
              <p>
                This is why every product page carries <strong>Best for</strong> and{" "}
                <strong>Not ideal for</strong> rather than only a score. Finding yourself in the
                second column and buying it anyway can be an entirely sensible decision — you know
                something about your situation that we could not.
              </p>
            </>
          ),
        },
        {
          id: "not-advice",
          title: "This is not professional advice",
          body: (
            <>
              <p>
                SortedChoice publishes consumer product research. It is information to help you
                decide. It is <strong>not</strong> professional, financial, legal, medical or
                safety advice, and reading it creates no professional relationship between us.
              </p>
              <p>
                Where a product touches health, safety or money — anything worn on the body,
                anything electrical, anything installed, anything regulated — the
                manufacturer&rsquo;s own instructions and warnings govern, and a qualified
                professional beats a web page. Nothing we write overrides either.
              </p>
            </>
          ),
        },
        {
          id: "accuracy",
          title: "Prices, specifications and availability",
          body: (
            <>
              <p>
                Prices and stock shown on this site are captured at the moment we check them and
                are indicative only. They change without notice, they differ between sellers on
                the same platform, and they can simply be wrong.{" "}
                <strong>
                  The retailer&rsquo;s own product page is the authoritative one — confirm the
                  price, the variant, the seller and the warranty there before you buy.
                </strong>
              </p>
              <p>
                Specifications are taken from manufacturer material and independent testing and
                reproduced in good faith. Manufacturers do revise hardware silently within a model
                name; where we notice, we say so, and we will not always notice.
              </p>
              <p>
                Found something out of date or plainly wrong? That is a defect and we want it —{" "}
                <DocLink href="/contact">report it</DocLink>, or write to{" "}
                <DocLink href={legalMailto("Correction")}>{LEGAL_EMAIL}</DocLink>.
              </p>
            </>
          ),
        },
        {
          id: "third-parties",
          title: "Retailers, brands and links out",
          body: (
            <>
              <p>
                We are a publisher, not a shop. We do not sell, stock, ship or service anything.
                When you follow a link out, your purchase is a contract between you and that
                retailer, and everything that follows from it — payment, delivery, warranty,
                returns, repairs, refunds — is between the two of you. We are not a party to it
                and cannot resolve it for you.
              </p>
              <p>
                Linking to a retailer is not an endorsement of that retailer, and covering a brand
                is not an endorsement of the brand. Product names, images, logos and trademarks
                belong to their respective owners and appear here to identify the products
                discussed; their appearance does not imply any affiliation with, or approval by,
                those owners.
              </p>
              <p>
                Some of those links earn us a commission. That is disclosed in full in the{" "}
                <DocLink href="/affiliate-disclosure">affiliate disclosure</DocLink>, along with
                the rule that keeps it away from the verdict.
              </p>
            </>
          ),
        },
        {
          id: "community",
          title: "Reviews written by other readers",
          body: (
            <>
              <p>
                Community ratings and reviews are the opinions of the people who wrote them, not
                ours. We moderate for authenticity — the grounds are set out in our{" "}
                <DocLink href="/editorial-policy#community">editorial policy</DocLink> — but we do
                not verify every claim in every review, and we do not adopt them as our own.
              </p>
              <p>
                They are shown separately from our score, and never averaged into it, so that a
                stranger&rsquo;s experience can be weighed as a stranger&rsquo;s experience. If a
                review is fake, abusive or unlawful,{" "}
                <DocLink href="/help/report">report it</DocLink> and we will act.
              </p>
            </>
          ),
        },
        {
          id: "no-warranty",
          title: "What we do not warrant",
          body: (
            <>
              <p>
                The site and everything on it is provided &ldquo;as is&rdquo;. We work hard to be
                accurate, and we do not warrant that the content is complete, current or free of
                error, or that the site will be available without interruption.
              </p>
              <p>
                To the fullest extent the law allows, {OPERATOR_DESCRIPTION}, is not liable for
                loss arising from your reliance on anything published here, from a purchase you
                make from a retailer, or from the site being unavailable. Nothing on this page
                limits liability for death or personal injury caused by negligence, for fraud, or
                for anything else that cannot lawfully be limited — and{" "}
                <strong>
                  nothing here affects your statutory rights as a consumer against the seller or
                  the manufacturer
                </strong>
                , which are yours regardless of anything we write.
              </p>
              <p>
                The enforceable version of this, with the rest of the agreement around it, is in
                our <DocLink href="/terms#liability">terms of service</DocLink>.
              </p>
            </>
          ),
        },
      ]}
      footnote={
        <p>
          If a page on this site states as fact something that is really a judgement, or claims a
          certainty the evidence does not carry, that is a writing failure and we would rather fix
          it than defend it. <DocLink href="/contact">Tell us which page</DocLink>. Complaints that
          need a formal route go through <DocLink href="/grievance">grievance redressal</DocLink>.
        </p>
      }
    />
  );
}
