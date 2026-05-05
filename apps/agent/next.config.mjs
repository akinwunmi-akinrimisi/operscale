import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Monorepo: tell Next where the workspace root is so standalone output lays
  // files out at apps/agent/server.js (matching the Dockerfile CMD) instead of
  // collapsing everything to top-level server.js.
  outputFileTracingRoot: path.join(__dirname, '../../'),
  reactStrictMode: true,
  poweredByHeader: false,

  // Webhooks (Paystack, Evolution, Resend) need access to the raw body for HMAC
  // signature verification. Per docs/specs/paystack-integration.md, we read the
  // raw body BEFORE JSON.parse and constant-time-compare the HMAC-SHA512 digest.
  // App Router gives us req.text() / req.arrayBuffer() in route handlers, which
  // preserves bytes — no special config needed unless we add a body parser.

  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },

  // Type-check + lint live in their own CI step (`tsc --noEmit` + `next lint`).
  // Skipping them during `next build` avoids a build-stage redundant pass that
  // can fail on cross-package transitive resolutions even when tsc --noEmit is
  // clean (workspace symlink layouts the build-time type-checker doesn't
  // traverse the same way the dedicated tsc invocation does).
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
