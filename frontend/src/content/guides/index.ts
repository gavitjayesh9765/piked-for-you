import type { Guide } from "./types";

import { guide as graphicsCards } from "./graphics-cards-explained";
import { guide as laptopProcessors } from "./laptop-processors-explained";
import { guide as smartphoneProcessors } from "./smartphone-processors-explained";

/**
 * The published guides, in the order the index page lists them.
 *
 * ---------------------------------------------------------------------------
 * WHY THE ORDER IS HAND-WRITTEN AND NOT `sort(by date desc)`
 *
 * Reverse-chronological is the right default for a stream of posts, where the
 * newest item is the most relevant by construction. These are not a stream.
 * They are three explainers that were written together, are revised together,
 * and will spend most of their lives with dates that differ by days — sorting
 * them by date would produce an order that shuffles for no reason a reader
 * could perceive, every time one of them is corrected.
 *
 * So the order is editorial: phones first because it is the largest audience
 * and the easiest entry point, laptops second because it shares the most
 * vocabulary with it, graphics last because it is the most specialised and the
 * one that ends in the most expensive purchase.
 *
 * ⚠ IF A FOURTH GUIDE IS ADDED, PLACE IT DELIBERATELY. Appending is a decision
 * about what a first-time reader sees last, not a formality.
 */
export const GUIDES: Guide[] = [smartphoneProcessors, laptopProcessors, graphicsCards];

/** A guide by slug, or undefined. Feeds the route's `notFound()`. */
export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}

/**
 * The most recent revision across all guides.
 *
 * Used as the section's `dateModified` on the index page and as its sitemap
 * `lastModified`. Derived rather than hand-maintained for the reason
 * app/sitemap.ts gives about fabricated timestamps: a hand-written date on a
 * listing page is a date nobody remembers to change, and a listing that claims
 * to be fresher than its contents is a signal Google learns to discount.
 */
export function guidesLastModified(): Date {
  const newest = GUIDES.map((g) => new Date(g.updated).getTime()).sort((a, b) => b - a)[0];
  return new Date(newest ?? Date.now());
}
