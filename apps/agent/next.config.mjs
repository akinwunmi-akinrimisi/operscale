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

  // Worker code in src/lib/ uses NodeNext .js extensions on relative imports
  // (required at runtime for ESM Node 20). Webpack/turbopack don't resolve
  // .js → .ts automatically, so without this map a `.js` extension on a
  // sibling .ts file causes a "Module not found" error at next build.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
    };
    return config;
  },
};

export default nextConfig;
