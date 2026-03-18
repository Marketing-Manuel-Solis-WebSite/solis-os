// @vitest-environment jsdom
// ================================================================
// Smoke test: CommandPalette — renders, shows search input, hides when closed
// ================================================================
import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen } from './test-utils';

// ---- Mocks ----
vi.mock('@/lib/hooks/use-global-search', () => ({
  useGlobalSearch: () => ({
    results: [],
    actions: [],
    loading: false,
    search: vi.fn(),
  }),
}));

vi.mock('@/lib/semantic-search', () => ({}));

vi.mock('@/lib/search-utils', () => {
  const React = require('react');
  const StubIcon = (props: any) => React.createElement('span', props);
  return {
    SearchResult: {},
    QuickAction: {},
    ENTITY_CONFIG: {
      task: { icon: StubIcon, color: '#3B82F6', labelEs: 'Tareas', labelEn: 'Tasks' },
      doc: { icon: StubIcon, color: '#22C55E', labelEs: 'Documentos', labelEn: 'Documents' },
      channel: { icon: StubIcon, color: '#A855F7', labelEs: 'Canales', labelEn: 'Channels' },
      goal: { icon: StubIcon, color: '#F59E0B', labelEs: 'Metas', labelEn: 'Goals' },
    },
    highlightMatch: (text: string) => [{ text, highlight: false }],
  };
});

vi.mock('cmdk', () => {
  const React = require('react');
  const Command = React.forwardRef(({ children, ...props }: any, ref: any) =>
    React.createElement('div', { ...props, ref, 'data-testid': 'cmdk-root' }, children)
  );
  Command.displayName = 'Command';
  Command.Input = React.forwardRef((props: any, ref: any) =>
    React.createElement('input', { ...props, ref, 'data-testid': 'cmdk-input' })
  );
  Command.List = ({ children, ...props }: any) =>
    React.createElement('div', { ...props, 'data-testid': 'cmdk-list' }, children);
  Command.Empty = ({ children, ...props }: any) =>
    React.createElement('div', { ...props }, children);
  Command.Group = ({ children, heading, ...props }: any) =>
    React.createElement('div', { ...props }, heading, children);
  Command.Item = ({ children, ...props }: any) =>
    React.createElement('div', { ...props }, children);
  return { Command };
});

// ---- Import component under test ----
import CommandPalette from '@/components/command-palette/command-palette';

describe('CommandPalette — smoke tests', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
  };

  test('renders without crashing when open=true', () => {
    const { container } = render(<CommandPalette {...defaultProps} />);
    expect(container.firstChild).not.toBeNull();
  });

  test('does not render content when open=false', () => {
    const { container } = render(<CommandPalette open={false} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  test('shows search input when open', () => {
    render(<CommandPalette {...defaultProps} />);
    const input = screen.getByTestId('cmdk-input');
    expect(input).toBeInTheDocument();
  });
});
