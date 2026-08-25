import type { Metadata } from "next";
import { DocumentPage, DocLink } from "@/components/layout/DocumentPage";

export const metadata: Metadata = {
  title: "Report a review",
  description: "What we remove, what we do not, and how to report a review on SortedChoice.",
  alternates: { canonical: "/help/report" },
};

const UPDATED = "2026-08-20";

export default function ReportReviewPage() {
  return (
    <DocumentPage
      eyebrow="Support"
      title="Report a review"
      lede="What gets removed, what does not, and what happens after you press the button."
      updated={UPDATED}
      sections={[
        {
          id: "how",
          title: "How to report one",
          body: (
            <>
              <p>
                Every published review carries a report control. Open the product page, find the
                review, and use the report action on it — that attaches the review to your report
                automatically, which is the fastest route to a human.
              </p>
              <p>
                If you cannot reach the control, or you are reporting a pattern across several
                reviews rather than a single one,{" "}
                <DocLink href="/contact">contact us</DocLink> with the product page URL and what
                you have noticed.
              </p>
            </>
          ),
        },
        {
          id: "grounds",
          title: "What we remove",
          body: (
            <>
              <p>A review comes down when it:</p>
              <ul>
                <li>
                  is written by someone with an undisclosed commercial interest in the product —
                  the manufacturer, a seller, or anyone paid to post it;
                </li>
                <li>
                  is part of a coordinated attempt to move a rating, in either direction, whether
                  by multiple accounts or an organised campaign;
                </li>
                <li>contains abuse, harassment, or targets a person rather than the product;</li>
                <li>publishes someone&rsquo;s personal information;</li>
                <li>is unlawful, or infringes someone else&rsquo;s rights;</li>
                <li>is plainly not about the product it is attached to.</li>
              </ul>
            </>
          ),
        },
        {
          id: "not-grounds",
          title: "What we do not remove",
          body: (
            <>
              <p>
                We do not remove a review for being <strong>negative</strong>, for{" "}
                <strong>disagreeing with our verdict</strong>, or for being{" "}
                <strong>inconvenient to a brand</strong>. Those are the reviews the system exists
                to protect.
              </p>
              <p>
                We also do not edit review text to soften it. A review is either published as
                written or removed with a reason — quietly rewriting what someone said would be
                worse than either.
              </p>
              <p>
                &ldquo;This review is wrong&rdquo; is not a ground for removal. If you disagree
                with an owner&rsquo;s experience, the useful answer is to add your own.
              </p>
            </>
          ),
        },
        {
          id: "after",
          title: "What happens next",
          body: (
            <>
              <ol>
                <li>
                  Your report is queued for a moderator. Reporting does not hide the review — a
                  single report cannot remove anything, or the button would become a weapon.
                </li>
                <li>
                  A person assesses it against the grounds above, and against the wider{" "}
                  <DocLink href="/editorial-policy">editorial policy</DocLink>.
                </li>
                <li>
                  The review is removed, or it stays. Where we can, we tell you which — though we
                  will not share details about another person&rsquo;s account.
                </li>
                <li>
                  Where a report reveals a coordinated campaign, we look at the accounts behind it
                  rather than only the review you flagged.
                </li>
              </ol>
              <p>
                Reports made in bad faith — mass-reporting critical reviews of your own product,
                for instance — are themselves a breach of the{" "}
                <DocLink href="/terms">terms of service</DocLink>.
              </p>
            </>
          ),
        },
        {
          id: "urgent",
          title: "If it is urgent",
          body: (
            <p>
              Content that puts someone at risk, or that is unlawful and needs immediate
              attention, should go to <DocLink href="/contact">us directly</DocLink> rather than
              through the normal queue. Say clearly that it is urgent and why, and include the
              page URL.
            </p>
          ),
        },
      ]}
      footnote={
        <p>
          The full moderation rules live in the{" "}
          <DocLink href="/editorial-policy">editorial policy</DocLink>. For anything else, the{" "}
          <DocLink href="/help">help centre</DocLink> is the place to start.
        </p>
      }
    />
  );
}
