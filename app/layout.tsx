import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/lib/theme';
import { I18nProvider } from '@/lib/i18n';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/next';
export const metadata: Metadata = { title: 'SOLIS CENTER', description: 'Law Office of Manuel Solis' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1B2A4A" />
      </head>
      <body className="antialiased">
        <ThemeProvider><I18nProvider>{children}</I18nProvider></ThemeProvider>
        <SpeedInsights />
        <Analytics />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function() {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
