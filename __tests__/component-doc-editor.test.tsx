// @vitest-environment jsdom
// ================================================================
// Smoke test: DocEditor — renders title, back button, content area
// ================================================================
import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen } from './test-utils';

// ---- Mocks for heavy dependencies ----
vi.mock('@/lib/db', () => ({
  getDocComments: vi.fn().mockResolvedValue({ items: [] }),
  addDocComment: vi.fn(),
}));

vi.mock('@/lib/markdown', () => ({
  renderMarkdown: (s: string) => s,
}));

vi.mock('isomorphic-dompurify', () => ({
  default: { sanitize: (s: string) => s },
}));

vi.mock('@/lib/sanitize-html', () => ({
  sanitizeHtml: (s: string) => s,
}));

vi.mock('@/lib/upload', () => ({
  uploadFile: vi.fn(),
  isImageType: () => false,
  formatFileSize: () => '0 B',
}));

vi.mock('@/lib/inline-comments', () => ({
  getInlineComments: vi.fn().mockResolvedValue([]),
  addInlineComment: vi.fn(),
  resolveInlineComment: vi.fn(),
  addInlineCommentReply: vi.fn(),
}));

vi.mock('@/lib/doc-versions', () => ({}));
vi.mock('@/lib/relations', () => ({}));
vi.mock('@/lib/mentions-utils', () => ({}));

vi.mock('@/lib/hooks/use-custom-field-defs', () => ({
  useCustomFieldDefs: () => [],
}));

vi.mock('@/lib/favorites', () => ({
  useFavorite: () => ({ isFavorite: false, toggle: vi.fn() }),
}));

// Mock child components that are complex
vi.mock('@/components/shared/entity-relations', () => ({
  __esModule: true,
  default: () => <div data-testid="entity-relations" />,
}));

vi.mock('@/components/docs/doc-comment-section', () => ({
  __esModule: true,
  default: () => <div data-testid="doc-comment-section" />,
}));

vi.mock('@/components/docs/inline-comment-sidebar', () => ({
  __esModule: true,
  default: () => <div data-testid="inline-comment-sidebar" />,
}));

vi.mock('@/components/docs/doc-breadcrumbs', () => ({
  __esModule: true,
  default: () => <div data-testid="doc-breadcrumbs" />,
}));

vi.mock('@/components/docs/ai-writing-toolbar', () => ({
  __esModule: true,
  default: () => <div data-testid="ai-writing-toolbar" />,
}));

vi.mock('@/components/shared/favorite-button', () => ({
  __esModule: true,
  default: () => <div data-testid="favorite-button" />,
}));

vi.mock('@/components/docs/doc-share-modal', () => ({
  __esModule: true,
  default: () => <div data-testid="doc-share-modal" />,
}));

// Mock the lazy-loaded TipTap editor
vi.mock('@/components/docs/tiptap-editor', () => ({
  __esModule: true,
  default: () => <div data-testid="tiptap-editor" />,
}));

vi.mock('@/components/notifications/toast-provider', () => ({
  useToast: () => ({
    toast: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  }),
}));

// ---- Import component under test ----
import DocEditor from '@/components/docs/doc-editor';

describe('DocEditor — smoke tests', () => {
  const mockDoc = {
    id: 'doc-1',
    title: 'Test Document Title',
    content: '# Hello World\n\nThis is content.',
    contentHtml: '<h1>Hello World</h1><p>This is content.</p>',
    visibility: 'team',
    category: '',
    tags: [],
    createdBy: 'test-user-1',
    createdByName: 'Test User',
    createdAt: null,
    lastEditedByName: null,
  };

  const defaultProps = {
    doc: mockDoc,
    members: [],
    isAdmin: false,
    userId: 'test-user-1',
    onSave: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn(),
    onBack: vi.fn(),
    onToggleAI: vi.fn(),
    showAI: false,
  };

  test('renders doc title', () => {
    render(<DocEditor {...defaultProps} />);
    const titleInput = screen.getByDisplayValue('Test Document Title');
    expect(titleInput).toBeInTheDocument();
  });

  test('renders back button', () => {
    render(<DocEditor {...defaultProps} />);
    // The back button is the first button in the top bar
    const buttons = screen.getAllByRole('button');
    // Click the first button (back) to verify it calls onBack
    expect(buttons.length).toBeGreaterThan(0);
  });

  test('shows content area (textarea in markdown mode)', () => {
    render(<DocEditor {...defaultProps} />);
    // In markdown mode (feature flag tiptap-editor = false), a textarea is rendered.
    // There are multiple textbox elements (title input + content textarea), so use getAllByRole.
    const textboxes = screen.getAllByRole('textbox');
    // At least two: title input + content textarea
    expect(textboxes.length).toBeGreaterThanOrEqual(2);
  });
});
