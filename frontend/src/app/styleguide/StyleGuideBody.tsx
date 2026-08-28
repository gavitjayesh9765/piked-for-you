import { products, badges } from "@/lib/mock/data";
import { Button, RetailButton } from "@/components/ui/Button";
import { Badge, CommunityRating, StatusPill, ValueChip } from "@/components/ui/Badge";
import { ProductCard, ProductCardSkeleton } from "@/components/product/ProductCard";
import { ScoreBreakdown, ScoreRing } from "@/components/product/ScoreRing";
import { SearchField } from "@/components/ui/SearchField";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { CategoryIcon } from "@/components/ui/CategoryIcon";

/**
 * The style guide itself, split out from ./page so that its fixture import can
 * live inside an `if (USE_MOCKS)` branch there.
 *
 * The static import above is deliberate and safe: this whole module is
 * unreachable except through that branch, so when mocks are off the bundler
 * never follows the edge and neither this file nor the fixtures reach a chunk.
 * Keeping the import static here also means the component below reads as
 * ordinary JSX rather than being restructured around an await.
 */
export function StyleGuideBody() {
  return (
    <div className="min-h-screen bg-bg">
      <header className="glass sticky top-0 z-nav">
        <div className="shell flex h-nav items-center justify-between">
          <div>
            <p className="font-display text-headline-sm font-black tracking-[-0.04em] text-ink">
              SortedChoice
            </p>
            <p className="t-eyebrow">Design system</p>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="shell-wide space-y-20 py-16">
        <Block
          title="Colour grammar"
          note="Purple decides, orange gets, green signals value, obsidian carries authority. A control's colour tells you what kind of thing it is before you read it."
        >
          <div className="grid gap-6 lg:grid-cols-4">
            <Grammar
              name="Deciding"
              hex="--c-brand-fill"
              desc="Our intelligence. Scores, verdicts, PickD moments, internal actions."
            />
            <Grammar
              name="Getting"
              hex="--c-retail-fill"
              desc="Outbound to a retailer. Amazon, Flipkart. Never an internal control."
            />
            <Grammar name="Value" hex="--c-value-fill" desc="Worth-it markers, in-stock, good-price signals." />
            <Grammar name="Editorial" hex="--c-editorial-bg" desc="Curatorial authority. Badges, structure." />
          </div>
        </Block>

        <Block title="Surfaces & ink" note="Elevation is tonal layering plus a hairline — not a drop shadow.">
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <p className="t-eyebrow mb-4">Surfaces</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {["--c-bg", "--c-surface-0", "--c-surface-1", "--c-surface-2", "--c-surface-3"].map((v) => (
                  <Swatch key={v} token={v} />
                ))}
              </div>
            </div>
            <div>
              <p className="t-eyebrow mb-4">Ink</p>
              <div className="space-y-1.5">
                {[
                  ["text-ink", "Primary — headlines, values"],
                  ["text-ink-muted", "Secondary — body, descriptions"],
                  ["text-ink-subtle", "Metadata, placeholders"],
                  ["text-ink-faint", "Disabled, tertiary"],
                ].map(([cls, label]) => (
                  <p key={cls} className={`${cls} text-body-md`}>
                    {label}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </Block>

        <Block title="Typography" note="Four faces, four jobs. Numerals are always tabular so columns align.">
          <div className="space-y-6">
            <div>
              <p className="t-eyebrow mb-2">Display · Hanken Grotesk</p>
              <p className="t-display text-ink">Research less. Choose better.</p>
            </div>
            <div>
              <p className="t-eyebrow mb-2">Headline · Hanken Grotesk</p>
              <p className="t-headline text-ink">Top Picks right now</p>
            </div>
            <div>
              <p className="t-eyebrow mb-2">Body · Inter</p>
              <p className="max-w-prose text-body-lg text-ink-muted">
                We read the reviews, compare the specs that actually matter, and tell you which products
                are worth your money — and which are not.
              </p>
            </div>
            <div>
              <p className="t-eyebrow mb-2">Data · Geist Mono, tabular</p>
              <div className="tabular flex gap-8 text-headline-sm text-ink">
                <span>₹24,990</span>
                <span>₹1,14,900</span>
                <span>9.4 / 10</span>
              </div>
            </div>
          </div>
        </Block>

        <Block title="PickD Score" note="Our evaluation, 0–10. Never merged with a community star rating (spec §32).">
          <div className="flex flex-wrap items-end gap-10">
            <ScoreRing score={9.4} size="sm" />
            <ScoreRing score={8.8} size="md" />
            <ScoreRing score={7.2} size="lg" />
            <ScoreRing score={9.1} size="xl" />
            <div className="panel min-w-[280px] flex-1 p-6">
              <p className="t-eyebrow mb-4 text-brand">Breakdown</p>
              <ScoreBreakdown
                criteria={[
                  { key: "sound", label: "Sound", value: 9.2 },
                  { key: "anc", label: "Noise cancellation", value: 9.6 },
                  { key: "value", label: "Value", value: 8.4 },
                ]}
              />
            </div>
          </div>
        </Block>

        <Block title="Buttons" note="RetailButton is the only orange control in the system, and it always leaves the site.">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="brand">Explore Top Picks</Button>
              <Button variant="editorial">Log in</Button>
              <Button variant="outline">Write a review</Button>
              <Button variant="subtle">Filters</Button>
              <Button variant="ghost">How we research</Button>
              <Button variant="brand" disabled>
                Disabled
              </Button>
            </div>
            <div className="grid max-w-xl gap-3">
              <RetailButton retailer="Amazon" href="#" price="₹24,990" />
              <RetailButton retailer="Flipkart" href="#" price="₹25,499" emphasis="secondary" />
            </div>
          </div>
        </Block>

        <Block title="Badges & signals" note="Badges are admin-created content; the admin picks a style token, never a colour.">
          <div className="flex flex-wrap items-center gap-3">
            <Badge badge={badges.top} />
            <Badge badge={badges.editors} />
            <Badge badge={badges.value} />
            <Badge badge={badges.gaming} />
            <Badge badge={badges.fresh} />
            <ValueChip />
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            {["published", "draft", "archived", "pending", "rejected"].map((s) => (
              <StatusPill key={s} status={s} />
            ))}
          </div>
          <div className="mt-6">
            <CommunityRating average={4.6} count={128} />
          </div>
        </Block>

        <Block title="Search" note="Rule only, no fill. The hairline draws itself purple on focus.">
          <div className="max-w-2xl space-y-8">
            <SearchField />
            <SearchField size="lg" placeholder="What are you trying to buy?" />
          </div>
        </Block>

        <Block title="Icons" note="Linear, 1.7px stroke, rounded terminals — matched to the type.">
          <div className="flex flex-wrap gap-6 text-ink-muted">
            {[
              "headphones", "laptop", "smartphone", "gamepad", "camera", "watch", "home", "cable",
              "monitor", "speaker", "tv", "wifi", "mic", "cpu", "printer", "keyboard", "mouse",
              "chair", "vr", "drone", "lock", "chef-hat", "oven", "coffee", "blender", "pot",
              "fridge", "washer", "fan", "droplet",
            ].map(
              (n) => (
                <div key={n} className="flex flex-col items-center gap-2">
                  <CategoryIcon name={n} className="h-6 w-6" />
                  <span className="text-label-xs text-ink-faint">{n}</span>
                </div>
              ),
            )}
          </div>
        </Block>

        <Block
          title="Product card"
          note="The tagline is load-bearing: it is what makes this a recommendation rather than a listing."
        >
          <div className="grid-products">
            {products.slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
            <ProductCardSkeleton />
          </div>
        </Block>

        <Block title="Layout scale" note="The shell is fluid. Maximums are applied per content type, not globally.">
          <div className="space-y-3">
            {[
              ["shell", "Full — edge to edge, gutter only"],
              ["shell-wide", "Wide — fluid, soft cap 1920px"],
              ["shell-content", "Content — max 1100px"],
            ].map(([cls, label]) => (
              <div key={cls} className={`${cls} border border-dashed border-brand-line bg-brand-soft px-4 py-3`}>
                <span className="font-mono text-label-xs text-brand-on-soft">.{cls}</span>
                <span className="ml-3 text-body-sm text-ink-muted">{label}</span>
              </div>
            ))}
            <p className="shell-prose border border-dashed border-brand-line bg-brand-soft px-4 py-3 text-body-sm text-ink-muted">
              <span className="font-mono text-label-xs text-brand-on-soft">.shell-prose</span> — the 72ch
              reading measure. Verdicts and reviews live here, because a full-bleed grid is good and a
              full-bleed paragraph is not.
            </p>
          </div>
        </Block>
      </main>
    </div>
  );
}

function Block({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-8 border-b border-line pb-5">
        <h2 className="t-headline text-ink">{title}</h2>
        {note && <p className="mt-2 max-w-3xl text-body-sm text-ink-muted">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function Grammar({ name, hex, desc }: { name: string; hex: string; desc: string }) {
  return (
    <div>
      <div className="h-24 rounded-lg border border-line" style={{ backgroundColor: `var(${hex})` }} />
      <p className="mt-3 font-label text-label font-semibold uppercase tracking-[0.08em] text-ink">{name}</p>
      <p className="mt-1 font-mono text-label-xs text-ink-faint">{hex}</p>
      <p className="mt-2 text-body-sm text-ink-muted">{desc}</p>
    </div>
  );
}

function Swatch({ token }: { token: string }) {
  return (
    <div>
      <div className="h-16 rounded-sm border border-line" style={{ backgroundColor: `var(${token})` }} />
      <p className="mt-2 font-mono text-[10px] text-ink-faint">{token.replace("--c-", "")}</p>
    </div>
  );
}
