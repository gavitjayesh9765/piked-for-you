import { BarChart } from "@/components/guides/BarChart";
import { Callout, DataTable } from "@/components/guides/Prose";
import { DocLink } from "@/components/layout/DocumentPage";

import { GPUS, GPU_METRICS, GPU_SOURCE, VERIFIED } from "./data";
import type { Guide } from "./types";

/**
 * The commercially strongest of the three, because it ends somewhere specific.
 *
 * A phone chip guide ends at "buy a phone". This one ends at "your monitor
 * decides your card", which routes into gaming monitors — a category with high
 * prices, real technical differentiation and buyers who already accept that
 * research is necessary. The monitor-matching table is therefore the
 * destination the whole article is built towards, not a closing aside.
 */
export const guide: Guide = {
  slug: "graphics-cards-explained",

  title: "GPU tiers: what each card runs at 1080p, 1440p, 4K",
  heading: "Graphics cards, and how to buy the right amount of one",
  description:
    "What each current graphics card actually manages at 1080p, 1440p and 4K — how to read the names, how much memory you need, and why your monitor should choose the card.",

  dek: "A graphics card is not fast or slow in the abstract. It is fast or slow at a resolution and a frame rate, and those are decided by the screen you already own.",
  eyebrow: "Guides · Silicon",

  published: "2026-08-29",
  updated: "2026-08-29",

  answer:
    "Choose the card from the monitor, not the other way round. At 1080p and 60Hz almost any current card is enough and anything above the mid-range is wasted; at 1440p and high refresh you want an upper-mid-range card such as an RTX 5070 or RX 7800 XT; at 4K you need the top tier or you will be relying on upscaling to reach playable frame rates. Memory matters as much as raw speed above 1080p — 8 GB is now the practical floor and 12 GB is the safer buy — and manufacturer performance claims almost always assume upscaling and frame generation are switched on.",

  takeaways: [
    "Resolution multiplies the work. Going from 1080p to 1440p costs roughly 40% of your frame rate; going to 4K costs more than half again.",
    "Video memory is a cliff, not a slope. A card with enough runs fine and a card with too little stutters badly — there is very little middle ground.",
    "Upscaling is genuinely good and is not free. It is also how nearly every manufacturer comparison is made to look better than it is.",
    "Above the mid-range, the card is usually not what is limiting you. A 60Hz monitor caps everything at 60 frames regardless of what you paid.",
  ],

  entities: {
    brands: ["asus"],
    categories: [
      "/c/electronics/gaming/gaming-monitors",
      "/c/electronics/computers/monitors",
    ],
  },

  next: [
    {
      href: "/c/electronics/gaming/gaming-monitors",
      label: "Gaming monitors, ranked",
      note: "High refresh rates and the response times to match — the half that decides your card.",
    },
    {
      href: "/c/electronics/computers/monitors",
      label: "Monitors for work",
      note: "Panels rated on colour, motion and how they treat your eyes.",
    },
    {
      href: "/c/electronics/gaming/consoles",
      label: "Consoles, compared",
      note: "The alternative to all of this, and which one suits how you actually play.",
    },
    {
      href: "/c/electronics/computers/laptops",
      label: "Laptops, ranked",
      note: "Where a mobile version of the same card behaves quite differently.",
    },
  ],

  related: ["laptop-processors-explained", "smartphone-processors-explained"],

  sections: [
    {
      id: "resolution",
      title: "Resolution and refresh rate decide everything",
      body: (
        <>
          <p>
            A graphics card draws a frame. How much work that takes depends on how many pixels
            are in the frame, and how many frames per second you want. Those two numbers are
            properties of your monitor, not of the card — which is why buying a card without
            knowing them is guesswork.
          </p>

          <DataTable
            caption="What each resolution costs"
            columns={[
              { key: "res", label: "Resolution" },
              { key: "px", label: "Pixels per frame", numeric: true },
              { key: "rel", label: "Work vs 1080p", numeric: true },
            ]}
            rows={[
              { res: "1920 × 1080 (1080p)", px: "2.07 M", rel: "1.0×" },
              { res: "2560 × 1440 (1440p)", px: "3.69 M", rel: "1.8×" },
              { res: "3840 × 2160 (4K)", px: "8.29 M", rel: "4.0×" },
            ]}
            note="Pixel count is the theoretical cost. In practice the frame rate drop is smaller than the ratio suggests, because not all of the work scales with resolution."
          />

          <p>
            Then multiply by frame rate. A 144Hz monitor at 1440p is asking for roughly four
            times the work of a 60Hz monitor at 1080p. That is the entire reason cards span
            ₹20,000 to ₹2,50,000.
          </p>

          <Callout tone="watch" title="The most common wasted upgrade">
            <p>
              Buying an expensive card while keeping a 60Hz monitor. The screen will show 60
              frames per second no matter how many the card produces, so everything above that
              is discarded. If your monitor is 60Hz, a{" "}
              <DocLink href="/c/electronics/gaming/gaming-monitors">better monitor</DocLink> is
              a larger and cheaper improvement than a better card.
            </p>
          </Callout>
        </>
      ),
    },

    {
      id: "numbers",
      title: "What each card actually manages",
      body: (
        <>
          <p>
            Below is average frame rate across a basket of recent games at maximum settings,
            rendered natively — no upscaling, no frame generation. Switch resolution and watch
            the whole chart collapse.
          </p>

          <BarChart
            title="Graphics cards, average frames per second"
            metrics={GPU_METRICS}
            rows={GPUS}
            source={GPU_SOURCE}
            verified={VERIFIED}
          />

          <p>
            The collapse is the useful part. At 1080p every card on this chart clears 60 frames
            per second and most clear 100 — the differences are real but they are differences
            between &ldquo;smooth&rdquo; and &ldquo;smoother&rdquo;. At 4K the bottom half of
            the chart falls below 30, which is not playable, and only the top few clear 60.
          </p>

          <p>
            This is why the honest answer to &ldquo;is this card good&rdquo; is always a
            question in return. An RTX 4060 is an excellent 1080p card and a poor 4K one, and
            both statements describe the same hardware.
          </p>

          <Callout tone="note" title="Why these numbers are lower than the ones you have seen">
            <p>
              Because upscaling and frame generation are switched off. Almost every published
              chart — and every manufacturer chart — has them on, frequently comparing a new
              card with frame generation against an older card without it. Native rendering is
              the only measure that compares three vendors and several generations on the same
              terms. Upscaling gets{" "}
              <DocLink href="#upscaling">its own section</DocLink> rather than being folded
              silently into the baseline.
            </p>
          </Callout>
        </>
      ),
    },

    {
      id: "naming",
      title: "Reading the name",
      body: (
        <>
          <p>
            Both vendors use a scheme that is readable once you know it, and both have a
            character that quietly moves a card a tier.
          </p>

          <DataTable
            caption="NVIDIA and AMD naming"
            columns={[
              { key: "part", label: "Part of the name" },
              { key: "example", label: "Example" },
              { key: "means", label: "What it tells you" },
            ]}
            rows={[
              {
                part: "Generation",
                example: "RTX 50xx, RX 9xxx",
                means: "First digit or two. Newer usually means better efficiency and features",
              },
              {
                part: "Tier",
                example: "xx90, xx80, xx70, xx60",
                means: "The second digit. This is the performance class, and the price",
              },
              {
                part: "Ti / Super",
                example: "RTX 5070 Ti",
                means: "NVIDIA. A meaningful step above the base card — closer to the tier above",
              },
              {
                part: "XT / XTX",
                example: "RX 7900 XTX",
                means: "AMD's equivalent. XTX is above XT is above the plain card",
              },
            ]}
          />

          <Callout tone="watch" title="A generation number does not beat a tier">
            <p>
              An <strong>RTX 5060</strong> is not automatically faster than an{" "}
              <strong>RTX 4070</strong>. The tier digit usually outweighs the generation digit
              — a previous-generation card one or two tiers higher is very often the better buy,
              and is frequently cheaper. Compare the actual frame rates, not the model numbers.
            </p>
          </Callout>

          <p>
            One further trap specific to laptops: a &ldquo;laptop RTX 4070&rdquo; and a desktop
            RTX 4070 are different chips with different power budgets, and the laptop version
            is substantially slower. Worse, two laptops with the same card can differ by thirty
            per cent depending on the power the manufacturer allows it — the same chassis
            problem that affects{" "}
            <DocLink href="/guides/laptop-processors-explained#chassis">laptop processors</DocLink>.
          </p>
        </>
      ),
    },

    {
      id: "vram",
      title: "Video memory, which behaves like a cliff",
      body: (
        <>
          <p>
            A graphics card has its own memory, and it holds the textures and geometry for the
            frame being drawn. Unlike processor speed, having slightly too little is not
            slightly worse — it is dramatically worse, because the card starts fetching data
            across the much slower connection to the rest of the computer.
          </p>

          <p>
            The symptom is distinctive and worth recognising: an average frame rate that looks
            fine, with sudden severe stutters, and textures that visibly load in late. That is
            memory exhaustion, not a slow card.
          </p>

          <DataTable
            caption="How much video memory you need"
            columns={[
              { key: "res", label: "Playing at" },
              { key: "min", label: "Floor", numeric: true },
              { key: "rec", label: "Comfortable", numeric: true },
              { key: "note", label: "Why" },
            ]}
            rows={[
              {
                res: "1080p",
                min: "8 GB",
                rec: "12 GB",
                note: "8 GB is now the minimum rather than the safe choice",
              },
              {
                res: "1440p",
                min: "10 GB",
                rec: "12–16 GB",
                note: "High textures at this resolution regularly exceed 10 GB",
              },
              {
                res: "4K",
                min: "12 GB",
                rec: "16 GB+",
                note: "Ray tracing and high-resolution textures together are memory-hungry",
              },
            ]}
            note="Requirements have risen sharply over the last few years and will keep rising. Buying at the floor is buying a card that will feel old sooner."
          />

          <Callout tone="buy" title="Where this decides a purchase">
            <p>
              When choosing between two similarly priced cards, the one with more memory is
              usually the better long-term buy even if it is marginally slower today. Raw speed
              degrades gracefully as games get heavier; insufficient memory does not.
            </p>
          </Callout>
        </>
      ),
    },

    {
      id: "upscaling",
      title: "Upscaling and frame generation, honestly",
      body: (
        <>
          <p>
            Modern cards can render at a lower resolution and reconstruct the image to your
            monitor's resolution — NVIDIA calls it DLSS, AMD calls it FSR, Intel calls it XeSS.
            A separate feature, frame generation, invents intermediate frames between rendered
            ones.
          </p>

          <p>
            <strong>Upscaling is genuinely good.</strong> At the higher quality settings the
            reconstructed image is often indistinguishable from native at normal viewing
            distance, and it can add forty per cent to your frame rate. It is not a
            compromise you should feel bad about using; it is one of the more useful things to
            happen to graphics in a decade.
          </p>

          <p>
            <strong>Frame generation is different and deserves more scepticism.</strong> The
            invented frames make motion look smoother but carry no new information about what
            you are doing, so input latency does not improve and can worsen slightly. Going
            from 30 to 60 &ldquo;frames&rdquo; this way still feels like 30 to your hands. It
            works best when the base frame rate is already decent — turning 60 into 120 — and
            worst where you would most want help.
          </p>

          <Callout tone="watch" title="How this gets used to mislead">
            <p>
              The standard manufacturer comparison shows a new card with frame generation
              against a previous card without it, and reports the ratio as a generational
              improvement. It is not a comparison of the hardware. When you see a claim of
              two or three times the performance, look for what was enabled on each side —
              it is usually in a footnote, in a smaller typeface, and it usually explains the
              entire gap.
            </p>
          </Callout>
        </>
      ),
    },

    {
      id: "match",
      title: "Matching the card to the monitor",
      body: (
        <>
          <p>
            This is the table the rest of the article exists to produce. Find your monitor;
            buy the card next to it.
          </p>

          <DataTable
            caption="Which card for which screen"
            columns={[
              { key: "screen", label: "Your monitor" },
              { key: "tier", label: "Card tier" },
              { key: "eg", label: "Which means" },
              { key: "note", label: "Note" },
            ]}
            rows={[
              {
                screen: "1080p, 60Hz",
                tier: "Entry",
                eg: "RTX 4060, RX 7600",
                note: "Anything more is discarded by the screen",
              },
              {
                screen: "1080p, 144Hz+",
                tier: "Lower mid",
                eg: "RTX 4060 Ti, RX 7700 XT",
                note: "Competitive shooters may want more; most games will not",
              },
              {
                screen: "1440p, 60–120Hz",
                tier: "Mid",
                eg: "RTX 4070, RX 7800 XT",
                note: "The best value bracket at the moment",
              },
              {
                screen: "1440p, 144Hz+",
                tier: "Upper mid",
                eg: "RTX 5070, RTX 4070 Super",
                note: "Expect to use upscaling in the heaviest titles",
              },
              {
                screen: "4K, 60Hz",
                tier: "Upper",
                eg: "RTX 5070 Ti, RX 7900 XTX",
                note: "Native 60 is achievable in most, not all, games",
              },
              {
                screen: "4K, 120Hz+",
                tier: "Top",
                eg: "RTX 5080, RTX 5090",
                note: "Upscaling is effectively mandatory at this target",
              },
            ]}
          />

          <p>
            If your monitor is not on this list — if it is a 60Hz office panel you have had for
            six years — then the monitor is the upgrade, not the card. A 1440p high-refresh
            screen transforms how a game feels far more than one tier of graphics card does,
            and it improves everything else you do with the computer at the same time. Ours are
            ranked on motion handling and panel quality in{" "}
            <DocLink href="/c/electronics/gaming/gaming-monitors">gaming monitors</DocLink>,
            with the colour-critical ones in{" "}
            <DocLink href="/c/electronics/computers/monitors">monitors</DocLink>.
          </p>
        </>
      ),
    },
  ],

  faqs: [
    {
      question: "Can an RTX 4060 run 1440p?",
      answer: (
        <p>
          Yes, with qualifications. In most current games it will manage 1440p at medium to
          high settings and around 60 frames per second, and upscaling will comfortably lift
          that. In the heaviest recent titles at maximum settings it will fall short, and its 8
          GB of memory is the limiting factor more often than its speed. It is fundamentally a
          1080p card that can be pushed to 1440p rather than a 1440p card.
        </p>
      ),
    },
    {
      question: "How much VRAM do I actually need?",
      answer: (
        <p>
          For 1080p, 8 GB is the floor and 12 GB is the comfortable choice. For 1440p, aim for
          12 GB. For 4K, 16 GB. Memory requirements have risen sharply in recent years, and
          running short does not degrade gracefully — it produces severe stuttering and
          late-loading textures rather than a slightly lower frame rate. Between two similar
          cards, more memory is usually the better long-term purchase.
        </p>
      ),
    },
    {
      question: "Is DLSS or FSR cheating?",
      answer: (
        <p>
          No — at high quality settings the reconstructed image is very close to native and the
          frame rate gain is substantial, which makes it one of the more genuinely useful
          features on a modern card. The scepticism is better aimed at frame generation, which
          adds smoothness without improving how responsive the game feels, and at manufacturer
          comparisons that enable these features on one side of a chart and not the other.
        </p>
      ),
    },
    {
      question: "Should I buy a previous-generation graphics card?",
      answer: (
        <p>
          Often yes. A previous-generation card one or two tiers higher frequently outperforms a
          new lower-tier card and costs less. What you give up is efficiency, the newest
          upscaling features, and sometimes video memory. Compare actual frame rates at your
          resolution rather than model numbers — a 4070 and a 5060 are not ranked by their
          leading digit.
        </p>
      ),
    },
    {
      question: "Do I need a graphics card if I do not game?",
      answer: (
        <p>
          Almost certainly not. Current integrated graphics — in AMD's Ryzen chips, Intel's Arc,
          and Apple's M-series — will drive multiple high-resolution displays, accelerate video
          playback and handle photo editing without difficulty. A discrete card is worth its
          cost, heat and power draw for gaming, 3D rendering, CAD, local AI work and
          professional video editing. Outside those, it is money that would do more elsewhere.
        </p>
      ),
    },
    {
      question: "Why is my frame rate low even with a good graphics card?",
      answer: (
        <p>
          Most often something else is the limit. A slower processor can bottleneck a fast card,
          particularly at 1080p where the card finishes frames quickly enough to be waiting.
          Insufficient system memory, a slow drive, an outdated driver, or a monitor connected
          over a cable that cannot carry the refresh rate will all cap performance. Check what
          your monitor is actually running at first — a display set to 60Hz when it supports 144
          is a common and easily fixed cause.
        </p>
      ),
    },
  ],
};
