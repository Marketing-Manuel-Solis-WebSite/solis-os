export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError = (...args: unknown[]) => {
  // Dynamic import to avoid bundling Sentry when DSN is not set
  import('@sentry/nextjs').then(Sentry => {
    (Sentry as any).captureRequestError?.(...args);
  }).catch(() => { /* Sentry not available */ });
};
