import * as Sentry from '@sentry/nextjs';

// PII scrubbing: strip emails, bearer tokens, and passwords from Sentry events
function scrubPii(str: string | undefined): string | undefined {
  return str
    ?.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
    .replace(/Bearer\s+[A-Za-z0-9\-._~+\/]+=*/g, 'Bearer [REDACTED]')
    .replace(/password["']?\s*[:=]\s*["'][^"']*["']/gi, 'password=[REDACTED]');
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  beforeSend(event) {
    if (event.message) event.message = scrubPii(event.message);
    if (event.exception?.values) {
      event.exception.values.forEach(ex => {
        if (ex.value) ex.value = scrubPii(ex.value);
      });
    }
    event.breadcrumbs?.forEach(bc => {
      if (bc.message) bc.message = scrubPii(bc.message);
      if (bc.data) {
        Object.keys(bc.data).forEach(key => {
          if (typeof bc.data![key] === 'string') {
            bc.data![key] = scrubPii(bc.data![key] as string);
          }
        });
      }
    });
    return event;
  },

  environment: process.env.NODE_ENV,
});
