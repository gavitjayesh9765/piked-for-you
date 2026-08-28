import type { Metadata } from "next";
import { DocumentPage, DocLink } from "@/components/layout/DocumentPage";

export const metadata: Metadata = {
  title: "Editorial policy",
  description:
    "The rules our editors work under: independence, corrections, review units, and community moderation.",
  alternates: { canonical: "/editorial-policy" },
};

const UPDATED = "2026-08-28";

export default function EditorialPolicyPage() {
  return (
    <DocumentPage
      eyebrow="Editorial"
      title="Editorial policy"
      lede="The rules our editors work under. Published so you can tell when we have broken them."
      updated={UPDATED}
      path="/editorial-policy"
      sections={[
        {
          id: "independence",
          title: "Independence",
          body: (
            <>
              <p>
                No advertiser, affiliate partner, or brand has any input into what we cover, what
                we conclude, or where a product ranks. Nobody outside the editorial team sees a
                verdict before it is published, and no verdict is shared with a brand for comment.
              </p>
              <p>
                Editors do not accept payment, gifts, hospitality, or equity from companies whose
                products they cover. Where an editor holds a personal interest that a reasonable
                reader might see as a conflict, they do not work on that product.
              </p>
            </>
          ),
        },
        {
          id: "review-units",
          title: "Review units and samples",
          body: (
            <>
              <p>
                Where we accept a sample from a manufacturer, the terms are fixed and
                non-negotiable:
              </p>
              <ul>
                <li>No copy approval, no advance sight of the verdict, no embargo on criticism.</li>
                <li>
                  Samples are returned or, where a manufacturer will not take them back, retained
                  only for long-term testing — never resold for profit.
                </li>
                <li>
                  Accepting a sample creates no obligation to publish. Plenty are tested and never
                  written about.
                </li>
                <li>
                  If continued access to samples were ever made conditional on favourable coverage,
                  we would lose the access and say so on the page.
                </li>
              </ul>
            </>
          ),
        },
        {
          id: "scoring",
          title: "Scoring",
          body: (
            <>
              <p>
                Every PickD Score is built from a per-category rubric fixed before testing begins,
                and each criterion is scored against that rubric rather than against the other
                products in the round-up. A weak field does not promote a mediocre product.
              </p>
              <p>
                Scores carry the date they were last reviewed. When a price moves materially, a
                firmware update changes behaviour, or a successor arrives, the score is revisited —
                and where it changes, the change is visible rather than silent.
              </p>
              <p>
                The full method, including a live worked example, is in{" "}
                <DocLink href="/how-we-research">How we research</DocLink>.
              </p>
            </>
          ),
        },
        {
          id: "corrections",
          title: "Corrections",
          body: (
            <>
              <p>
                We get things wrong. When we do, we fix the page and say what changed — we do not
                quietly edit and move on.
              </p>
              <ul>
                <li>
                  <strong>Factual errors</strong> are corrected as soon as they are confirmed, with
                  a note on the page recording what was wrong and when it was fixed.
                </li>
                <li>
                  <strong>Changed verdicts</strong> — where new evidence moves a conclusion — keep
                  the original reasoning visible alongside the revision. Deleting the old verdict
                  would hide the thing you most need to judge us on.
                </li>
                <li>
                  <strong>Price and availability</strong> drift constantly and are refreshed
                  without a correction note; the retailer&rsquo;s page is always authoritative.
                </li>
              </ul>
              <p>
                Spotted something wrong? <DocLink href="/contact">Report it</DocLink>.
              </p>
            </>
          ),
        },
        {
          id: "community",
          title: "Community reviews",
          body: (
            <>
              <p>
                Community ratings come from readers and are shown separately from our own score,
                always with the number of contributors so you can weigh them yourself.
              </p>
              <p>We moderate for authenticity, not for agreement. A review is removed when it:</p>
              <ul>
                <li>is written by someone with a commercial interest in the product;</li>
                <li>is part of a coordinated attempt to move a rating up or down;</li>
                <li>contains abuse, personal information, or content that is unlawful;</li>
                <li>is plainly not about the product in question.</li>
              </ul>
              <p>
                A negative review is never removed for being negative, and we do not edit review
                text to soften it. If yours was removed and you think that was wrong,{" "}
                <DocLink href="/contact">appeal it</DocLink>.
              </p>
            </>
          ),
        },
        {
          id: "ai",
          title: "Use of automated tools",
          body: (
            <>
              <p>
                We use software to gather specifications, track prices, and surface patterns across
                large numbers of owner reports. That is research assistance, and it is checked.
              </p>
              <p>
                We also put finished research to an AI model as an adversarial second reader — to
                ask what we have missed, which claim is thinly sourced, and what the best argument
                against our conclusion looks like. It is questioned and verified like any other
                source, and where it and the evidence disagree, the evidence wins.
              </p>
              <p>
                <strong>No verdict on this site is generated automatically.</strong> A person
                decides what a product is worth, writes the line that says so, and is accountable
                for it.
              </p>
            </>
          ),
        },
      ]}
      footnote={
        <p>
          These rules only mean something if you can act on them. If a page on this site looks like
          it breaks one, <DocLink href="/contact">tell us which page and which rule</DocLink> — we
          will look at it and reply.
        </p>
      }
    />
  );
}
