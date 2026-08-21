import type { Metadata } from "next";
import { getCategories } from "@/lib/api";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Reset your password",
  robots: { index: false, follow: false },
};

// Auth pages touch the session — never cache them.
export const dynamic = "force-dynamic";

/** Password reset request (spec §27). Linked from the sign-in form. */
export default async function ForgotPasswordPage() {
  const categories = await getCategories();

  return (
    <>
      <SiteHeader categories={categories} />
      <main id="main" className="shell-content py-16 lg:py-24">
        <div className="mx-auto w-full max-w-md">
          <ForgotPasswordForm />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
