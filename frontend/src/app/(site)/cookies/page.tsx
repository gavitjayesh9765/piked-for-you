import type { Metadata } from "next";
import { DocumentPage, DocLink } from "@/components/layout/DocumentPage";

export const metadata: Metadata = {
  title: "Cookie policy",
  description: "Which cookies SortedChoice sets, what each one does, and how to refuse them.",
  alternates: { canonical: "/cookies" },
};

const UPDATED = "2026-09-02";

export default function CookiePolicyPage() {
  return (
    <DocumentPage
      eyebrow="Legal"
      title="Cookie policy"
      lede="A short list, because it is a short list."
      updated={UPDATED}
      path="/cookies"
      sections={[
        {
          id: "what",
          title: "What we set",
          body: (
            <>
              <p>
                Cookies are small files a site stores in your browser. We use as few as the site
                can function with, and none of them follow you across the web.
              </p>

              <h3>Strictly necessary</h3>
              <p>
                These make the site work. They cannot be switched off, and they do not require
                consent because without them there is no service.
              </p>
              <ul>
                <li>
                  <strong>Session and authentication</strong> — keeps you signed in as you move
                  between pages. Set only after you log in, and cleared when you log out.
                </li>
                <li>
                  <strong>Security</strong> — protects forms against cross-site request forgery and
                  helps us block automated abuse.
                </li>
                <li>
                  <strong>Theme preference</strong> — remembers whether you chose light or dark so
                  the page does not flash the wrong one on every visit.
                </li>
              </ul>

              <h3>Analytics</h3>
              <p>
                We measure readership two ways, and only one of them can set anything in your
                browser. Neither is used to identify you, and you can switch the one that sets
                cookies off in one click.
              </p>
              <ul>
                <li>
                  <strong>Our own counters</strong> — no cookie, no identifier, nothing stored in
                  your browser at all. We count that a page was read, not who read it, so there is
                  nothing that could be joined back to you and nothing to consent to.
                </li>
                <li>
                  <strong>Google Analytics</strong> — runs on every page and is{" "}
                  <strong>on by default</strong>. It sets <code>_ga</code> cookies, which last up
                  to two years and let it tell a returning reader from a new one. We rely on
                  legitimate interest for this rather than asking you first, because it measures
                  readership and nothing else — and you can switch it off at any time in{" "}
                  <DocLink href="/account/settings">your settings</DocLink>. Off, it goes
                  cookieless immediately: nothing stored, and nothing that can recognise you
                  between pages or between visits.
                </li>
              </ul>
              <p>
                Either way we ask Google for measurement only. Advertising features, ad
                personalisation and Google Signals are switched off in our configuration and are
                never switched on by your agreeing — so nothing here reaches an advertiser, and no
                profile is built about you.
              </p>

              <h3>What we do not set</h3>
              <p>
                No advertising cookies. No cross-site tracking pixels. No data brokers. Nothing
                sold to anyone.
              </p>
            </>
          ),
        },
        {
          id: "retailers",
          title: "Retailer links",
          body: (
            <>
              <p>
                When you follow a link to a retailer, that retailer may set its own cookies to
                record that you arrived from us — this is how affiliate commission is attributed,
                and it is described in our{" "}
                <DocLink href="/affiliate-disclosure">affiliate disclosure</DocLink>.
              </p>
              <p>
                Those cookies are the retailer&rsquo;s, set on the retailer&rsquo;s site, governed
                by the retailer&rsquo;s policy. We cannot read them and we do not receive your
                order contents back.
              </p>
            </>
          ),
        },
        {
          id: "control",
          title: "How to refuse them",
          body: (
            <>
              <ul>
                <li>
                  <strong>Analytics</strong> — one switch in{" "}
                  <DocLink href="/account/settings">your settings</DocLink>, on by default, off
                  whenever you want it off. It takes effect immediately, in every tab, without a
                  reload, and the choice is remembered. We do not put a cookie banner in front of
                  you to ask: a switch that is always in the same place is a better control than a
                  bar that appears once and then never again.
                </li>
                <li>
                  <strong>Everything else</strong> — your browser can block or clear cookies for
                  this site at any time. Blocking the strictly necessary ones will sign you out and
                  keep you signed out.
                </li>
              </ul>
              <p>
                Refusing analytics costs you nothing here. There is no paywall, no degraded
                experience, and no repeated nagging. If you would rather we did not measure you at
                all, the switch is the whole of it — there is nothing else to find.
              </p>
            </>
          ),
        },
      ]}
      footnote={
        <p>
          For the wider picture of what we hold and why, read the{" "}
          <DocLink href="/privacy">privacy policy</DocLink>.
        </p>
      }
    />
  );
}
