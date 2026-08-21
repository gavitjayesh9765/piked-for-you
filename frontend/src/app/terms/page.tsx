import type { Metadata } from "next";
import { DocumentPage, DocLink } from "@/components/layout/DocumentPage";

export const metadata: Metadata = {
  title: "Terms of service",
  description: "The terms you agree to by using PickDForYou.",
  alternates: { canonical: "/terms" },
};

const UPDATED = "2026-08-20";

export default function TermsPage() {
  return (
    <DocumentPage
      eyebrow="Legal"
      title="Terms of service"
      lede="The agreement between you and us. Written to be read, not to be survived."
      updated={UPDATED}
      sections={[
        {
          id: "what-this-is",
          title: "What this site is",
          body: (
            <>
              <p>
                PickDForYou publishes independent research and recommendations about consumer
                products. By using the site you agree to these terms.
              </p>
              <p>
                <strong>We are a publisher, not a shop.</strong> We do not sell products, take
                payment, hold stock, or ship anything. When you follow a link to a retailer, your
                purchase is a contract between you and that retailer, and we are not a party to it.
              </p>
            </>
          ),
        },
        {
          id: "our-content",
          title: "Our recommendations",
          body: (
            <>
              <p>
                Verdicts and scores are our honest editorial opinion at the time of writing, formed
                by the method set out in{" "}
                <DocLink href="/how-we-research">How we research</DocLink>. They are information to
                help you decide — not professional, financial, medical, or safety advice.
              </p>
              <p>
                Specifications, prices, and availability change constantly and may be out of date.
                Always confirm the details on the retailer&rsquo;s own page before buying; that
                page is authoritative and ours is not.
              </p>
            </>
          ),
        },
        {
          id: "your-account",
          title: "Your account",
          body: (
            <>
              <ul>
                <li>You must be at least 13 years old to create an account.</li>
                <li>
                  Give accurate details, keep your password to yourself, and tell us promptly if
                  you think someone else has got into your account.
                </li>
                <li>You are responsible for activity that happens under your account.</li>
                <li>
                  You may delete your account whenever you like, from{" "}
                  <DocLink href="/account/settings">your settings</DocLink>.
                </li>
              </ul>
            </>
          ),
        },
        {
          id: "your-contributions",
          title: "Reviews you write",
          body: (
            <>
              <p>When you post a review, rating, or image you confirm that:</p>
              <ul>
                <li>it is your own genuine experience of the product;</li>
                <li>you have no undisclosed commercial interest in it;</li>
                <li>it is yours to post, and posting it infringes nobody&rsquo;s rights;</li>
                <li>
                  it contains no abuse, no private information about other people, and nothing
                  unlawful.
                </li>
              </ul>
              <p>
                You keep ownership of what you write. You grant us a non-exclusive, worldwide,
                royalty-free licence to host, display, and distribute it on the site — that licence
                is what allows us to publish it at all.
              </p>
              <p>
                We may remove content that breaks these rules, on the grounds set out in our{" "}
                <DocLink href="/editorial-policy">editorial policy</DocLink>. We do not remove
                reviews for being critical.
              </p>
            </>
          ),
        },
        {
          id: "acceptable-use",
          title: "Acceptable use",
          body: (
            <>
              <p>Do not:</p>
              <ul>
                <li>
                  attempt to manipulate ratings, whether by fake reviews, multiple accounts, or
                  coordinated voting;
                </li>
                <li>
                  scrape, harvest, or bulk-copy the site&rsquo;s content for republication or to
                  train a model, without our written permission;
                </li>
                <li>
                  interfere with the service — probing, overloading, or circumventing security
                  measures;
                </li>
                <li>impersonate anyone, or misrepresent a commercial interest as a personal one.</li>
              </ul>
              <p>
                We may suspend or close accounts that do these things, and where the conduct is
                unlawful we will report it.
              </p>
            </>
          ),
        },
        {
          id: "our-rights",
          title: "Intellectual property",
          body: (
            <p>
              The site&rsquo;s text, design, scoring methodology, and branding belong to
              PickDForYou. You are welcome to quote us with attribution and a link. Wholesale
              reproduction of our verdicts or scores is not permitted without permission. Product
              names, logos, and images belong to their respective owners.
            </p>
          ),
        },
        {
          id: "liability",
          title: "Liability",
          body: (
            <>
              <p>
                The site is provided as it is. We work hard to be accurate but we do not warrant
                that everything on it is complete, current, or error-free.
              </p>
              <p>
                To the fullest extent the law allows, we are not liable for losses arising from
                your reliance on our recommendations, from a purchase you make from a retailer, or
                from the site being unavailable. Nothing here limits liability for death or
                personal injury caused by our negligence, for fraud, or for anything else that
                cannot lawfully be limited — and nothing here affects your statutory consumer
                rights against a retailer.
              </p>
            </>
          ),
        },
        {
          id: "changes",
          title: "Changes and ending",
          body: (
            <>
              <p>
                We may update these terms; the effective date at the top always reflects the
                current version, and we will notify account holders of material changes rather
                than relying on you to notice.
              </p>
              <p>
                You may stop using the site at any time. We may suspend access where these terms
                are broken. The sections on intellectual property, liability, and your review
                licence survive.
              </p>
            </>
          ),
        },
      ]}
      footnote={
        <p>
          Questions about these terms? <DocLink href="/contact">Ask us</DocLink>. See also the{" "}
          <DocLink href="/privacy">privacy policy</DocLink>,{" "}
          <DocLink href="/cookies">cookie policy</DocLink>, and{" "}
          <DocLink href="/affiliate-disclosure">affiliate disclosure</DocLink>.
        </p>
      }
    />
  );
}
