/**
 * Headers on every response. DeepField is never meant to sit inside another
 * site's frame (that is how click-jacking works), never guesses content types,
 * and keeps the full address of a page to itself when a link leaves the site.
 */
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://accounts.google.com; object-src 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Everything here is available on Vercel's free/Hobby plan.
  // No paid Edge config, no paid observability, no paid image optimisation add-ons.
  experimental: {},
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};
export default nextConfig;
