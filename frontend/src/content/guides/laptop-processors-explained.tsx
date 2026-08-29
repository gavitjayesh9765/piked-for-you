import { BarChart } from "@/components/guides/BarChart";
import { Callout, DataTable } from "@/components/guides/Prose";
import { DocLink } from "@/components/layout/DocumentPage";

import { LAPTOP_CHIPS, LAPTOP_METRICS, LAPTOP_SOURCE, VERIFIED } from "./data";
import type { Guide } from "./types";

/**
 * The suffix section is the reason this article exists.
 *
 * "what does h mean in i7 13700h" and its dozen variants are a very large
 * standing query with almost no good answer written for a buyer — the results
 * are forum threads and manufacturer PDFs. It is the highest-intent, lowest-
 * competition part of the whole cluster, which is why it gets its own anchor
 * and a table rather than a paragraph.
 */
export const guide: Guide = {
  slug: "laptop-processors-explained",

  title: "Laptop CPUs: Intel vs AMD vs Apple vs Snapdragon",
  heading: "Laptop processors, and what the letters after the number mean",
  description:
    "Intel Core Ultra, AMD Ryzen, Apple M-series and Snapdragon X compared — plus how to read a CPU name and why the same chip is faster in a thicker laptop.",

  dek: "The processor in a laptop matters less than the body it is fitted to, and the name tells you more than the brand does. Here is how to read both.",
  eyebrow: "Guides · Silicon",

  published: "2026-08-29",
  updated: "2026-08-29",

  answer:
    "For most laptop buyers the letter at the end of the processor name matters more than the brand at the start: a U-series chip is built for thin, quiet, long-battery machines and a H or HX chip is built for sustained work in a thicker body, and that difference is larger than any gap between Intel, AMD and Apple at the same tier. Apple's M-series leads on performance per watt and battery life, AMD and Intel lead on price and software compatibility, and Qualcomm's Snapdragon X trades some compatibility for exceptional battery life. Unless you compile code, render video or play games, almost any current mid-tier chip is enough.",

  takeaways: [
    "The suffix — U, H, HX, HS — tells you the power budget, which decides the machine's thickness, noise, battery life and sustained speed. It is the most useful character in the name.",
    "The same processor performs very differently in two different laptops. Chassis cooling is not a detail; it is often a 20% difference in real work.",
    "More cores only help if your software uses them. Most people are bound by single-core speed and would not notice a core count doubling.",
    "Integrated graphics have become genuinely capable. A separate graphics card is now a choice for gaming and rendering, not a default for everyone.",
  ],

  entities: {
    brands: ["apple", "asus"],
    categories: ["/c/electronics/computers/laptops"],
  },

  next: [
    {
      href: "/c/electronics/computers/laptops",
      label: "Laptops we would actually buy",
      note: "Scored on how they hold up over years, not on benchmark peaks.",
    },
    {
      href: "/c/electronics/computers/monitors",
      label: "Monitors, ranked",
      note: "The upgrade that improves a working day more than a faster CPU will.",
    },
    {
      href: "/c/electronics/accessories/storage",
      label: "Storage worth buying",
      note: "On most machines a slow drive, not a slow processor, is what you are feeling.",
    },
    {
      href: "/c/electronics/computers/keyboards",
      label: "Keyboards, ranked",
      note: "Ergonomics first — you hold this for eight hours.",
    },
  ],

  related: ["smartphone-processors-explained", "graphics-cards-explained"],

  sections: [
    {
      id: "families",
      title: "Four families, two instruction sets",
      body: (
        <>
          <p>
            There are four processor families in current laptops, and the division that
            matters is not the brand — it is that two of them speak x86 and two speak Arm.
            That distinction decides what software runs natively and how long the battery
            lasts.
          </p>

          <DataTable
            caption="The four families"
            columns={[
              { key: "family", label: "Family" },
              { key: "maker", label: "Maker" },
              { key: "arch", label: "Type" },
              { key: "strength", label: "Plays to" },
            ]}
            rows={[
              {
                family: "Core Ultra / Core",
                maker: "Intel",
                arch: "x86",
                strength: "Compatibility, price, wide selection",
              },
              {
                family: "Ryzen / Ryzen AI",
                maker: "AMD",
                arch: "x86",
                strength: "Multi-core value, strong integrated graphics",
              },
              {
                family: "M-series",
                maker: "Apple",
                arch: "Arm",
                strength: "Performance per watt, battery life, silence",
              },
              {
                family: "Snapdragon X",
                maker: "Qualcomm",
                arch: "Arm",
                strength: "Battery life on Windows; compatibility still improving",
              },
            ]}
          />

          <p>
            x86 is the architecture Windows software has been compiled for since the 1980s, so
            an Intel or AMD laptop runs essentially everything without translation. Arm chips
            are more power-efficient by design, which is why an{" "}
            <DocLink href="/b/apple">Apple</DocLink> laptop can be fanless and still last a
            working day — but software written for x86 has to be translated to run on them.
          </p>

          <p>
            Apple has largely finished that transition; almost everything a Mac user runs is
            now native. Windows on Arm is earlier in the same process: mainstream applications
            are native or translate well, and the exceptions cluster in specialist software,
            older professional tools, some VPN and security clients, and anti-cheat systems in
            games.
          </p>
        </>
      ),
    },

    {
      id: "numbers",
      title: "The numbers, and what they leave out",
      body: (
        <>
          <p>
            As with phone chips, two figures do most of the work. Single-core speed decides
            how responsive the machine feels — every menu, every spreadsheet recalculation,
            every browser tab. Multi-core decides how quickly it finishes a big job that can
            be split across cores: compiling, rendering, exporting, running virtual machines.
          </p>

          <BarChart
            title="Laptop chips, Geekbench 6"
            metrics={LAPTOP_METRICS}
            rows={LAPTOP_CHIPS}
            source={LAPTOP_SOURCE}
            verified={VERIFIED}
          />

          <p>
            Two things are worth reading off this chart. The first is that Apple's lead is
            largest on single-core and narrows sharply on multi-core, where Intel's and AMD's
            higher core counts close the gap — an M4 leads the Core Ultra 9 comfortably on
            one core and trails it on all of them.
          </p>

          <p>
            The second is the spread within the middle of the chart. Between the Core Ultra 7,
            the Ryzen 7 and the older Core i7, there is very little in it — and those parts
            appear in laptops separated by ₹40,000. At that point you are not buying
            processor performance; you are buying a screen, a keyboard, a chassis and a
            warranty.
          </p>

          <Callout tone="watch" title="What a benchmark cannot tell you">
            <p>
              Geekbench runs for a couple of minutes. Rendering a video runs for forty, and
              that is where a thin laptop and a thick one with the same chip stop being
              comparable — see <DocLink href="#chassis">the chassis section</DocLink>. Treat
              every figure above as the best case, achieved briefly, on a cool machine.
            </p>
          </Callout>
        </>
      ),
    },

    {
      id: "suffixes",
      title: "Reading the name: the letters are the useful part",
      body: (
        <>
          <p>
            A processor name looks like this: <strong>Core Ultra 7 155H</strong>, or{" "}
            <strong>Ryzen 7 8845HS</strong>, or <strong>Core i7-13700H</strong>. The brand and
            the number tell you roughly where it sits in the range. The letters at the end tell
            you what kind of machine it was designed for, and that is the more useful fact.
          </p>

          <p>
            The suffix encodes a <strong>power budget</strong> — how many watts the chip is
            allowed to draw. Power is heat, heat needs cooling, and cooling decides how thick
            and how loud the laptop is. So the suffix is, in practice, a description of the
            whole machine.
          </p>

          <DataTable
            caption="Intel and AMD laptop suffixes"
            columns={[
              { key: "suffix", label: "Suffix" },
              { key: "power", label: "Roughly" },
              { key: "machine", label: "The machine it implies" },
              { key: "buy", label: "Buy it if" },
            ]}
            rows={[
              {
                suffix: "U",
                power: "15–28 W",
                machine: "Thin, light, quiet, long battery. Often fanless or nearly so",
                buy: "You write, browse and take calls",
              },
              {
                suffix: "H",
                power: "45 W",
                machine: "Thicker, audible under load, real cooling",
                buy: "You edit, compile or game",
              },
              {
                suffix: "HS",
                power: "35 W",
                machine: "AMD's middle ground — H-class cores, restrained power",
                buy: "You want H performance in a thinner body",
              },
              {
                suffix: "HX",
                power: "55 W+",
                machine: "Desktop silicon in a laptop. Heavy, loud, fast",
                buy: "You need workstation output and accept the weight",
              },
              {
                suffix: "K (desktop)",
                power: "125 W+",
                machine: "Unlocked desktop chip, overclockable",
                buy: "You are building a desktop, not buying a laptop",
              },
            ]}
            note="Approximate sustained power. Manufacturers set their own limits within these bands, which is why two H-series laptops can perform differently."
          />

          <p>The rest of the name, briefly:</p>

          <ul>
            <li>
              <strong>The tier</strong> — Core Ultra 5 / 7 / 9, or Ryzen 5 / 7 / 9 — is the
              broad performance class. Higher means more cores and higher clocks.
            </li>
            <li>
              <strong>The first digit or two of the number</strong> is the generation. In{" "}
              <strong>Core i7-13700H</strong> the 13 is the 13th generation; in{" "}
              <strong>Ryzen 7 8845HS</strong> the 8 is the series year. A newer generation at a
              lower tier frequently beats an older one at a higher tier.
            </li>
            <li>
              <strong>Apple</strong> uses M4, then Pro, Max and Ultra as escalating tiers. It
              is the clearest scheme of the four.
            </li>
          </ul>

          <Callout tone="buy" title="The one rule worth remembering">
            <p>
              If two laptops are the same price and one has a <strong>U</strong> chip and the
              other an <strong>H</strong>, they are not competing for the same buyer. The U
              machine will be lighter, quieter and last longer on battery; the H machine will
              finish real work substantially faster and be heavier doing it. Decide which of
              those you are buying before comparing anything else.
            </p>
          </Callout>
        </>
      ),
    },

    {
      id: "chassis",
      title: "The chassis matters more than the chip",
      body: (
        <>
          <p>
            This is the part of laptop buying that specifications actively hide. A processor
            has a rated power budget, but the laptop manufacturer decides how much of it to
            actually allow, based on how much heat the body can remove.
          </p>

          <p>
            The result is that the same processor, in two laptops, can differ by twenty per
            cent or more in sustained work. A 45 W H-series chip in a slim 14-inch body may be
            held to 30 W after a few minutes; the same chip in a 16-inch machine with two fans
            will hold its full budget indefinitely. Both are advertised with the same
            processor name, and short benchmarks will show them as near-identical.
          </p>

          <Callout tone="watch" title="Where this shows up as a complaint">
            <p>
              Almost every &ldquo;my new laptop is slower than the reviews said&rdquo;
              experience is this. The review measured a burst; the buyer is doing sustained
              work. The chip is not faulty and the review was not wrong — they measured
              different things.
            </p>
          </Callout>

          <p>
            What to look for instead of the chip name: fan noise under load, the sustained
            power figure if a review reports one, and whether the machine is thermally
            throttled during a long export. These are things you cannot read from a
            specification sheet, which is why they carry weight in our own{" "}
            <DocLink href="/how-we-score">scoring</DocLink> and why{" "}
            <DocLink href="/c/electronics/computers/laptops">our laptop rankings</DocLink>{" "}
            are ordered on how machines hold up rather than on peak numbers.
          </p>
        </>
      ),
    },

    {
      id: "graphics",
      title: "Integrated graphics, and when you still need a card",
      body: (
        <>
          <p>
            Every processor in the chart above includes graphics on the same chip. For most of
            the last two decades that was a fallback; it is now genuinely capable, and it has
            changed what a laptop needs.
          </p>

          <p>
            Current integrated graphics — AMD's Radeon 800M series, Intel's Arc, Apple's
            M-series GPU — will comfortably drive multiple high-resolution displays, accelerate
            video editing, and play most games at 1080p with settings turned down. That covers
            a large majority of laptop buyers, and it does so without the weight, heat, cost
            and battery penalty of a separate graphics card.
          </p>

          <p>You still want a discrete graphics card if you:</p>

          <ul>
            <li>play current games at high settings, or at above 1080p</li>
            <li>render 3D, train models locally, or work in CAD</li>
            <li>edit high-resolution video professionally rather than occasionally</li>
          </ul>

          <p>
            If that is you, the card matters more than the processor does — and which card is
            a separate question with its own answer in{" "}
            <DocLink href="/guides/graphics-cards-explained">our graphics card guide</DocLink>.
          </p>
        </>
      ),
    },

    {
      id: "tiers",
      title: "What to actually buy",
      body: (
        <>
          <DataTable
            caption="Processor tier by what you do"
            columns={[
              { key: "you", label: "If you" },
              { key: "buy", label: "Look for" },
              { key: "skip", label: "Do not pay for" },
            ]}
            rows={[
              {
                you: "Browse, write, take calls, use office software",
                buy: "Core Ultra 5 U-series, Ryzen 5 U-series, or a base M-series",
                skip: "H-series, more than 16 GB of memory, a graphics card",
              },
              {
                you: "Do all that plus photo editing and light video",
                buy: "Core Ultra 7 / Ryzen 7, H or HS, 16–24 GB",
                skip: "A discrete graphics card, unless you also game",
              },
              {
                you: "Compile code or run virtual machines",
                buy: "High core count — Ryzen 9, Core Ultra 9, M-series Pro. 32 GB",
                skip: "The fastest single-core part; you are multi-core bound",
              },
              {
                you: "Edit video professionally",
                buy: "M-series Pro/Max, or H-series with a discrete card. Fast storage",
                skip: "Nothing much — this is the workload that uses everything",
              },
              {
                you: "Game",
                buy: "H or HX, and choose by graphics card first",
                skip: "The top processor tier; the card is the bottleneck",
              },
            ]}
          />

          <p>
            One consistently better use of money than a faster processor: more memory, faster
            storage, and a better screen. A machine that swaps to disk because it has 8 GB of
            memory feels slow in a way no processor upgrade fixes, and a{" "}
            <DocLink href="/c/electronics/computers/monitors">good external monitor</DocLink>{" "}
            improves a working day more than a tier bump ever will.
          </p>
        </>
      ),
    },
  ],

  faqs: [
    {
      question: "What does the H mean in a processor name like i7-13700H?",
      answer: (
        <p>
          H marks a high-power laptop chip, typically rated around 45 watts. It means the
          machine has real cooling, will be thicker and heavier than an equivalent U-series
          laptop, and will sustain much higher performance in long tasks like video export or
          compiling. U means low power — around 15 to 28 watts — for thin, quiet, long-battery
          machines. HX is higher still, essentially desktop silicon in a laptop body.
        </p>
      ),
    },
    {
      question: "Is Apple's M-series actually faster than Intel and AMD?",
      answer: (
        <p>
          On single-core performance and on performance per watt, yes, consistently. On
          multi-core the comparison depends on tier: a base M-series chip is beaten by
          high-core-count Intel and AMD parts, while the Pro and Max tiers lead. The larger
          practical difference is that Apple achieves its figures at far lower power, which is
          why those machines run silently and last much longer on battery. Against that,
          Windows and x86 software compatibility is Intel and AMD's advantage.
        </p>
      ),
    },
    {
      question: "How many cores do I need in a laptop?",
      answer: (
        <p>
          Six to eight is enough for almost everybody. Core count only helps when your software
          can split work across cores — compiling, rendering, video export, virtual machines.
          Browsing, office work and photo editing are largely bound by single-core speed, so a
          chip with fewer, faster cores will feel quicker than one with more, slower ones. Buy
          more cores only if you can name the task that will use them.
        </p>
      ),
    },
    {
      question: "Is Snapdragon X worth buying on a Windows laptop?",
      answer: (
        <p>
          It is worth considering if battery life is your priority and your software is
          mainstream. Native and well-translated applications run well, and the battery life is
          genuinely better than comparable x86 machines. The risk is specialist software:
          older professional tools, some VPN and security clients, certain drivers, and games
          with kernel-level anti-cheat may not run at all. Check your specific applications
          before buying rather than assuming.
        </p>
      ),
    },
    {
      question: "Should I buy last year's processor to save money?",
      answer: (
        <p>
          Usually yes. Generational gains in laptop processors have been modest — often ten to
          fifteen per cent — while the discount on a previous-generation machine is frequently
          much larger than that. The exceptions are worth knowing: a genuine architecture
          change, such as the move to Arm, or a large jump in integrated graphics can make a
          new generation meaningfully better rather than incrementally faster.
        </p>
      ),
    },
    {
      question: "Does a faster processor drain the battery faster?",
      answer: (
        <p>
          Not necessarily, and often the reverse. A newer chip on a smaller manufacturing
          process finishes work sooner and returns to idle, using less total energy. What
          reliably costs battery is the power class: an H-series laptop under load will drain
          far faster than a U-series one, because it is allowed to draw two to three times the
          power. The suffix predicts battery life better than the performance figure does.
        </p>
      ),
    },
  ],
};
