/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
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
};

export default nextConfig;
