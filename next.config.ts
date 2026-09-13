import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // PGlite ships a WASM build that breaks when the bundler rewrites it
  // ("instantiateWasm is not a function"). Loading it from node_modules at
  // runtime keeps the dev/test database working inside the Next server.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default withNextIntl(nextConfig);
