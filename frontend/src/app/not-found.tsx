import { getCategoriesForChrome } from "@/lib/api";

import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { NotFoundBody } from "@/components/layout/NotFoundBody";

/**
 * The 404 for a URL that matched no route at all.
 *
 * Without this file Next renders its own unstyled page — a different typeface,
 * a white background, and no way back — which is a jarring exit from an
 * otherwise composed site.
 *
 * It carries its own header and footer, and that is not an oversight. This
 * boundary sits at the root segment, above the `(site)` route group, so the
 * site layout never runs for it — there is no shared chrome to inherit. A
 * `notFound()` thrown from inside a public page is a different case entirely
 * and is caught one level down by `app/(site)/not-found.tsx`, which keeps the
 * chrome mounted.
 */
export default async function NotFound() {
  const categories = await getCategoriesForChrome();

  return (
    <>
      <SiteHeader categories={categories} />
      <NotFoundBody />
      <SiteFooter />
    </>
  );
}
