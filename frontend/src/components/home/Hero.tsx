import Image from "next/image";
import { ButtonLink } from "@/components/ui/Button";
import { SearchField } from "@/components/ui/SearchField";

/**
 * Hero (spec §14).
 *
 * Communicates the value proposition, not a sale. No discount banner, no
 * countdown, no "shop now" — the promise is that we did the research.
 *
 * Full-bleed: the image column runs to the true viewport edge on desktop while
 * the copy column stays inside the gutter, so the section uses the entire
 * display width without the text losing its measure.
 *
 * SIZING: on `lg` and up the section is capped to the space below the sticky
 * header stack (`100svh` minus nav and sub-nav) rather than growing to fit its
 * content. Everything down to the CTA row has to land above the fold on a 1080p
 * screen — a hero whose call to action needs a scroll is not doing its job.
 * `svh` rather than `vh` so mobile browser chrome doesn't push the CTA off-screen.
 *
 * MOBILE: the two columns stack, so a viewport-height cap would only stretch
 * the copy and a full-bleed image column would become a 300px slab the reader
 * has to scroll a whole screen to reach. Below `lg` the section is therefore
 * left at its natural height and the image demotes to a short banner card that
 * sits inside the gutter — enough to carry the product photography, not enough
 * to cost the reader a scroll.
 */
export function Hero() {
  return (
    <section className="relative border-b border-line bg-bg lg:min-h-[calc(100svh-var(--nav-h)-var(--subnav-h))]">
      <div className="grid h-full items-stretch lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        {/* --- Copy --- */}
        <div className="shell flex flex-col justify-center py-8 sm:py-12 lg:py-14">
          <div className="max-w-2xl">
            <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 sm:mb-6">
              <span className="rounded-full bg-editorial-bg px-3 py-1.5 font-label text-label-xs font-bold uppercase tracking-[0.14em] text-editorial-fg">
                Independent research
              </span>
              <span className="flex items-center gap-2 font-label text-label-xs font-semibold uppercase tracking-[0.14em] text-brand">
                <span className="inline-block h-px w-6 bg-brand" />
                No sponsored verdicts
              </span>
            </div>

            <h1 className="t-display text-ink">
              Stop researching.
              <br />
              Start deciding.
            </h1>

            <p className="mt-4 max-w-xl text-body-md text-ink-muted sm:mt-5 sm:text-body-lg">
              We read the reviews, compare the specs that actually matter, and tell you which
              products are worth your money — and which are not. Then you buy wherever you like.
            </p>

            <div className="mt-6 max-w-xl sm:mt-7">
              <SearchField size="lg" placeholder="What are you trying to buy?" />
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:mt-7 sm:flex-row sm:items-center sm:gap-4">
              <ButtonLink href="/top-picks" size="lg">
                Explore Top Picks →
              </ButtonLink>
              <ButtonLink href="/how-we-research" variant="ghost" size="lg">
                How we research
              </ButtonLink>
            </div>

            {/* Proof of the research layer, stated as data rather than adjectives.
                Drops away on short viewports so it can never be the thing that
                pushes the CTA below the fold. */}
            <dl className="mt-7 hidden max-w-lg grid-cols-3 gap-4 border-t border-line pt-6 sm:gap-6 lg:mt-9 [@media(min-height:800px)]:grid">
              {[
                ["340+", "Products researched"],
                ["28", "Categories covered"],
                ["0", "Paid placements"],
              ].map(([value, label]) => (
                <div key={label}>
                  <dt className="tabular text-headline-md font-bold text-ink">{value}</dt>
                  <dd className="mt-1 font-label text-label-xs uppercase tracking-[0.1em] text-ink-subtle">
                    {label}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {/* --- Image ---
            Below `lg` it is a short banner inset by the gutter, so it reads as a
            deliberate card closing the hero rather than an unattached slab. From
            `lg` it drops the inset and runs to the true viewport edge, filling
            the column. */}
        <div
          className="plate relative mx-gutter mb-8 h-40 overflow-hidden rounded-lg border border-line
                     sm:mb-12 sm:h-56
                     lg:mx-0 lg:mb-0 lg:h-auto lg:rounded-none lg:border-0"
        >
          <Image
            src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1600&q=80"
            alt=""
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover"
          />
          {/* Softens the seam between copy and image without dimming the product */}
          <div
            className="pointer-events-none absolute inset-0 hidden lg:block"
            style={{ background: "linear-gradient(to right, var(--c-bg), transparent 22%)" }}
          />
          <div className="dot-matrix pointer-events-none absolute inset-0 opacity-60" />
        </div>
      </div>
    </section>
  );
}
