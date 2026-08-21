import type { Metadata } from "next";

import { getBrands, getCategories } from "@/lib/api";
import { getPreferences, safe, type Preferences } from "@/lib/me-api";
import { PreferencesForm } from "@/components/account/PreferencesForm";

export const metadata: Metadata = { title: "Preferences", robots: { index: false } };
export const dynamic = "force-dynamic";

const BLANK: Preferences = {
  categoryIds: [],
  brandIds: [],
  budgetMin: null,
  budgetMax: null,
  useCase: null,
  notifyPriceDrops: false,
  notifyNewPicks: false,
};

export default async function PreferencesPage() {
  const [categories, brands, initial] = await Promise.all([
    getCategories(),
    getBrands(),
    safe(() => getPreferences(), BLANK),
  ]);

  return (
    <div>
      <header className="mb-10 border-b border-line pb-6">
        <p className="t-eyebrow mb-2">Your account</p>
        <h1 className="font-display text-display-lg text-ink">Preferences</h1>
        <p className="mt-3 max-w-xl text-body-md text-ink-muted">
          Tell us what you&apos;re shopping for and we&apos;ll surface the products worth your
          attention. You can change this any time.
        </p>
      </header>

      <PreferencesForm categories={categories} brands={brands} initial={initial} />
    </div>
  );
}
