import type { Metadata } from "next";
import { DocumentPage, DocLink } from "@/components/layout/DocumentPage";
import {
  AMAZON_ASSOCIATES_DISCLOSURE,
  AMAZON_TRADEMARK_NOTICE,
  FLIPKART_TRADEMARK_NOTICE,
  legalMailto,
  LEGAL_EMAIL,
} from "@/lib/legal";

export const metadata: Metadata = {
  title: "Affiliate disclosure",
  description:
    "How SortedChoice makes money, and the rules that keep it away from the verdicts.",
  alternates: { canonical: "/affiliate-disclosure" },
};

const UPDATED = "2026-08-20";

export default function AffiliateDisclosurePage() {
  return (
    <DocumentPage
      eyebrow="Disclosure"
      title="Affiliate disclosure"
      lede="We earn commission on some outbound links. Here is exactly how that works and what it is not allowed to touch."
      updated={UPDATED}
      path="/affiliate-disclosure"
      sections={[
        {
          id: "the-short-version",
          title: "The short version",
          body: (
            <>
              <p>
                When you follow a link from SortedChoice to a retailer and buy something, we may
                receive a small commission from that retailer. <strong>It costs you nothing
                extra</strong> — the price you pay is the price you would have paid arriving
                any other way.
              </p>
              <p>
                That commission is the whole business model. We do not sell products, we do not
                run a basket, we do not hold stock, and we do not charge you.
              </p>
              {/* ⚠ Prescribed verbatim by the Amazon Associates Operating
                  Agreement. Rendered from the constant rather than typed here
                  so the footer and this page cannot drift apart — one edited
                  pronoun is a breach. See lib/legal.ts. */}
              <p>
                <strong>{AMAZON_ASSOCIATES_DISCLOSURE}</strong>
              </p>
            </>
          ),
        },
        {
          id: "what-it-cannot-touch",
          title: "What commission cannot touch",
          body: (
            <>
              <p>These are the rules, and they are the reason the disclosure is worth reading:</p>
              <ul>
                <li>
                  <strong>Commission never influences a verdict.</strong> The research is completed
                  and the verdict written before anyone attaches a retailer link. By the time
                  commercial terms are known, the conclusion is already fixed.
                </li>
                <li>
                  <strong>Rates do not vary by conclusion.</strong> We are not paid more for a
                  positive verdict than a negative one, and no retailer is told what a verdict says
                  before it is published.
                </li>
                <li>
                  <strong>No brand can buy a place.</strong> Not a spot on the board, not a score,
                  not a mention. There is no rate card because nothing here is on sale.
                </li>
                <li>
                  <strong>We recommend against buying.</strong> Plenty of our verdicts conclude
                  &ldquo;wait&rdquo; or &ldquo;buy the cheaper one&rdquo;, both of which earn us
                  less than the alternative. That is the test of whether any of this is real.
                </li>
              </ul>
            </>
          ),
        },
        {
          id: "who-we-work-with",
          title: "Who we work with",
          body: (
            <>
              <p>
                We participate in affiliate programmes operated by major retailers, which currently
                include Amazon and Flipkart. Where a product is available from several retailers we
                list them, and the ordering reflects price and availability rather than commission
                rate.
              </p>
              <p>
                Some outbound links carry no commission at all. We do not mark these differently,
                because doing so would imply the others deserve more suspicion — the rules in{" "}
                <DocLink href="#what-it-cannot-touch">§02</DocLink> apply to every link equally.
              </p>
              <p>
                Every commissionable link on this site is marked as an affiliate link where it
                appears, and carries <code>rel=&quot;sponsored&quot;</code> so that search engines
                are told the same thing you are. We are a participant in the Amazon Services LLC
                Associates Program and its Indian equivalent, an affiliate advertising programme
                designed to provide a means for sites to earn advertising fees by advertising and
                linking to Amazon.
              </p>
              <p className="text-ink-subtle">
                {AMAZON_TRADEMARK_NOTICE} {FLIPKART_TRADEMARK_NOTICE} Product names, logos and
                brands are the property of their respective owners and are used here only to
                identify the products discussed; their use implies no affiliation with, or
                endorsement by, those owners.
              </p>
            </>
          ),
        },
        {
          id: "prices",
          title: "About prices",
          body: (
            <>
              <p>
                Prices shown on SortedChoice are captured when we check them and can move at any
                time. Always confirm the price on the retailer&rsquo;s own page before buying —
                that page, not ours, is the authoritative one.
              </p>
              <p>
                We are not party to the transaction. Payment, delivery, warranty, returns, and
                support are entirely between you and the retailer.
              </p>
            </>
          ),
        },
        {
          id: "holding-us-to-it",
          title: "Holding us to it",
          body: (
            <>
              <p>
                If you read something on this site that seems written for a retailer rather than
                for you, we want to know. That is not a difference of opinion, it is a defect, and
                we treat it like one.
              </p>
              <p>
                <DocLink href="/contact">Tell us what you found</DocLink>, or write to{" "}
                <DocLink href={legalMailto("Affiliate disclosure")}>{LEGAL_EMAIL}</DocLink>, and we
                will look at the page and reply. Complaints that need a formal route, with a clock
                on them, go through <DocLink href="/grievance">grievance redressal</DocLink>.
              </p>
            </>
          ),
        },
      ]}
      footnote={
        <p>
          Read the reasoning behind all of this in{" "}
          <DocLink href="/how-we-research">How we research</DocLink>, which sets out the method the
          verdicts follow and the point at which a retailer link is allowed anywhere near one.
        </p>
      }
    />
  );
}
