import type { Metadata } from "next";
import { DocumentPage, DocLink } from "@/components/layout/DocumentPage";
import {
  GRIEVANCE_ACKNOWLEDGE_HOURS,
  GRIEVANCE_OFFICER,
  GRIEVANCE_RESOLVE_DAYS,
  legalMailto,
  LEGAL_EMAIL,
  OPERATOR_COUNTRY,
  OPERATOR_DESCRIPTION,
} from "@/lib/legal";

export const metadata: Metadata = {
  title: "Grievance redressal",
  description:
    "Who to write to, what happens when you do, and how to report content, a copyright or trademark issue, or a page about your own product.",
  alternates: { canonical: "/grievance" },
};

const UPDATED = "2026-08-28";

/**
 * Grievance redressal.
 *
 * ---------------------------------------------------------------------------
 * WHY A NAMED PERSON AND AN EMAIL, WHEN /contact ALREADY EXISTS
 *
 * /contact is a form. A form is the right front door for "help me choose a
 * laptop" and the wrong one for every complaint that carries a deadline,
 * because a form gives the complainant no address, no name, and no evidence
 * they ever wrote — and the first three things a rights holder, a regulator or
 * an angry brand does is ask for exactly those.
 *
 * The Information Technology (Intermediary Guidelines and Digital Media Ethics
 * Code) Rules, 2021 settle it: r.3(2) requires an intermediary to PUBLISH the
 * name and contact details of a Grievance Officer, acknowledge a complaint
 * within 24 hours, and dispose of it within 15 days. This site hosts reader
 * reviews and images, so it is squarely within that. The DPDP Act 2023 adds
 * the same requirement from the data-protection side.
 *
 * On a one-person site the officer is the operator, and saying so is better
 * than inventing a compliance department. All the identity lives in
 * lib/legal.ts so that one edit moves it everywhere.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS PAGE IS CAREFUL NOT TO PROMISE
 *
 * A takedown route on a review site is an invitation to use it as a
 * reputation-management channel — the complaint that means "this verdict is
 * unflattering, remove it". So §05 states the boundary plainly and in advance:
 * factual errors get corrected, unlawful content gets removed, and a negative
 * opinion honestly held is not either of those things. Publishing the limit is
 * what keeps the process usable for real complaints.
 */
export default function GrievancePage() {
  return (
    <DocumentPage
      eyebrow="Legal"
      title="Grievance redressal"
      lede="A named person, a real address, and a clock. What to write, what we do with it, and what we will not do."
      updated={UPDATED}
      path="/grievance"
      sections={[
        {
          id: "officer",
          title: "Who to write to",
          body: (
            <>
              <p>
                SortedChoice is operated by {OPERATOR_DESCRIPTION}. Complaints about anything
                published on the site, about content another reader has posted, or about your own
                personal data go to the Grievance Officer:
              </p>
              <ul>
                <li>
                  <strong>{GRIEVANCE_OFFICER.role}:</strong> {GRIEVANCE_OFFICER.name}
                </li>
                <li>
                  <strong>Email:</strong>{" "}
                  <DocLink href={legalMailto("Grievance")}>{GRIEVANCE_OFFICER.email}</DocLink>
                </li>
                <li>
                  <strong>Jurisdiction:</strong> {OPERATOR_COUNTRY}
                </li>
              </ul>
              <p>
                This is published under rule 3(2) of the Information Technology (Intermediary
                Guidelines and Digital Media Ethics Code) Rules, 2021, and serves as the contact
                for data-protection grievances under the Digital Personal Data Protection Act,
                2023.
              </p>
              <p>
                Anything that is not a complaint — a research request, a question, a tip — is
                better sent through <DocLink href="/contact">the contact form</DocLink>, which is
                read by the same person and is easier to answer.
              </p>
            </>
          ),
        },
        {
          id: "what-happens",
          title: "What happens when you write",
          body: (
            <>
              <ul>
                <li>
                  <strong>Within {GRIEVANCE_ACKNOWLEDGE_HOURS} hours</strong> — we acknowledge
                  your complaint and give it a reference.
                </li>
                <li>
                  <strong>Within {GRIEVANCE_RESOLVE_DAYS} days</strong> — we resolve it, and tell
                  you what we did and why. If we decided against you, you get the reasoning, not
                  a form letter.
                </li>
                <li>
                  <strong>Faster where the law requires it.</strong> Content that is unlawful on
                  its face — and in particular any material that impersonates a person or exposes
                  someone&rsquo;s body or private life without consent — is removed on receipt of
                  a valid complaint, well inside the statutory 24-hour window, rather than at the
                  end of the 15 days.
                </li>
              </ul>
              <p>To help us act inside those windows, please include:</p>
              <ul>
                <li>the exact URL of the page, and where on it the problem is;</li>
                <li>what specifically is wrong — a quoted sentence beats a general objection;</li>
                <li>what you would like done about it;</li>
                <li>
                  who you are and, if you are acting for someone else, on whose behalf. Anonymous
                  complaints are read, but we cannot report an outcome back to nobody.
                </li>
              </ul>
            </>
          ),
        },
        {
          id: "content",
          title: "Reporting content on the site",
          body: (
            <>
              <p>
                Most of what gets reported is a reader review. There is a{" "}
                <DocLink href="/help/report">dedicated form for that</DocLink> and it is the
                fastest route. The grounds we act on are the ones in our{" "}
                <DocLink href="/editorial-policy#community">editorial policy</DocLink>: a review
                goes when it is written by someone with a commercial interest, is part of a
                coordinated attempt to move a rating, contains abuse, personal information or
                unlawful material, or is plainly not about the product.
              </p>
              <p>
                We do not remove a review for being negative, and we do not edit review text to
                soften it. If yours was removed and you think that was wrong, say so here and a
                person will look again.
              </p>
            </>
          ),
        },
        {
          id: "ip",
          title: "Copyright, trademark and image complaints",
          body: (
            <>
              <p>
                If you own rights in something published here — an image, text, a mark — and
                believe it is used without permission, write to{" "}
                <DocLink href={legalMailto("IP complaint")}>{LEGAL_EMAIL}</DocLink> with:
              </p>
              <ul>
                <li>identification of the work or mark, and of your right in it;</li>
                <li>the exact URL where it appears on this site;</li>
                <li>
                  a statement that the use is not authorised by you, your agent, or the law;
                </li>
                <li>
                  a statement that the information in your notice is accurate, and that you are
                  the rights holder or authorised to act for them;
                </li>
                <li>your name, address and a contact address, and an electronic signature.</li>
              </ul>
              <p>
                We remove or disable access to properly notified material promptly while we look
                at it. Where the material was supplied by a reader we tell them, so they can
                respond — a takedown with no counter-route is a takedown anyone can abuse.
              </p>
              <p>
                Product names, brand names, logos and product imagery appear on this site to
                identify the products under discussion. That is nominative use, not a claim of
                affiliation or approval, and it is set out in the{" "}
                <DocLink href="/disclaimer#third-parties">disclaimer</DocLink>.
              </p>
            </>
          ),
        },
        {
          id: "brands",
          title: "If we have written about your product",
          body: (
            <>
              <p>
                Brands and manufacturers are welcome here, and we would rather hear from you than
                not. Two routes, and the difference between them matters:
              </p>
              <ul>
                <li>
                  <strong>A factual error</strong> — a wrong specification, a discontinued
                  variant, a price that was never real, a claim about your product that is not
                  true. Send the correction with a source and we will fix the page and record the
                  change, under our{" "}
                  <DocLink href="/editorial-policy#corrections">corrections policy</DocLink>.
                  This is the route that works, and it is fast.
                </li>
                <li>
                  <strong>A verdict you disagree with</strong> — you are entitled to make the
                  case, and we will read it. But an unflattering conclusion honestly reached from
                  stated evidence is an opinion, not a defect, and it is not removed or softened
                  because a brand asked. Nothing on this site is for sale, including a rewrite.
                </li>
              </ul>
              <p>
                We do not offer copy approval, advance sight of a verdict, or the right to
                comment before publication — the reasons are in our{" "}
                <DocLink href="/editorial-policy#independence">editorial policy</DocLink>. If
                continued access to a product were ever made conditional on favourable coverage,
                we would lose the access and say so on the page.
              </p>
            </>
          ),
        },
        {
          id: "data",
          title: "Complaints about your personal data",
          body: (
            <>
              <p>
                Requests to see, correct, port or delete your data — and complaints about how we
                handled one — go to the same address. Most of it you can do yourself from{" "}
                <DocLink href="/account/settings">your account settings</DocLink>; anything else,
                write to{" "}
                <DocLink href={legalMailto("Data request")}>{LEGAL_EMAIL}</DocLink> and we will
                respond within 30 days.
              </p>
              <p>
                What we hold, why we are allowed to hold it, and how long it stays is set out in
                the <DocLink href="/privacy">privacy policy</DocLink>. Exercising a right never
                makes the site worse for you.
              </p>
            </>
          ),
        },
        {
          id: "escalation",
          title: "If we do not resolve it",
          body: (
            <>
              <p>
                Our decision is not the end of the road, and we would rather point you at the exit
                than pretend there is not one.
              </p>
              <ul>
                <li>
                  <strong>Personal data</strong> — a complaint we fail to resolve may be taken to
                  the Data Protection Board of India under the DPDP Act, 2023. Readers in the
                  EU or UK may complain to their own supervisory authority.
                </li>
                <li>
                  <strong>Content</strong> — the grievance appellate mechanism under the IT Rules,
                  2021 is available where an intermediary&rsquo;s decision on a content complaint
                  is disputed.
                </li>
                <li>
                  <strong>Anything else</strong> — the courts of {OPERATOR_COUNTRY}, per our{" "}
                  <DocLink href="/terms#governing-law">terms of service</DocLink>.
                </li>
              </ul>
            </>
          ),
        },
      ]}
      footnote={
        <p>
          This page exists so that a complaint has somewhere to go that is not a form and not a
          silence. If you have written and heard nothing inside the windows above, write again to{" "}
          <DocLink href={legalMailto("Grievance — no response")}>{LEGAL_EMAIL}</DocLink> and say
          so — that is a failure on our side and we would like to know about it.
        </p>
      }
    />
  );
}
