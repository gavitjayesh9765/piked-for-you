"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client.
 *
 * Only the URL and the **anon** key appear here. That is by design — the anon
 * key is meant to be public, and Row Level Security is what actually protects
 * the data.
 *
 * The service-role key must NEVER appear in this file or any `NEXT_PUBLIC_*`
 * variable. It bypasses RLS entirely and lives only in the FastAPI environment.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY — see backend/.env.example.",
    );
  }

  return createBrowserClient(url, key);
}
