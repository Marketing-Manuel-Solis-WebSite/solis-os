// ================================================================
// Shared test utilities — mocked providers for component tests
// ================================================================

import React, { type ReactElement } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { vi } from 'vitest';

// ---- Global mocks for context providers ----

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
    pathname: '/app',
  }),
  usePathname: () => '/app',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock i18n
vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    lang: 'es',
  }),
  I18nProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock auth
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: { uid: 'test-user-1', email: 'test@solis.com', displayName: 'Test User' },
    loading: false,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock feature flags
vi.mock('@/lib/feature-flags', () => ({
  useFeatureFlag: () => false,
  FeatureFlagProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock toast
vi.mock('@/components/ui/toast-provider', () => ({
  useToast: () => ({
    toast: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock firebase
vi.mock('@/lib/firebase', () => ({
  db: {},
  auth: {},
}));

// Mock framer-motion to avoid animation complexity in tests
vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: (_target, prop) => {
      if (prop === 'div' || prop === 'span' || prop === 'button' || prop === 'ul' || prop === 'li' || prop === 'p' || prop === 'section' || prop === 'aside' || prop === 'main' || prop === 'header' || prop === 'nav' || prop === 'form' || prop === 'a' || prop === 'h1' || prop === 'h2' || prop === 'h3') {
        return React.forwardRef((props: any, ref: any) => {
          const { initial, animate, exit, transition, variants, whileHover, whileTap, whileFocus, layout, layoutId, onAnimationComplete, ...rest } = props;
          return React.createElement(prop as string, { ...rest, ref });
        });
      }
      return undefined;
    },
  }),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  useAnimation: () => ({ start: vi.fn() }),
  useMotionValue: () => ({ set: vi.fn(), get: () => 0 }),
  useTransform: () => ({ set: vi.fn(), get: () => 0 }),
}));

// ---- Custom render wrapper ----

function AllProviders({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function renderWithProviders(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, { wrapper: AllProviders, ...options });
}

export { renderWithProviders as render };
export { screen, fireEvent, waitFor, within } from '@testing-library/react';
export { vi };
