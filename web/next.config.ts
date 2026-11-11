import type { NextConfig } from "next";

const api = process.env.API_URL ?? "http://localhost:8000";

const config: NextConfig = {
  output: "standalone",
  // Same-origin in dev. In prod the Cloudflare Tunnel sends /api and /admin straight to Django, so this is a no-op there.
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${api}/api/:path*` },
      { source: "/admin/:path*", destination: `${api}/admin/:path*` },
    ];
  },
};

export default config;
