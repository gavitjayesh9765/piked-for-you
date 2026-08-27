/**
 * The authoring reference behind /admin/guide.
 *
 * One module rather than prose baked into the page, for one reason: the
 * human-readable field table and the AI prompt an editor copies are generated
 * from the SAME list. A prompt that tells a model "tagline: max 300 chars"
 * while the form actually enforces 250 produces drafts that fail to save, and
 * nobody would ever notice the two had drifted.
 *
 * The limits and the required/publish split below mirror
 * `backend/app/schemas/product.py` and `backend/app/modules/admin/service.py`
 * (PUBLISH_REQUIREMENTS). If either changes, change it here in the same commit.
 */

/** How badly a field is needed. */
export type Need =
  /** The form will not submit without it. */
  | "save"
  /** Saves fine as a draft; `publish` is refused without it (spec §62). */
  | "publish"
  /** Genuinely optional. */
  | "optional";

export interface FieldDoc {
  /** Section heading on the product form, e.g. "01 · Basics". */
  section: string;
  label: string;
  /** JSON key, for anyone reading the API or a copied brief. */
  key: string;
  need: Need;
  /** The enforced ceiling, as the editor experiences it. */
  limit?: string;
  /** What to actually type. */
  what: string;
  /** Where a reader sees it. */
  where: string;
  example?: string;
}

export const NEED_LABEL: Record<Need, string> = {
  save: "Required",
  publish: "To publish",
  optional: "Optional",
};

/* ------------------------------------------------------------------ */
/* Product form — every field on 01–07                                 */
/* ------------------------------------------------------------------ */

export const PRODUCT_FIELDS: FieldDoc[] = [
  {
    section: "01 · Basics",
    label: "Title",
    key: "title",
    need: "save",
    limit: "250 characters",
    what: "The product's name as a buyer would search it. Model number included, brand name left out — the brand is its own field and the page prints both.",
    where: "Page heading, every card, the browser tab, search results.",
    example: "WH-1000XM5",
  },
  {
    section: "01 · Basics",
    label: "Slug",
    key: "slug",
    need: "optional",
    limit: "280 characters",
    what: "Leave it blank. It is generated from the title, made unique, and only worth setting by hand when you are matching a URL that already exists somewhere.",
    where: "The URL: /p/<category>/<slug>.",
    example: "sony-wh-1000xm5",
  },
  {
    section: "01 · Basics",
    label: "Brand",
    key: "brandId",
    need: "save",
    what: "Pick from the list. Only active brands appear — if one is missing, it is deactivated, not absent. Create it under Content → Brands first.",
    where: "Card, page header, and the brand's own /b page.",
  },
  {
    section: "01 · Basics",
    label: "Category",
    key: "categoryId",
    need: "save",
    what: "The most specific one that fits. This choice decides which specification fields section 05 offers and which criteria the PickD Score accepts — the API refuses any key outside them.",
    where: "The URL path, the breadcrumb, the category listing, the sub-nav.",
    example: "Electronics › Audio › Headphones",
  },
  {
    section: "01 · Basics",
    label: "Tagline",
    key: "tagline",
    need: "save",
    limit: "300 characters",
    what: "One line saying why this is worth considering. Not a description — a reason. A card without one is a listing rather than a recommendation.",
    where: "Under the title on every card and at the top of the product page.",
    example:
      "Class-leading noise cancellation with the best call quality in its price band.",
  },
  {
    section: "01 · Basics",
    label: "Short description",
    key: "shortDescription",
    need: "optional",
    limit: "500 characters",
    what: "Two or three sentences of plain description — what the thing is, for someone who has not met it. Facts, not argument; the argument is section 03.",
    where: "Intro paragraph on the product page, and the SEO description fallback.",
  },
  {
    section: "01 · Basics",
    label: "Full description",
    key: "description",
    need: "optional",
    what: "The long-form description. What is in the box, what it does, how it differs from the model it replaces. Still description, still not the verdict.",
    where: "Body of the product page, below the fold.",
  },

  {
    section: "02 · Pricing",
    label: "Currency",
    key: "currency",
    need: "optional",
    what: "INR unless the product is genuinely priced in something else. It formats every price on the page.",
    where: "Every price, everywhere.",
  },
  {
    section: "02 · Pricing",
    label: "Current price",
    key: "priceCurrent",
    need: "publish",
    what: "The headline price, today, at the retailer you would actually send someone to. NOT the MRP. This is not the same as the per-retailer prices — those are attached on the edit screen under Where to buy.",
    where: "Card, page header, price history chart, the sort-by-price order.",
    example: "26990",
  },
  {
    section: "02 · Pricing",
    label: "Range — low",
    key: "priceMin",
    need: "optional",
    what: "The lowest price you have actually seen it at. It is what makes a Wait-for-a-sale verdict credible instead of a hunch.",
    where: "The price range beside the current price.",
  },
  {
    section: "02 · Pricing",
    label: "Range — high",
    key: "priceMax",
    need: "optional",
    what: "Its usual, non-sale price. Must be at or above the low, and the current price has to sit inside the two — the form now refuses a range that reads backwards.",
    where: "The price range beside the current price.",
  },

  {
    section: "03 · The verdict",
    label: "Should you buy this?",
    key: "verdictStance",
    need: "publish",
    what: "One of four, and the closed set is the point: the page leads with it and styles itself from it. Decide this before writing the verdict, or the prose argues its way to whichever answer it happened to reach.",
    where: "The banner at the very top of the product page.",
  },
  {
    section: "03 · The verdict",
    label: "Last researched",
    key: "researchedAt",
    need: "optional",
    what: "The day you last checked the facts. A recommendation with no date is a rumour, and a stale one is worse than an honest old one.",
    where: "The How we reviewed this box.",
  },
  {
    section: "03 · The verdict",
    label: "Why — in one or two sentences",
    key: "verdictSummary",
    need: "publish",
    limit: "400 characters",
    what: "The reason for the stance, standing on its own. It sits beside the banner above the fold, so a reader who stops there must still have been answered.",
    where: "Directly beside the buy recommendation, above the fold.",
    example:
      "The noise cancellation and call quality are a real step ahead at this price, and it has sat at this price long enough that waiting is unlikely to save you anything.",
  },
  {
    section: "03 · The verdict",
    label: "Our verdict",
    key: "verdict",
    need: "publish",
    what: "The long-form argument. Who it is for, who should skip it, what you gave up to recommend it. Several paragraphs. This is the reason the platform exists.",
    where: "The main verdict block on the product page.",
  },
  {
    section: "03 · The verdict",
    label: "Best for",
    key: "bestFor",
    need: "optional",
    what: "One audience per line. Situations and people, not features — Frequent flyers, not Great ANC.",
    where: "The who-it-suits panel.",
    example: "Frequent travellers\nOpen-plan office work",
  },
  {
    section: "03 · The verdict",
    label: "Not ideal for",
    key: "notIdealFor",
    need: "optional",
    what: "One per line. The people who should read this page and then not buy. Its presence is most of what makes the rest believable.",
    where: "The who-it-suits panel.",
    example: "Tight bag space\nStudio monitoring",
  },
  {
    section: "03 · The verdict",
    label: "Pros",
    key: "pros",
    need: "publish",
    what: "One per line, at least one to publish. Specific and checkable. Excellent sound is not a pro; Beats every rival under ₹30k on call clarity is.",
    where: "The scannable pros/cons block.",
  },
  {
    section: "03 · The verdict",
    label: "Cons",
    key: "cons",
    need: "publish",
    what: "One per line, at least one to publish, and the API means it. A product with no downsides is a page nobody believes — that shape is what an affiliate link writes.",
    where: "The scannable pros/cons block.",
  },

  {
    section: "04 · How this was researched",
    label: "Somebody here physically used this product",
    key: "handsOnTested",
    need: "optional",
    what: "Tick it ONLY if a person on the team held and used this unit. Reading a spec sheet, however thoroughly, is not a test. The public page makes a claim on the strength of this one checkbox.",
    where: "The How we reviewed this box, as an explicit claim either way.",
  },
  {
    section: "04 · How this was researched",
    label: "Anything specific about this one",
    key: "researchNote",
    need: "optional",
    what: "What drove the verdict, or a caveat about the evidence — which rivals you compared it against, which numbers are the manufacturer's rather than measured.",
    where: "Appended to the standard method statement.",
    example:
      "Compared directly against the XM4 and the QC45 at the same street price. Battery figures are the manufacturer's — we have no independent measurement for this generation.",
  },

  {
    section: "05 · Specifications",
    label: "Specification fields",
    key: "specifications",
    need: "optional",
    what: "The fields come from the category and cannot be invented here — the API rejects any key outside the template. Values are free text on purpose: 30 hours and 3 min → 3 hours are both real answers. Blank fields are left off the page entirely.",
    where: "The specification table.",
  },

  {
    section: "06 · Badges",
    label: "Badges",
    key: "badgeIds",
    need: "optional",
    what: "Editorial markers, created under Content → Badges and never hard-coded. Only active badges are offered. Use them sparingly — three on one product means none of them read.",
    where: "Cards and the product page header.",
  },

  {
    section: "07 · SEO",
    label: "Meta title",
    key: "metaTitle",
    need: "optional",
    limit: "200 characters",
    what: "Leave blank and the product title is used. Set it when the searched phrase differs from the on-page name.",
    where: "The browser tab and the search-result heading.",
  },
  {
    section: "07 · SEO",
    label: "Meta description",
    key: "metaDescription",
    need: "optional",
    limit: "400 characters",
    what: "Leave blank and the tagline is used. Worth writing when the tagline is a judgement and the search snippet needs to say what the thing is.",
    where: "The search-result snippet and link previews.",
  },
];

export const PRODUCT_SECTIONS = [...new Set(PRODUCT_FIELDS.map((f) => f.section))];

/* ------------------------------------------------------------------ */
/* The four verdicts                                                   */
/* ------------------------------------------------------------------ */

export const STANCES = [
  {
    value: "buy_now",
    label: "Buy now",
    what: "Worth its current price today. Not best in the world — worth what it costs, now.",
  },
  {
    value: "wait_for_sale",
    label: "Wait for a sale",
    what: "Right product, wrong price. Use it when the product is sound and the price history shows the number moves.",
  },
  {
    value: "skip",
    label: "Skip",
    what: "Not worth it at any price you expect it to reach. Say so plainly in the verdict, and give an alternative.",
  },
  {
    value: "consider_alternative",
    label: "Consider an alternative",
    what: "Nothing wrong with it, but something else does the job better. Incomplete until you add the alternatives in section 13.",
  },
];

/* ------------------------------------------------------------------ */
/* What publish demands (spec §62)                                     */
/* ------------------------------------------------------------------ */

export const PUBLISH_CHECKLIST: { label: string; where: string }[] = [
  { label: "A primary image", where: "Section 08 · Images, on the edit screen" },
  { label: "A current price", where: "Section 02 · Pricing" },
  { label: "A PickD Score", where: "Section 12, on the edit screen" },
  { label: "A buy recommendation", where: "Section 03 · The verdict" },
  { label: "A recommendation summary", where: "Section 03 · The verdict" },
  { label: "The verdict itself", where: "Section 03 · The verdict" },
  { label: "A tagline", where: "Section 01 · Basics" },
  { label: "At least one pro", where: "Section 03 · The verdict" },
  { label: "At least one con", where: "Section 03 · The verdict" },
  { label: "At least one active retailer link", where: "Section 10 · Where to buy" },
];

/* ------------------------------------------------------------------ */
/* Categories, brands, badges                                          */
/* ------------------------------------------------------------------ */

export interface SimpleFieldDoc {
  label: string;
  key: string;
  what: string;
}

export const CATEGORY_FIELDS: SimpleFieldDoc[] = [
  { label: "Name", key: "name", what: "As a shopper would say it. Headphones, not Audio Output Devices." },
  { label: "Slug", key: "slug", what: "Blank generates one. It becomes a segment of every URL beneath this category, so renaming it later 404s old links." },
  { label: "Parent", key: "parentId", what: "Top level, or a category above this one. Moving a branch rewrites the URL path of everything under it, in one transaction." },
  { label: "Icon", key: "icon", what: "From the fixed set. Used on tiles and in the tree." },
  { label: "Description", key: "description", what: "One line at the top of the category page." },
  { label: "Order", key: "displayOrder", what: "Lower sorts first among siblings. Ties break alphabetically." },
  { label: "Active", key: "isActive", what: "Off hides the category from the site AND from the product form's category select. Its products stay where they are." },
  { label: "Homepage tile", key: "showOnHomepage", what: "Works best at the second level — the root is too broad, the leaves are too many." },
  { label: "Scoring criteria", key: "scoreCriteria", what: "What the PickD Score may be broken down into for products here. Leave empty to inherit from the parent. The API refuses any criterion key outside the resolved set." },
  { label: "Specification template", key: "specTemplate", what: "Groups of fields products here may carry. Leave empty to inherit. Adding a field here is the ONLY way to make it available in a product's section 05." },
];

export const BRAND_FIELDS: SimpleFieldDoc[] = [
  { label: "Name", key: "name", what: "The manufacturer, as printed on the box." },
  { label: "Slug", key: "slug", what: "Blank generates one. It is the /b/<slug> URL." },
  { label: "Website", key: "website", what: "The official site, with https://. Not a retailer listing." },
  { label: "Logo URL", key: "logoUrl", what: "An absolute https URL. Optional." },
  { label: "Description", key: "description", what: "A sentence or two, shown on the brand page." },
  { label: "Order", key: "displayOrder", what: "Lower sorts first. Ties break alphabetically." },
  { label: "Pinned to homepage", key: "isPinned", what: "Puts the brand in the featured strip on the homepage." },
  { label: "Active", key: "isActive", what: "On by default. Off hides the brand from /b and removes it from the product form's brand select — its products keep it." },
];

export const BADGE_FIELDS: SimpleFieldDoc[] = [
  { label: "Name", key: "name", what: "What it says on the chip. Two or three words: Editor's Pick, Best Value." },
  { label: "Slug", key: "slug", what: "Blank generates one." },
  { label: "Style token", key: "style", what: "A design-system token, never a colour — which is what lets a badge created here render correctly with no deploy, and stops anyone introducing an off-palette hue." },
  { label: "Icon (emoji)", key: "icon", what: "Optional single emoji, shown before the name." },
  { label: "Description", key: "description", what: "Internal note on when to use it. Not shown publicly." },
  { label: "Order", key: "displayOrder", what: "Lower sorts first where several are attached." },
  { label: "Active", key: "isActive", what: "On by default. Only active badges can be attached to a product; products already carrying an inactive one keep it." },
];

export const BADGE_STYLES = [
  { token: "editorial", what: "Our own judgement — Editor's Pick, Top Pick." },
  { token: "brand", what: "Neutral emphasis in the brand colour." },
  { token: "value", what: "Money — Best Value, Price Drop." },
  { token: "warn", what: "A caution — Discontinued, Price Rising." },
  { token: "neutral", what: "Plain. The default, and the right answer more often than not." },
];

/* ------------------------------------------------------------------ */
/* Prompts                                                             */
/* ------------------------------------------------------------------ */

const HOUSE_STYLE = `HOUSE STYLE
- SortedChoice answers one question: should I buy this, now, at this price?
- Write like a knowledgeable friend, not a brochure. No superlatives you cannot support, no "revolutionary", no "game-changing", no exclamation marks.
- Every claim must be checkable. "Excellent sound" is not a claim; "beats every rival under 30,000 on call clarity" is.
- Indian market, Indian rupees, Indian availability, unless I say otherwise.
- Never invent a price, a score, a rating, or a test you did not do.`;

const FORMAT_RULES = `OUTPUT FORMAT
Return each field under its own heading exactly as written below, so I can copy
one field at a time straight into the form. No preamble, no closing summary, no
markdown bold inside the values. Where a field says "one per line", give plain
lines with no bullets, dashes or numbering.`;

function fieldSpecBlock(): string {
  return PRODUCT_FIELDS.filter((f) => f.key !== "slug" && f.key !== "specifications")
    .map((f) => {
      const bits = [`### ${f.label}`];
      const meta = [
        f.need === "save" ? "required" : f.need === "publish" ? "required to publish" : "optional",
        f.limit ? `max ${f.limit}` : null,
      ]
        .filter(Boolean)
        .join(", ");
      bits.push(`(${meta}) ${f.what}`);
      return bits.join("\n");
    })
    .join("\n\n");
}

/**
 * The main brief.
 *
 * Given a category, its real specification fields and its real scoring
 * criteria are inlined — which is the difference between output you can paste
 * and output the API rejects for using a key the category does not define.
 */
export function buildProductPrompt(ctx?: {
  categoryName?: string;
  specFields?: string[];
  criteria?: string[];
}): string {
  const parts: string[] = [];

  parts.push(
    `You are drafting a product recommendation page for SortedChoice, a review site that tells people whether to buy something at its current price.`,
  );
  parts.push(`PRODUCT: <paste the exact product name and model here>`);

  if (ctx?.categoryName) {
    parts.push(`CATEGORY: ${ctx.categoryName}`);
  }

  parts.push(HOUSE_STYLE);

  parts.push(
    `RESEARCH RULES
- Use what you actually know about this product. If you are unsure of a fact, leave it out rather than guessing.
- Mark anything you are not certain about with [CHECK] at the end of the line, so I can verify it before publishing.
- Do NOT state a price. I fill prices in myself from live listings.
- Do NOT claim we tested it. That is a separate checkbox and only a human ticks it.`,
  );

  parts.push(FORMAT_RULES);
  parts.push(`FIELDS\n\n${fieldSpecBlock()}`);

  if (ctx?.specFields?.length) {
    parts.push(
      `### Specifications
Fill only these fields, in this order, as "Field: value" lines. Omit any you do not know — a blank is better than a guess, and an invented field name will be rejected outright.

${ctx.specFields.map((s) => `- ${s}`).join("\n")}`,
    );
  }

  if (ctx?.criteria?.length) {
    parts.push(
      `### Score notes
For each criterion below, give me one sentence of evidence I could score from. Do NOT give a number — I set the score myself.

${ctx.criteria.map((c) => `- ${c}`).join("\n")}`,
    );
  }

  return parts.join("\n\n");
}

/** Small, single-field prompts for fixing one thing at a time. */
export const FIELD_PROMPTS: { id: string; title: string; when: string; prompt: string }[] = [
  {
    id: "tagline",
    title: "Tagline",
    when: "The card reads like a listing instead of a recommendation.",
    prompt: `Write 5 candidate taglines for this product, for a review site that tells people whether to buy.

PRODUCT: <name>
WHAT I ALREADY THINK: <one line — your actual opinion>

Rules:
- Max 300 characters, one sentence, no full stop needed.
- It must give a REASON to consider the product, not describe it.
- No superlatives you cannot support. No "revolutionary", "ultimate", "game-changing".
- Number them 1-5 and add nothing else.`,
  },
  {
    id: "summary",
    title: "Why — in one or two sentences",
    when: "You have chosen the stance and need the line that sits beside it.",
    prompt: `Write the one-or-two sentence justification that sits directly beside a buy recommendation, above the fold.

PRODUCT: <name>
MY VERDICT: <buy now | wait for a sale | skip | consider an alternative>
MY REASONS: <two or three bullets in your own words>

Rules:
- Max 400 characters total.
- It has to stand alone: a reader who reads only this must have been answered.
- Name the trade-off, not just the upside.
- Return the sentence(s) only.`,
  },
  {
    id: "verdict",
    title: "Our verdict",
    when: "You know the argument and want it written out properly.",
    prompt: `Write the long-form verdict for a product recommendation page.

PRODUCT: <name>
MY STANCE: <buy now | wait for a sale | skip | consider an alternative>
MY REASONING: <your notes, however rough>
RIVALS I COMPARED IT WITH: <names>

Rules:
- 3 to 5 short paragraphs. No headings, no bullets.
- Open with who should buy it. Then who should not, and why. Then the trade-off you accepted in recommending it.
- Every claim checkable. Mark anything uncertain with [CHECK].
- Do not mention a price. Do not claim it was tested by hand.
- Return the prose only.`,
  },
  {
    id: "proscons",
    title: "Pros and cons",
    when: "The list has drifted into marketing copy.",
    prompt: `Rewrite these into pros and cons for a product page.

PRODUCT: <name>
MY ROUGH NOTES: <paste anything you have>

Rules:
- 4 to 6 pros, 3 to 5 cons. At least one con is mandatory.
- One per line, no bullets, no numbering, no bold.
- Each line specific and checkable, under 100 characters.
- Cons must be real drawbacks a buyer would care about, not "no complaints" filler.
- Output exactly two blocks, headed "PROS" and "CONS", and nothing else.`,
  },
  {
    id: "audience",
    title: "Best for / Not ideal for",
    when: "You need the who-it-suits panel filled.",
    prompt: `List the audiences for this product.

PRODUCT: <name>
WHAT IT IS GOOD AT: <one or two lines>
WHERE IT FALLS DOWN: <one or two lines>

Rules:
- People and situations, never features. "Frequent flyers", not "great ANC".
- 3 to 5 lines each, one per line, no bullets.
- Output exactly two blocks, headed "BEST FOR" and "NOT IDEAL FOR", and nothing else.`,
  },
  {
    id: "seo",
    title: "Meta title and description",
    when: "The searched phrase differs from the on-page name.",
    prompt: `Write SEO metadata for a product review page.

PRODUCT: <name>
CATEGORY: <category>
TAGLINE ALREADY ON THE PAGE: <paste it>

Rules:
- Meta title: max 60 characters, includes the product name, no site name.
- Meta description: max 155 characters, says what the thing is and that we tell you whether to buy it. Not a repeat of the tagline.
- Output two lines, prefixed "TITLE:" and "DESCRIPTION:", and nothing else.`,
  },
  {
    id: "research",
    title: "Turn a spec sheet into a draft",
    when: "You have a manufacturer page or a listing and want it distilled.",
    prompt: `Here is a manufacturer page / retail listing for a product. Strip the marketing out of it.

<paste the page text or the URL here>

Give me:
1. FACTS — the specifications only, as "Field: value" lines. Drop anything unverifiable or purely promotional.
2. CLAIMS — the marketing claims, each rewritten as a neutral statement, each marked [CHECK] because it is the manufacturer's own.
3. GAPS — the things a buyer would want to know that this page does not say.

No praise, no summary, no recommendation.`,
  },
];

/** The paste-back prompt: hand the AI your filled form, get a critique. */
export const REVIEW_PROMPT = `Review this draft product page before I publish it. Be blunt.

<paste every field you have filled in>

Check, in this order:
1. Does the verdict actually answer "should I buy this, at this price, now"? If not, say what is missing.
2. Is any claim unsupported, unverifiable, or lifted from marketing copy? Quote each one.
3. Are the cons real, or are they compliments in disguise?
4. Does the tagline give a reason, or only a description?
5. Does the summary stand alone if the reader reads nothing else?
6. Anything factually doubtful — flag it, do not correct it silently.

Output a numbered list of problems, worst first, each with the fix. If a section is genuinely fine, say so in four words and move on.`;

/** A machine-readable field list, for anyone wiring their own tooling. */
export function buildFieldSchema(): string {
  const rows = PRODUCT_FIELDS.filter((f) => f.key !== "specifications").map((f) => ({
    key: f.key,
    label: f.label,
    required: f.need === "save",
    requiredToPublish: f.need === "publish",
    ...(f.limit ? { limit: f.limit } : {}),
  }));
  return JSON.stringify(rows, null, 2);
}
