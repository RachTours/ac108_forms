import type { NextConfig } from "next";
import dotenv from "dotenv";
import { resolve } from "node:path";
import { resolveServerApiOrigin } from "./src/lib/server-api-origin";

dotenv.config({ path: resolve(import.meta.dirname, "../../.env") });
const apiOrigin = resolveServerApiOrigin(process.env.API_INTERNAL_URL, process.env.NODE_ENV);

const config: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR?.trim() || ".next",
  output: "standalone",
  outputFileTracingRoot: resolve(import.meta.dirname, "../.."),
  transpilePackages: ["@reviewroom/contracts"],
  poweredByHeader: false,
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${apiOrigin}/api/:path*` },
      { source: "/admin/overview", destination: "/" },
      { source: "/admin/people", destination: "/people" },
      { source: "/admin/submissions", destination: "/submissions" },
      { source: "/admin/submissions/:path*", destination: "/submissions/:path*" },
      { source: "/admin/forms", destination: "/forms" },
      { source: "/admin/forms/:path*", destination: "/forms/:path*" },
      { source: "/admin/team", destination: "/team" },
      { source: "/admin/settings", destination: "/settings" },
      { source: "/reviewer/progress", destination: "/" },
      { source: "/reviewer/submissions", destination: "/submissions" },
      { source: "/reviewer/submissions/:path*", destination: "/submissions/:path*" },
      { source: "/reviewer/forms", destination: "/my-link" },
    ];
  },
  async redirects() {
    return [
      { source: "/people", destination: "/admin/people", permanent: false },
      { source: "/forms", destination: "/admin/forms", permanent: false },
      { source: "/forms/:path*", destination: "/admin/forms/:path*", permanent: false },
      { source: "/team", destination: "/admin/team", permanent: false },
      { source: "/settings", destination: "/admin/settings", permanent: false },
      { source: "/my-link", destination: "/reviewer/forms", permanent: false },
      { source: "/submissions", destination: "/admin/submissions", permanent: false },
      { source: "/submissions/:path*", destination: "/admin/submissions/:path*", permanent: false },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ] }];
  },
};

export default config;
