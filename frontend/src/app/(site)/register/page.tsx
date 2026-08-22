import type { Metadata } from "next";
import { Suspense } from "react";
import { PublicAuthForm } from "@/components/auth/PublicAuthForm";

export const metadata: Metadata = {
  title: "Create an account",
  robots: { index: false, follow: false },
};

// Auth pages read the session and the `next` parameter — never cache them.
export const dynamic = "force-dynamic";

/**
 * Public register (spec §27).
 *
 * Shoppers only. This flow cannot produce an admin — `app_metadata` is not
 * writable by the client SDK, so there is nothing here to escalate through.
 */
export default async function RegisterPage() {
  return (
    <main id="main" className="shell-content py-16 lg:py-24">
      <div className="mx-auto w-full max-w-md">
        <Suspense fallback={null}>
          <PublicAuthForm mode="register" />
        </Suspense>
      </div>
    </main>
  );
}
