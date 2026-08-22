"use client";

import { useRoutePending } from "@/lib/use-route-pending";
import { Shuttle } from "@/components/ui/Shuttle";

/**
 * The admin bar's share of the site-wide progress language.
 *
 * The public site puts the shuttle in the sub-nav's bottom border; the panel
 * has no sub-nav, so it goes in the rule under the top bar — the same idea in
 * the same place relative to the navigation that caused it. Deferred by 250ms
 * like every other instance, so the many admin navigations that are already
 * warm show nothing at all.
 */
export function AdminProgress() {
  const { pending } = useRoutePending();
  return pending ? <Shuttle /> : null;
}
