import type { Metadata } from "next";
import { DocumentPage, DocLink } from "@/components/layout/DocumentPage";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "What SortedChoice collects, why, how long it is kept, and how to get it deleted.",
  alternates: { canonical: "/privacy" },
};

const UPDATED = "2026-08-20";

export default function PrivacyPage() {
  return (
    <DocumentPage
      eyebrow="Legal"
      title="Privacy policy"
      lede="What we collect, why we collect it, and how to make us delete it."
      updated={UPDATED}
      path="/privacy"
      sections={[
        {
          id: "principle",
          title: "The principle",
          body: (
            <>
              <p>
                We collect the minimum needed to run the site, and we do not sell personal data to
                anyone. You can read every verdict on SortedChoice without an account, without
                logging in, and without telling us who you are.
              </p>
            </>
          ),
        },
        {
          id: "what-we-collect",
          title: "What we collect",
          body: (
            <>
              <h3>If you never make an account</h3>
              <p>
                Standard server and security logs — IP address, browser user agent, the pages
                requested, and timestamps. These exist to keep the service running and to detect
                abuse.
              </p>

              <h3>If you make an account</h3>
              <ul>
                <li>
                  <strong>Email address</strong>, and a password stored only as a cryptographic
                  hash — we never hold your password itself. If you sign in with a provider such as
                  Google, we receive your email address and basic profile from them, not your
                  provider password.
                </li>
                <li>
                  <strong>Things you choose to save</strong> — saved products, category
                  preferences, and notification settings.
                </li>
                <li>
                  <strong>Reviews and ratings you submit</strong>, including any images you attach.
                  These are published, so treat their contents as public.
                </li>
              </ul>

              <h3>If you contact us or subscribe</h3>
              <p>
                Your email address and whatever you write in the message. Newsletter subscription
                is double opt-in: we record the confirmation so we can prove consent.
              </p>
            </>
          ),
        },
        {
          id: "why",
          title: "Why we are allowed to hold it",
          body: (
            <>
              <ul>
                <li>
                  <strong>To provide the service you asked for</strong> — your account, your saved
                  items, your reviews. Without this data those features cannot exist.
                </li>
                <li>
                  <strong>Because you consented</strong> — newsletter email and any non-essential
                  analytics. Withdrawable at any time, and withdrawing is as easy as giving it.
                </li>
                <li>
                  <strong>Because we have a legitimate interest</strong> — keeping the site up,
                  preventing fraud and review manipulation, and understanding in aggregate which
                  pages are useful.
                </li>
                <li>
                  <strong>Because the law requires it</strong> — records we are obliged to keep.
                </li>
              </ul>
            </>
          ),
        },
        {
          id: "sharing",
          title: "Who else touches it",
          body: (
            <>
              <p>
                We use service providers to operate the site. They process data on our instructions
                and may not use it for their own purposes:
              </p>
              <ul>
                <li>
                  <strong>Supabase</strong> — database, authentication, and file storage.
                </li>
                <li>
                  <strong>Our hosting and CDN provider</strong> — serving the site and absorbing
                  attacks.
                </li>
                <li>
                  <strong>Our email provider</strong> — account emails and, if you asked for it,
                  the newsletter.
                </li>
              </ul>
              <p>
                <strong>We do not sell your data.</strong> When you follow a link to a retailer you
                leave our site and that retailer&rsquo;s own privacy policy applies — we do not
                pass them your account details, and we do not receive your order contents back.
                See the <DocLink href="/affiliate-disclosure">affiliate disclosure</DocLink>.
              </p>
            </>
          ),
        },
        {
          id: "how-long",
          title: "How long we keep it",
          body: (
            <ul>
              <li>
                <strong>Account data</strong> — until you delete your account, then removed within
                30 days except where we must retain something by law.
              </li>
              <li>
                <strong>Published reviews</strong> — these survive account deletion in anonymised
                form, because removing them would silently rewrite a product&rsquo;s rating
                history. Ask us and we will remove them outright.
              </li>
              <li>
                <strong>Server logs</strong> — a rolling window, typically 30 days.
              </li>
              <li>
                <strong>Contact messages</strong> — up to 24 months, so we can follow up.
              </li>
            </ul>
          ),
        },
        {
          id: "your-rights",
          title: "Your rights",
          body: (
            <>
              <p>You can ask us to:</p>
              <ul>
                <li>show you a copy of everything we hold about you;</li>
                <li>correct anything that is wrong;</li>
                <li>delete your data, and your account with it;</li>
                <li>stop using it for a particular purpose, or restrict it while we investigate;</li>
                <li>hand it over in a portable, machine-readable format.</li>
              </ul>
              <p>
                Most of this you can do yourself from{" "}
                <DocLink href="/account/settings">your account settings</DocLink>. For anything
                else, <DocLink href="/contact">ask us</DocLink> and we will respond within 30 days.
                We will not make the site worse for you because you exercised a right.
              </p>
            </>
          ),
        },
        {
          id: "security",
          title: "Security",
          body: (
            <>
              <p>
                Traffic is encrypted in transit. Passwords are hashed, never stored in a readable
                form. Access to production data is restricted to the people who need it, protected
                by multi-factor authentication, and logged.
              </p>
              <p>
                No system is perfect. If we discover a breach affecting your data we will tell you
                and the relevant regulator, without burying it in a changelog.
              </p>
            </>
          ),
        },
        {
          id: "children",
          title: "Children",
          body: (
            <p>
              SortedChoice is not intended for children under 13, and we do not knowingly collect
              their data. If you believe a child has given us personal information,{" "}
              <DocLink href="/contact">tell us</DocLink> and we will delete it.
            </p>
          ),
        },
        {
          id: "changes",
          title: "Changes to this policy",
          body: (
            <p>
              When this policy changes we update the effective date at the top. For changes that
              materially affect your rights we will tell account holders directly rather than
              relying on you to re-read the page.
            </p>
          ),
        },
      ]}
      footnote={
        <p>
          Questions about any of this, or want to exercise a right?{" "}
          <DocLink href="/contact">Contact us</DocLink>. See also our{" "}
          <DocLink href="/cookies">cookie policy</DocLink> and{" "}
          <DocLink href="/terms">terms of service</DocLink>.
        </p>
      }
    />
  );
}
