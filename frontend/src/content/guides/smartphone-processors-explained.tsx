import { BarChart } from "@/components/guides/BarChart";
import { Callout, DataTable } from "@/components/guides/Prose";
import { DocLink } from "@/components/layout/DocumentPage";

import { PHONE_CHIPS, PHONE_METRICS, PHONE_SOURCE, VERIFIED } from "./data";
import type { Guide } from "./types";

/**
 * The cluster's entry point, and the highest-volume query of the three.
 *
 * The piece is organised around one editorial decision: it refuses to answer
 * "which brand is best" and answers "which tier do you need" instead. That is
 * not a dodge — it is the honest answer, it is the answer that survives the
 * next generation shipping, and it is the only version of this article that
 * still routes a reader into a catalogue that does not sell chips.
 */
export const guide: Guide = {
  slug: "smartphone-processors-explained",

  title: "Snapdragon vs Dimensity vs Tensor vs A-Series",
  heading: "Smartphone processors, explained without the marketing",
  description:
    "Snapdragon, Dimensity, Tensor and Apple's A-series compared on the numbers that matter — and how to tell which tier of chip you actually need.",

  dek: "Four families, a dozen tiers, and a naming scheme designed to make a mid-range part sound like a flagship. Here is what the numbers mean and which of them should change what you buy.",
  eyebrow: "Guides · Silicon",

  published: "2026-08-29",
  updated: "2026-08-29",

  answer:
    "For most people the processor stopped being the deciding factor several years ago: any current upper-mid-range chip — a Snapdragon 7+ Gen 3, a Dimensity 8300 — runs everything smoothly and will keep doing so for four or five years. Flagship silicon is worth paying for in exactly three cases: sustained gaming, serious camera and video work, or wanting the phone to still feel quick in year six. Between the families, Apple's A-series leads on single-core speed, Qualcomm's Snapdragon leads on sustained gaming and multi-core, MediaTek's Dimensity matches them on paper for less money, and Google's Tensor trades raw speed for on-device AI features.",

  takeaways: [
    "Single-core speed decides whether a phone feels fast. Multi-core is the bigger number on the box and the one you will notice least.",
    "The same chip is meaningfully slower in a thin phone than a thick one. A benchmark run lasts seconds; a game lasts an hour, and only one of those is affected by the cooling.",
    "Chip names are marketing, not a hierarchy. A Snapdragon 8s Gen 3 is not a slightly different 8 Gen 3 — it is a tier below, and the lowercase letter is the only thing telling you.",
    "Above roughly ₹30,000 the processor stops being the reason to choose one phone over another. The screen, the cameras and the software update policy all matter more.",
  ],

  entities: {
    brands: ["apple", "samsung", "nothing"],
    categories: ["/c/electronics/mobiles/smartphones"],
  },

  next: [
    {
      href: "/c/electronics/mobiles/smartphones",
      label: "Phones we would actually buy",
      note: "Ranked at every price we track, with the chip named on each spec sheet.",
    },
    {
      href: "/c/electronics/mobiles/tablets",
      label: "Tablets, ranked",
      note: "The same silicon in a bigger body, where sustained performance matters far more.",
    },
    {
      href: "/c/electronics/gaming/gaming-headsets",
      label: "Gaming headsets",
      note: "If mobile gaming is why you are reading a chip guide, this is the other half.",
    },
    {
      href: "/c/electronics/mobiles/chargers",
      label: "Chargers worth owning",
      note: "A fast chip is a hot chip. What you charge it with decides how long it lasts.",
    },
  ],

  related: ["laptop-processors-explained", "graphics-cards-explained"],

  sections: [
    {
      id: "families",
      title: "Four families, and who is actually competing",
      body: (
        <>
          <p>
            Every phone you can buy runs one of four processor families, and they are not
            four versions of the same thing. Two of them are sold to phone makers, one is
            used only by the company that designs it, and one is a semi-custom job.
          </p>

          <DataTable
            caption="Who makes what, and who uses it"
            columns={[
              { key: "family", label: "Family" },
              { key: "maker", label: "Designed by" },
              { key: "found", label: "Found in" },
              { key: "strength", label: "Plays to" },
            ]}
            rows={[
              {
                family: "Snapdragon",
                maker: "Qualcomm",
                found: "Samsung, OnePlus, Xiaomi, Motorola, Nothing — most Android phones sold in India",
                strength: "Sustained gaming, modem quality, driver support",
              },
              {
                family: "Dimensity",
                maker: "MediaTek",
                found: "Vivo, Oppo, Realme, Xiaomi, increasingly Samsung's mid-range",
                strength: "Peak numbers per rupee",
              },
              {
                family: "A-series",
                maker: "Apple",
                found: "iPhone only",
                strength: "Single-core speed, and a very long support life",
              },
              {
                family: "Tensor",
                maker: "Google, built with Samsung",
                found: "Pixel only",
                strength: "On-device AI; deliberately not raw speed",
              },
            ]}
          />

          <p>
            The important structural fact is the first column against the third.{" "}
            <strong>
              Apple and Google design chips for their own phones; Qualcomm and MediaTek sell
              to everybody else.
            </strong>{" "}
            That is why an iPhone's chip is matched precisely to its software and why two
            Android phones with identical Snapdragons can behave quite differently — the chip
            is the same, the cooling, the display driver and the manufacturer's own software
            layer are not.
          </p>

          <p>
            It is also why brand loyalty at the chip level makes little sense.{" "}
            <DocLink href="/b/samsung">Samsung</DocLink> ships Snapdragon in some regions and
            its own Exynos in others; <DocLink href="/b/nothing">Nothing</DocLink> has used
            both Snapdragon and Dimensity across its range. The family name on the spec sheet
            tells you less about the phone than the tier does.
          </p>
        </>
      ),
    },

    {
      id: "numbers",
      title: "What the benchmark numbers actually measure",
      body: (
        <>
          <p>
            Almost every chip comparison you will read is built on Geekbench, which reports
            two numbers. They measure different things and only one of them describes how a
            phone feels.
          </p>

          <p>
            <strong>Single-core</strong> is one processor core doing one job as fast as it
            can. Opening an app, rendering a web page, scrolling a list — these are bursts of
            work that cannot be split up, so they finish at whatever speed one core manages.
            This is the number that decides whether a phone feels quick.
          </p>

          <p>
            <strong>Multi-core</strong> is every core working at once. It matters for
            exporting video, editing large photos and heavy multitasking. It is also the
            larger, more impressive number, which is why it is the one that appears in
            marketing.
          </p>

          <p>Switch between the two below and watch the order change.</p>

          <BarChart
            title="Phone chips, Geekbench 6"
            metrics={PHONE_METRICS}
            rows={PHONE_CHIPS}
            source={PHONE_SOURCE}
            verified={VERIFIED}
          />

          <p>
            The reordering is the point. Apple's A18 Pro leads comfortably on single-core and
            is beaten on multi-core by the Snapdragon 8 Elite, because the two companies made
            opposite bets: Apple builds a small number of very wide, very fast cores, and
            Qualcomm builds more of them. Neither is wrong. They are optimised for different
            work, and a spec sheet quoting only one of the two numbers is telling you half a
            story on purpose.
          </p>

          <Callout tone="watch" title="The comparison manufacturers keep making">
            <p>
              A launch slide claiming &ldquo;30% faster than the previous generation&rdquo;
              is almost always quoting multi-core, because the multi-core gain is usually the
              larger one and it is the number you will notice least. When you see a single
              percentage with no measure attached, assume it is the flattering one.
            </p>
          </Callout>
        </>
      ),
    },

    {
      id: "naming",
      title: "Reading the name, which is designed to be misread",
      body: (
        <>
          <p>
            Chip names look like a hierarchy and are not one. The gaps between tiers are
            large, the gaps within a tier are small, and the characters that separate them are
            deliberately quiet — a lowercase letter, a plus sign, a generation number that
            moves independently of the tier.
          </p>

          <DataTable
            caption="Snapdragon and Dimensity, decoded"
            columns={[
              { key: "name", label: "What you see" },
              { key: "means", label: "What it means" },
              { key: "tier", label: "Actual tier" },
            ]}
            rows={[
              {
                name: "Snapdragon 8 Elite",
                means: "Current flagship, custom Oryon cores",
                tier: "Top",
              },
              {
                name: "Snapdragon 8 Gen 3",
                means: "Previous flagship. Still faster than most things sold today",
                tier: "Top, last year",
              },
              {
                name: "Snapdragon 8s Gen 3",
                means: "A lowercase s. Fewer cores, lower clocks, cheaper — not an 8 Gen 3",
                tier: "Upper mid",
              },
              {
                name: "Snapdragon 7+ Gen 3",
                means: "The plus matters more than the 7. Close to last year's flagship",
                tier: "Upper mid",
              },
              {
                name: "Snapdragon 7 Gen 3",
                means: "Same digit, no plus, meaningfully slower part",
                tier: "Mid",
              },
              {
                name: "Dimensity 9400",
                means: "First digit is the tier, rest is the generation",
                tier: "Top",
              },
              {
                name: "Dimensity 8300",
                means: "8-series is MediaTek's upper mid-range",
                tier: "Upper mid",
              },
              {
                name: "Dimensity 7300",
                means: "7-series is the volume mid-range",
                tier: "Mid",
              },
            ]}
            note="Apple's naming is the one honest scheme here: A18 Pro is above A18 is above A17 Pro, and no lowercase letters change the answer."
          />

          <Callout tone="watch" title="The single most expensive misreading">
            <p>
              <strong>Snapdragon 8s Gen 3 is not a Snapdragon 8 Gen 3.</strong> One lowercase
              letter separates a genuine flagship from an upper-mid-range part costing the
              manufacturer far less, and phones are routinely marketed as having &ldquo;the
              Snapdragon 8 series&rdquo; on that basis. The same trick is available with{" "}
              <strong>7+ Gen 3 versus 7 Gen 3</strong>, where the plus is worth more than the
              number in front of it.
            </p>
          </Callout>

          <p>
            The practical rule: ignore the family, find the exact full name, and check the
            tier. A phone listing that says only &ldquo;Snapdragon 8-series processor&rdquo;
            without the full name is not telling you what you are buying, and that is usually
            not an accident.
          </p>
        </>
      ),
    },

    {
      id: "thermals",
      title: "Why the same chip is slower in a thinner phone",
      body: (
        <>
          <p>
            A benchmark run takes a couple of minutes. A game lasts an hour, and this is where
            two phones with the same chip stop being the same phone.
          </p>

          <p>
            Silicon produces heat in proportion to how hard it is working, and a phone has no
            fan. Once the body reaches a temperature the manufacturer has decided is
            unacceptable — for the battery, or for your hand — the software reduces the clock
            speed until it cools. This is <strong>thermal throttling</strong>, it is normal,
            and how aggressively it happens is a design decision made by the phone maker
            rather than the chip maker.
          </p>

          <p>
            A thick gaming phone with a vapour chamber will hold near-peak speed for an hour.
            A thin flagship with the identical chip may drop by a third within fifteen
            minutes. Both post the same benchmark score, because the benchmark finished before
            either got hot.
          </p>

          <Callout tone="buy" title="What to look for instead">
            <p>
              For gaming, ignore the peak figure and look for a <strong>sustained</strong> or{" "}
              <strong>stability</strong> percentage in a review — the score after twenty
              minutes as a proportion of the first run. Above 80% is good. Below 60% means the
              chip on the box is not the chip you will be playing on. It is one of the things
              our own{" "}
              <DocLink href="/how-we-score">scoring rubric</DocLink> weighs directly, precisely
              because the spec sheet cannot show it.
            </p>
          </Callout>
        </>
      ),
    },

    {
      id: "tiers",
      title: "Which tier you actually need",
      body: (
        <>
          <p>
            This is the section that should change what you buy, and it is deliberately not
            organised by brand.
          </p>

          <DataTable
            caption="Chip tier by what you do with the phone"
            columns={[
              { key: "you", label: "If you" },
              { key: "tier", label: "Buy at this tier" },
              { key: "examples", label: "Which means" },
              { key: "price", label: "Phone price" },
            ]}
            rows={[
              {
                you: "Message, browse, take photos, watch video",
                tier: "Mid-range",
                examples: "Dimensity 7300, Snapdragon 6 Gen 3",
                price: "₹12,000 – ₹20,000",
              },
              {
                you: "All of that, plus casual gaming, and want it to last five years",
                tier: "Upper mid-range",
                examples: "Snapdragon 7+ Gen 3, Dimensity 8300",
                price: "₹20,000 – ₹35,000",
              },
              {
                you: "Play demanding games for an hour at a time",
                tier: "Flagship, with cooling",
                examples: "Snapdragon 8 Gen 3 or 8 Elite",
                price: "₹45,000+",
              },
              {
                you: "Shoot and edit video on the phone",
                tier: "Flagship",
                examples: "A18 Pro, Snapdragon 8 Elite, Dimensity 9400",
                price: "₹55,000+",
              },
              {
                you: "Want the longest possible useful life",
                tier: "Flagship, and check the update policy",
                examples: "A-series, or an Android with 7 years of updates",
                price: "₹60,000+",
              },
            ]}
            note="Prices are what phones carrying each tier typically cost in India, not the cost of the chip."
          />

          <p>
            The row that matters most is the second one. An upper-mid-range chip today
            outperforms the flagship of three or four years ago, and phones age out on
            software support and battery health long before that silicon becomes too slow to
            use. Paying flagship money for a chip you will never fully load is the single most
            common overspend in phone buying.
          </p>

          <p>
            Which is also the point at which the processor stops being the interesting
            question. Above roughly ₹30,000, the difference between two phones is the display,
            the cameras, the build and how many years of updates the manufacturer has
            committed to in writing — and{" "}
            <DocLink href="/c/electronics/mobiles/smartphones">our phone rankings</DocLink>{" "}
            are ordered on those, with the chip as one input rather than the headline.
          </p>
        </>
      ),
    },

    {
      id: "beyond-cpu",
      title: "The parts of the chip nobody benchmarks",
      body: (
        <>
          <p>
            A phone processor is not only processor cores. Three other blocks sit on the same
            piece of silicon, none of them appears in a Geekbench score, and at least one of
            them will affect your daily experience more than the core count does.
          </p>

          <p>
            <strong>The modem</strong> decides whether you have signal in a lift, on a train,
            or at the edge of a cell. Qualcomm's modems have a long-standing and well-earned
            reputation here, and it is the least glamorous advantage in the industry. Nobody
            has ever chosen a phone for its modem; plenty of people have returned one because
            of it.
          </p>

          <p>
            <strong>The image signal processor</strong> turns what the camera sensor captures
            into a photograph — noise reduction, exposure blending, the multi-frame stacking
            that happens between pressing the shutter and seeing the result. Two phones with
            identical camera sensors and different ISPs produce visibly different pictures.
            This is a large part of why Pixel photographs look like Pixel photographs.
          </p>

          <p>
            <strong>The NPU</strong> runs machine-learning work on the device instead of in a
            data centre: live translation, voice transcription, the generative editing tools
            now shipping on most flagships. This is where Google's Tensor spends the budget it
            declines to spend on raw speed, and it is a real trade rather than a shortfall —
            a Pixel loses on the chart above and wins at things the chart does not measure.
          </p>

          <Callout tone="note" title="Why this is not on the chart">
            <p>
              There is no comparable, vendor-neutral benchmark for any of the three.
              Modem performance depends on the network, ISP quality is a matter of taste as
              much as measurement, and NPU figures are quoted in units each manufacturer
              defines for itself. We would rather leave a gap than fill it with a number that
              cannot be checked — the same reason our{" "}
              <DocLink href="/how-we-research">research method</DocLink> marks the difference
              between what we have tested and what we have read.
            </p>
          </Callout>
        </>
      ),
    },
  ],

  faqs: [
    {
      question: "Is Snapdragon better than MediaTek Dimensity?",
      answer: (
        <p>
          Not by default, and the honest answer is tier-for-tier they are close. Dimensity
          typically offers more benchmark performance per rupee; Snapdragon typically holds
          its speed better under sustained load, has stronger modem performance, and gets
          longer driver support for games. If you are buying a phone under ₹30,000 and
          comparing similar tiers, price and the rest of the phone should decide it. If you
          game heavily for long sessions, Snapdragon is the safer choice.
        </p>
      ),
    },
    {
      question: "Does a faster processor mean worse battery life?",
      answer: (
        <p>
          Usually the opposite. A newer, faster chip is normally built on a smaller
          manufacturing process, finishes the same work sooner and returns to idle faster,
          which uses less energy overall. What actually drains a battery is the display, the
          modem hunting for signal, and background software. A flagship chip in a phone with a
          large efficient battery will comfortably outlast a mid-range chip in a thin one.
        </p>
      ),
    },
    {
      question: "What is the best processor for gaming under ₹25,000?",
      answer: (
        <p>
          At that price the realistic ceiling is the upper mid-range: a Snapdragon 7+ Gen 3 or
          a Dimensity 8300 will run every current mobile game at high settings. The more
          useful question at ₹25,000 is which phone at that price handles heat best, because
          all of them use similar chips and they do not all sustain the speed. Our{" "}
          <DocLink href="/c/electronics/mobiles/smartphones">phone rankings</DocLink> note
          sustained performance where we have measured it.
        </p>
      ),
    },
    {
      question: "Why is Google's Tensor slower than Snapdragon?",
      answer: (
        <p>
          Because it was designed to be something else. Tensor allocates a large share of its
          silicon to the neural processing unit that runs Google's on-device AI features —
          call screening, live translation, computational photography — rather than to
          raw processor speed. On a benchmark chart it loses. In the specific tasks it was
          built for, no other phone chip matches it. Whether that is a good trade depends
          entirely on whether you use those features.
        </p>
      ),
    },
    {
      question: "How many years will a phone processor stay fast enough?",
      answer: (
        <p>
          For a current upper-mid-range or flagship chip, five to seven years of adequate
          performance is realistic. In practice the phone will be retired for other reasons
          first: the battery will have lost meaningful capacity by year three or four, and
          security updates will stop before the silicon becomes the problem. When buying for
          longevity, the manufacturer's stated update commitment is a more reliable indicator
          than the processor.
        </p>
      ),
    },
    {
      question: "Do more cores mean a faster phone?",
      answer: (
        <p>
          No. Every current phone chip has eight cores; what differs is how fast each one is
          and how the work is split between them. Phone chips deliberately mix a few large
          fast cores with several small efficient ones, so the software can run background
          tasks cheaply and wake the fast cores only when needed. A chip with fewer, faster
          cores will feel quicker than one with more, slower cores at almost everything a
          phone is used for.
        </p>
      ),
    },
  ],
};
