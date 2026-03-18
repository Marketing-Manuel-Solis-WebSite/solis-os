// @vitest-environment jsdom
// ================================================================
// Smoke test: AutomationTemplatePicker — renders, shows templates, hides when closed
// ================================================================
import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen } from './test-utils';

// ---- Mocks ----
vi.mock('@/lib/automation-templates', () => ({
  AUTOMATION_TEMPLATES: [
    {
      id: 'test-tpl-1',
      name: 'Auto-assign on creation',
      description: 'Assigns a user when a task is created',
      trigger: 'task_created',
      conditions: [],
      actions: [{ type: 'assign_user', config: { userId: 'u1' } }],
      category: 'assignment',
    },
    {
      id: 'test-tpl-2',
      name: 'Change status on assign',
      description: 'Sets status to in_progress when assigned',
      trigger: 'task_assigned',
      conditions: [],
      actions: [{ type: 'change_status', config: { status: 'in_progress' } }],
      category: 'status',
    },
  ],
  getTemplateCategories: () => ['assignment', 'status'],
}));

// ---- Import component under test ----
import AutomationTemplatePicker from '@/components/automations/automation-template-picker';

describe('AutomationTemplatePicker — smoke tests', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onSelect: vi.fn(),
  };

  test('renders without crashing when open=true', () => {
    const { container } = render(<AutomationTemplatePicker {...defaultProps} />);
    expect(container.firstChild).not.toBeNull();
  });

  test('does not render content when open=false', () => {
    const { container } = render(
      <AutomationTemplatePicker open={false} onClose={vi.fn()} onSelect={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  test('shows template names', () => {
    render(<AutomationTemplatePicker {...defaultProps} />);
    expect(screen.getByText('Auto-assign on creation')).toBeInTheDocument();
    expect(screen.getByText('Change status on assign')).toBeInTheDocument();
  });

  test('shows template descriptions', () => {
    render(<AutomationTemplatePicker {...defaultProps} />);
    expect(screen.getByText('Assigns a user when a task is created')).toBeInTheDocument();
  });
});
