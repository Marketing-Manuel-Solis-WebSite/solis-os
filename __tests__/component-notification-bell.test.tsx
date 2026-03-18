// @vitest-environment jsdom
// ================================================================
// Smoke test: NotificationBell — renders bell, shows badge, opens dropdown
// ================================================================
import { beforeEach } from 'vitest';
import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from './test-utils';

// ---- Mocks ----
const mockNotifications: any[] = [];
const mockUseNotifications = vi.fn(() => ({
  notifications: mockNotifications,
}));

vi.mock('@/components/notifications/notification-context', () => ({
  useNotifications: () => mockUseNotifications(),
}));

vi.mock('@/lib/notifications', () => ({
  markNotificationRead: vi.fn(),
  markAllRead: vi.fn(),
}));

// ---- Import component under test ----
import NotificationBell from '@/components/notifications/notification-bell';

describe('NotificationBell — smoke tests', () => {
  beforeEach(() => {
    mockNotifications.length = 0;
    mockUseNotifications.mockReturnValue({ notifications: [] });
  });

  test('renders bell icon (button is clickable)', () => {
    render(<NotificationBell />);
    // The bell button should be present
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  test('shows badge when unreadCount > 0', () => {
    const unreads = [
      { id: 'n1', type: 'task_assigned', title: 'Test', message: 'Msg', read: false, createdAt: { toDate: () => new Date(), seconds: Date.now() / 1000 } },
      { id: 'n2', type: 'system', title: 'Test 2', message: 'Msg 2', read: false, createdAt: { toDate: () => new Date(), seconds: Date.now() / 1000 } },
    ];
    mockUseNotifications.mockReturnValue({ notifications: unreads });

    render(<NotificationBell />);
    // Badge shows count of unread notifications
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  test('opens dropdown on click', () => {
    mockUseNotifications.mockReturnValue({ notifications: [] });

    render(<NotificationBell />);
    const bellButton = screen.getAllByRole('button')[0];
    fireEvent.click(bellButton);

    // After click, the dropdown header should be visible
    expect(screen.getByText('notif.notifications')).toBeInTheDocument();
  });
});
