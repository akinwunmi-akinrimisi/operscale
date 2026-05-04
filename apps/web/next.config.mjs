import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Monorepo: tell Next where the workspace root is so standalone output lays
  // files out at apps/web/server.js (matching the Dockerfile CMD) instead of
  // collapsing everything to top-level server.js.
  outputFileTracingRoot: path.join(__dirname, '../../'),
  reactStrictMode: true,
  poweredByHeader: false,

  // Image domains for any future remote thumbnails. Calendar-preview thumbs
  // are local under /public/calendar-preview/.
  images: {
    remotePatterns: [],
  },

  // Per CLAUDE.md "API keys and secrets" rule 3 — guard against accidental
  // service-role-key import on the client. The build will fail loudly if any
  // module under app/ imports SUPABASE_SERVICE_ROLE_KEY.
  webpack: (config, { isServer }) => {
    if (!isServer) {
      const ServerOnlyPlugin = config.plugins.find(
        (p) => p.constructor.name === 'NormalModuleReplacementPlugin',
      );
      // Future: add a tap that errors on `process.env.SUPABASE_SERVICE_ROLE_KEY` references.
      void ServerOnlyPlugin;
    }
    return config;
  },
};

export default nextConfig;
