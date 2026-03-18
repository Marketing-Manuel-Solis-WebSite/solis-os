const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    domains: ['firebasestorage.googleapis.com', 'lh3.googleusercontent.com'],
  },
  serverExternalPackages: ['firebase-admin'],
  eslint: {
    // CI runs ESLint separately (ci.yml) — skip redundant lint during build
    ignoreDuringBuilds: true,
  },
};

module.exports = process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, {
      // Sentry webpack plugin options
      silent: true,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
    }, {
      // Sentry SDK options
      widenClientFileUpload: true,
      disableLogger: true,
      hideSourceMaps: true,
    })
  : nextConfig;
