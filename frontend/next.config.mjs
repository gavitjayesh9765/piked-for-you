const nextConfig = {
  reactStrictMode: true,

  /**
   * Per-page budget for prerendering during `next build`. Next's default is 60s
   * and every page that talks to the API is bounded by BUILD_TIMEOUT_MS in
   * src/lib/api.ts — this has to stay comfortably above that, or a slow upstream
   * blows the page budget before its own timeout can fire and the retries can
   * never succeed. That mismatch is what failed the build: a 75s fetch bound
   * inside a 60s page budget is unsatisfiable by construction.
   */
  staticPageGenerationTimeout: 120,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**.sortedchoice.com" },
      // YouTube poster frames for linked product videos
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "**.supabase.co" },
    ],
  },
};

export default nextConfig;
