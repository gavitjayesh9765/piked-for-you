import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Email confirmation / OAuth callback.
 *
 * Supabase redirects here with a one-time `code`, which we exchange for a
 * session. The exchange happens **server-side**, so the code never sits in
 * client JavaScript where an injected script could read it.
 *
 * Open-redirect defence: `next` is accepted only as a same-origin path.
 * Anything carrying a scheme, a host, or a protocol-relative `//` prefix is
 * discarded — otherwise this endpoint would happily bounce a freshly
 * authenticated user to an attacker's site.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next");

  const next =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.startsWith("/admin")
      ? rawNext
      : "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // Generic failure — never echo the provider's message, which can describe
    // whether the account exists or why the code was rejected.
    return NextResponse.redirect(`${origin}/login?error=invalid_link`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
