import type { Metadata } from "next";
import { DocumentPage, DocLink } from "@/components/layout/DocumentPage";
import {
  GRIEVANCE_OFFICER,
  legalMailto,
  LEGAL_EMAIL,
  OPERATOR_COUNTRY,
  OPERATOR_DESCRIPTION,
} from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of service",
  description: "The terms you agree to by using SortedChoice.",
  alternates: { canonical: "/terms" },
};

const UPDATED = "2026-08-28";

export default function TermsPage() {
  return (
    <DocumentPage
      eyebrow="Legal"
      title="Terms of service"
      lede="The agreement between you and us. Written to be read, not to be survived."
      updated={UPDATED}
      path="/terms"
      sections={[
        {
          id: "what-this-is",
          title: "What this site is",
          body: (
            <>
              <p>
                SortedChoice publishes independent research and recommendations about consumer
                products. It is operated by {OPERATOR_DESCRIPTION}, contactable at{" "}
                <DocLink href={legalMailto("Terms of service")}>{LEGAL_EMAIL}</DocLink>. By using
                the site you agree to these terms.
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
                They are written for a general reader and they are not a finding of fact about any
                product. What is right for you turns on your use, your budget, what you already
                own, and where you are — all of which we cannot see. Our{" "}
                <DocLink href="/disclaimer">disclaimer</DocLink> sets out where our judgement stops
                and yours begins, and it forms part of these terms.
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
              SortedChoice. You are welcome to quote us with attribution and a link. Wholesale
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
          id: "complaints",
          title: "Complaints",
          body: (
            <>
              <p>
                Complaints about anything published here, about content another reader has posted,
                or about your personal data go to our {GRIEVANCE_OFFICER.role},{" "}
                {GRIEVANCE_OFFICER.name}, at{" "}
                <DocLink href={legalMailto("Grievance")}>{GRIEVANCE_OFFICER.email}</DocLink>. We
                acknowledge within 24 hours and resolve within 15 days.
              </p>
              <p>
                The full process — including what to put in a copyright or trademark notice, what
                happens if we have written about your product, and where to escalate if we get it
                wrong — is set out in{" "}
                <DocLink href="/grievance">grievance redressal</DocLink>. This is published under
                rule 3(2) of the Information Technology (Intermediary Guidelines and Digital Media
                Ethics Code) Rules, 2021.
              </p>
            </>
          ),
        },
        {
          id: "governing-law",
          title: "Governing law",
          body: (
            <>
              <p>
                These terms, and any dispute arising out of them or out of your use of the site,
                are governed by the laws of {OPERATOR_COUNTRY}, and the courts of{" "}
                {OPERATOR_COUNTRY} have exclusive jurisdiction.
              </p>
              <p>
                If you are a consumer resident elsewhere, this does not deprive you of the
                protection of any mandatory consumer law of your own country, and it does not take
                away a right to bring proceedings there where the law gives you one.
              </p>
              <p>
                If any part of these terms is found unenforceable, the rest continues to apply. A
                delay in enforcing a term is not a waiver of it.
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
          <DocLink href="/cookies">cookie policy</DocLink>,{" "}
          <DocLink href="/disclaimer">disclaimer</DocLink>, and{" "}
          <DocLink href="/affiliate-disclosure">affiliate disclosure</DocLink>.
        </p>
      }
    />
  );
}
