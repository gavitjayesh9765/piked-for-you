import type { ChartMetric, ChartRow } from "@/components/guides/BarChart";

/**
 * Every number that appears in a guide chart, in one file.
 *
 * ===========================================================================
 * ⚠ READ THIS BEFORE EDITING, AND BEFORE BELIEVING ANY FIGURE BELOW.
 * ===========================================================================
 *
 * These are MEDIANS OF PUBLICLY PUBLISHED RUNS collected from the sources named
 * in each block. They are not our measurements. Nobody here has run Geekbench
 * on a Dimensity 9400, and the articles say so in as many words.
 *
 * They are accurate enough for the only claim the guides make with them —
 * relative standing between parts, at a scale where a 5% error changes nothing
 * — and they are NOT accurate enough to be quoted as a specification. That
 * distinction is stated on the page rather than assumed.
 *
 * ---------------------------------------------------------------------------
 * THE REVERIFICATION RULE
 *
 * `VERIFIED` below is rendered on every chart. It is the only thing standing
 * between a useful article and a confidently wrong one, because these tables
 * decay in a specific and predictable way: they do not become gradually
 * inaccurate, they become abruptly incomplete when a generation ships and the
 * top row is simply missing.
 *
 * So the rule is: RE-CHECK EVERY BLOCK AGAINST ITS NAMED SOURCE BEFORE MOVING
 * `VERIFIED` FORWARD, and never move it as part of an unrelated change. A date
 * that advances without anyone having opened the source is worse than a date
 * six months stale — the stale one at least tells the reader to be careful.
 *
 * When a new generation lands, ADD it and DELETE the oldest tier rather than
 * letting the chart grow. A twenty-row bar chart is a table with worse
 * ergonomics; these are capped around a dozen because that is what fits on a
 * phone screen without the row height becoming a scroll.
 *
 * ---------------------------------------------------------------------------
 * WHY THE DATA IS HERE AND NOT IN THE ARTICLE FILES
 *
 * Updating a benchmark table should never require opening a file containing
 * prose, because the prose is where the judgement lives and judgement is what
 * gets broken by a hurried edit. Refreshing figures is a mechanical job; this
 * file is written so it stays one.
 *
 * The articles reference rows by id when they name a part in the text, so a
 * chip deleted here fails the typecheck rather than leaving a paragraph
 * discussing a bar that is no longer drawn.
 */

/**
 * The date every chart on the site declares.
 *
 * ⚠ ONE DATE FOR ALL THREE BLOCKS, on purpose. Per-block dates would let two
 * charts in the same article disagree about how current the article is, and a
 * reader cannot be expected to track which. Reverify all three together or
 * leave it where it is.
 */
export const VERIFIED = "26 August 2026";

/* ===================================================================== */
/* Smartphone chips                                                       */
/* ===================================================================== */

export const PHONE_SOURCE =
  "Geekbench Browser, median of retail-device runs per chip";

/**
 * ⚠ WHY SINGLE-CORE IS THE FIRST TAB AND NOT MULTI-CORE.
 *
 * Multi-core is the bigger number and the one manufacturers quote, and for a
 * phone it is close to irrelevant. Almost nothing a person does on a handset
 * sustains eight cores: opening an app, scrolling a feed, and rendering a web
 * page are single-threaded bursts, and single-core is what decides whether the
 * device feels quick. Multi-core matters for sustained export work, which is
 * why it is a tab rather than a footnote — but leading with it would teach the
 * reader the wrong lesson in the first second they look at the chart.
 */
export const PHONE_METRICS: ChartMetric[] = [
  {
    id: "sc",
    label: "Single-core",
    caption:
      "Geekbench 6 single-core. This is the number that decides whether a phone feels fast — app launches, scrolling and page rendering are bursts of one-threaded work.",
    unit: "points",
  },
  {
    id: "mc",
    label: "Multi-core",
    caption:
      "Geekbench 6 multi-core. Matters for video export, large photo edits and heavy multitasking. It is the number on the spec sheet, and the one you will notice least.",
    unit: "points",
  },
];

export const PHONE_CHIPS: ChartRow[] = [
  { id: "a18-pro", label: "Apple A18 Pro", sublabel: "Apple", values: { sc: 3400, mc: 8400 } },
  { id: "sd-8-elite", label: "Snapdragon 8 Elite", sublabel: "Qualcomm", values: { sc: 3050, mc: 9400 } },
  { id: "a18", label: "Apple A18", sublabel: "Apple", values: { sc: 3300, mc: 8000 } },
  { id: "a17-pro", label: "Apple A17 Pro", sublabel: "Apple", values: { sc: 2900, mc: 7200 } },
  { id: "d9400", label: "Dimensity 9400", sublabel: "MediaTek", values: { sc: 2750, mc: 8600 } },
  { id: "sd-8g3", label: "Snapdragon 8 Gen 3", sublabel: "Qualcomm", values: { sc: 2200, mc: 6900 } },
  { id: "d9300", label: "Dimensity 9300", sublabel: "MediaTek", values: { sc: 2150, mc: 7300 } },
  { id: "tensor-g4", label: "Tensor G4", sublabel: "Google", values: { sc: 1950, mc: 4700 } },
  { id: "sd-8sg3", label: "Snapdragon 8s Gen 3", sublabel: "Qualcomm", values: { sc: 1850, mc: 5000 } },
  /**
   * Marked as the value pick, and it is the only emphasis on this chart.
   *
   * The argument the article makes: this part lands within a fifth of the
   * previous year's flagship on single-core for roughly a third of the phone
   * price, which is the entire "do you need a flagship chip" question answered
   * in one bar. See the note on `ChartRow.emphasis` about not spending this
   * accent more than once.
   */
  { id: "sd-7pg3", label: "Snapdragon 7+ Gen 3", sublabel: "Qualcomm", values: { sc: 1750, mc: 4700 }, emphasis: true },
  { id: "d8300", label: "Dimensity 8300 Ultra", sublabel: "MediaTek", values: { sc: 1450, mc: 4500 } },
  { id: "sd-6g3", label: "Snapdragon 6 Gen 3", sublabel: "Qualcomm", values: { sc: 1050, mc: 3000 } },
];

/* ===================================================================== */
/* Laptop and desktop chips                                               */
/* ===================================================================== */

export const LAPTOP_SOURCE =
  "Geekbench Browser, median of retail-machine runs per chip";

export const LAPTOP_METRICS: ChartMetric[] = [
  {
    id: "sc",
    label: "Single-core",
    caption:
      "Geekbench 6 single-core. Spreadsheets, browsers, code editors and every UI you interact with are bound by this, not by core count.",
    unit: "points",
  },
  {
    id: "mc",
    label: "Multi-core",
    caption:
      "Geekbench 6 multi-core. This is the one that pays for itself if you compile, render, export video or run virtual machines — and the one you are being upsold on if you do not.",
    unit: "points",
  },
];

/**
 * ⚠ THE COMPARISON THAT IS NOT VALID HERE, AND THE ARTICLE SAYS SO.
 *
 * These are laptop chips inside laptops, and a laptop chip's score is a
 * function of the chassis as much as the silicon — the same part in a thin
 * fanless shell and in a thick gaming body can differ by twenty per cent, and
 * Geekbench's short burst flatters the thin one because it finishes before the
 * machine gets hot. Sustained work inverts that.
 *
 * The section on thermals exists because of this and must not be deleted as
 * padding: without it the chart quietly argues that a fanless ultrabook and a
 * workstation with the same chip are the same computer.
 */
export const LAPTOP_CHIPS: ChartRow[] = [
  { id: "m4-max", label: "Apple M4 Max", sublabel: "Apple", values: { sc: 4050, mc: 25000 } },
  { id: "m4-pro", label: "Apple M4 Pro", sublabel: "Apple", values: { sc: 3900, mc: 22000 } },
  { id: "m4", label: "Apple M4", sublabel: "Apple", values: { sc: 3750, mc: 14700 } },
  { id: "m3", label: "Apple M3", sublabel: "Apple", values: { sc: 3100, mc: 11800 } },
  { id: "ultra-9-285h", label: "Core Ultra 9 285H", sublabel: "Intel", values: { sc: 2900, mc: 15500 } },
  { id: "hx-370", label: "Ryzen AI 9 HX 370", sublabel: "AMD", values: { sc: 2850, mc: 15200 } },
  { id: "x-elite", label: "Snapdragon X Elite", sublabel: "Qualcomm", values: { sc: 2850, mc: 14200 } },
  { id: "r7-8845hs", label: "Ryzen 7 8845HS", sublabel: "AMD", values: { sc: 2600, mc: 12400 }, emphasis: true },
  { id: "ultra-7-155h", label: "Core Ultra 7 155H", sublabel: "Intel", values: { sc: 2350, mc: 12300 } },
  { id: "i7-13700h", label: "Core i7-13700H", sublabel: "Intel", values: { sc: 2450, mc: 12000 } },
  { id: "i5-1335u", label: "Core i5-1335U", sublabel: "Intel", values: { sc: 2100, mc: 7300 } },
];

/* ===================================================================== */
/* Graphics cards                                                         */
/* ===================================================================== */

export const GPU_SOURCE =
  "aggregated review averages across a basket of recent titles, maximum preset, no upscaling and no frame generation";

/**
 * ⚠ "NO UPSCALING, NO FRAME GENERATION" IS THE WHOLE METHODOLOGY.
 *
 * Every one of these cards can be made to post a much larger number with DLSS,
 * FSR or frame generation switched on, and manufacturer charts do exactly that
 * — frequently comparing a new card WITH frame generation against an old one
 * WITHOUT it, which is not a comparison of anything.
 *
 * Native rendering is the only common denominator across three vendors and
 * several generations. The article covers upscaling separately, on its own
 * terms, rather than letting it contaminate the baseline.
 */
export const GPU_METRICS: ChartMetric[] = [
  {
    id: "fhd",
    label: "1080p",
    caption:
      "Average frames per second at 1920×1080, maximum settings, rendered natively. Still the resolution most people actually play at.",
    unit: "fps",
  },
  {
    id: "qhd",
    label: "1440p",
    caption:
      "Average frames per second at 2560×1440, maximum settings, rendered natively. The resolution where a mid-range card stops being comfortable and the price jumps.",
    unit: "fps",
  },
  {
    id: "uhd",
    label: "4K",
    caption:
      "Average frames per second at 3840×2160, maximum settings, rendered natively. Note how few cards clear 60 without help — this is the chart manufacturers prefer to show with upscaling on.",
    unit: "fps",
  },
];

export const GPUS: ChartRow[] = [
  { id: "rtx-5090", label: "GeForce RTX 5090", sublabel: "NVIDIA", values: { fhd: 210, qhd: 165, uhd: 110 } },
  { id: "rtx-4090", label: "GeForce RTX 4090", sublabel: "NVIDIA", values: { fhd: 185, qhd: 130, uhd: 85 } },
  { id: "rtx-5080", label: "GeForce RTX 5080", sublabel: "NVIDIA", values: { fhd: 175, qhd: 125, uhd: 80 } },
  { id: "rx-7900xtx", label: "Radeon RX 7900 XTX", sublabel: "AMD", values: { fhd: 160, qhd: 108, uhd: 66 } },
  { id: "rtx-4080s", label: "GeForce RTX 4080 Super", sublabel: "NVIDIA", values: { fhd: 158, qhd: 108, uhd: 68 } },
  { id: "rtx-5070ti", label: "GeForce RTX 5070 Ti", sublabel: "NVIDIA", values: { fhd: 155, qhd: 105, uhd: 65 } },
  { id: "rtx-4070s", label: "GeForce RTX 4070 Super", sublabel: "NVIDIA", values: { fhd: 132, qhd: 88, uhd: 52 } },
  { id: "rtx-5070", label: "GeForce RTX 5070", sublabel: "NVIDIA", values: { fhd: 128, qhd: 85, uhd: 50 } },
  { id: "rx-7800xt", label: "Radeon RX 7800 XT", sublabel: "AMD", values: { fhd: 120, qhd: 80, uhd: 47 }, emphasis: true },
  { id: "rtx-4070", label: "GeForce RTX 4070", sublabel: "NVIDIA", values: { fhd: 115, qhd: 76, uhd: 44 } },
  { id: "rtx-4060ti", label: "GeForce RTX 4060 Ti", sublabel: "NVIDIA", values: { fhd: 90, qhd: 58, uhd: 33 } },
  { id: "rtx-4060", label: "GeForce RTX 4060", sublabel: "NVIDIA", values: { fhd: 76, qhd: 48, uhd: 27 } },
  { id: "rx-7600", label: "Radeon RX 7600", sublabel: "AMD", values: { fhd: 74, qhd: 47, uhd: 26 } },
];
