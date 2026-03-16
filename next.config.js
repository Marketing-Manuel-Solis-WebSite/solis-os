const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    domains: ['firebasestorage.googleapis.com', 'lh3.googleusercontent.com'],
  },
  serverExternalPackages: ['firebase-admin'],
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
