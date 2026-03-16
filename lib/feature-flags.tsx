'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getCurrentOrgId, ORG_ID as ORG } from '@/lib/org';



export interface FeatureFlags {
  [key: string]: boolean;
}

/**
 * Default flags — every new feature starts disabled.
 * Activate per-org via Firestore: orgs/{orgId}/settings/featureFlags
 */
const DEFAULT_FLAGS: FeatureFlags = {
  // Bloque C — Data Model
  'custom-statuses': false,
  'enriched-subtasks': false,
  'custom-field-scoping': false,
  // Bloque D — Views
  'view-table': false,
  'view-gantt': false,
  'view-timeline': false,
  'view-workload': false,
  'view-activity': false,
  // Bloque E — Real-time Collaboration
  'tiptap-editor': false,
  'realtime-collab': false,
  'realtime-presence': false,
  'active-viewers': false,
  'edit-locking': false,
  'nested-pages': false,
  'doc-comments': false,
  // Bloque K — Chat v2
  'chat-threads': false,
  'chat-search': false,
  'chat-bookmarks': false,
  // Bloque F — Permissions
  'guest-role': false,
  'granular-permissions': false,
  'share-links': false,
  'invite-system': false,
  'field-level-permissions': false,
  'scoped-permissions': false,
  // Bloque G — Automations v2
  'automation-multi-action': false,
  'automation-branching': false,
  // Bloque H — Integrations
  'slack-integration': false,
  'github-integration': false,
  'google-calendar-sync': false,
  'incoming-webhooks': false,
  'integration-health-checks': false,
  // Bloque J — Goals v2
  'goal-checkins': false,
  'goal-templates': false,
  'goal-status-inference': false,
  // Bloque I — Analytics
  'analytics-burndown': false,
  'analytics-velocity': false,
  'analytics-sla': false,
  'analytics-export': false,
  // Bloque L — AI Enhancement
  'ai-task-assistant': false,
  'ai-writing-assistant': false,
  'ai-automation-suggestions': false,
  'ai-semantic-search': false,
  'dashboard-sharing': false,
  // Bloque M — Platform
  'activity-feed': false,
  'workspace-templates': false,
  'advanced-audit': false,
  'platform-health': false,
  // Bloque E — Inline Comments
  'inline-comments': false,
  // Bloque F — Custom Roles
  'custom-roles': false,
  // Bloque G — Automation Templates
  'automation-templates': false,
  // Bloque H — Slack, GitHub, Calendar, Zapier
  'slack-slash-commands': false,
  'slack-interactions': false,
  'slack-events': false,
  'github-pr-linking': false,
  'google-calendar-ui': false,
  'zapier-integration': false,
  'make-integration': false,
  'outbound-webhooks': false,
  // Bloque I — Export & Reporting
  'pdf-export': false,
  'scheduled-reports': false,
  'time-approval': false,
  // Bloque J — OKR
  'okr-hierarchy': false,
  'goal-tree-viz': false,
  // Bloque L — AI UI
  'ai-decompose-ui': false,
  'ai-workload-ui': false,
  'ai-automation-ui': false,
  'ai-writing-ui': false,
  // Bloque M — Platform
  'pwa': false,
  'favorites': false,
  'multi-tenant': false,
  // Phase 1 — ClickUp parity features
  'view-team': false,
  'global-shortcuts': false,
  'auto-refresh-analytics': false,
  'task-templates': false,
  // Phase 2 — ClickUp parity features
  'automation-scheduled-triggers': false,
  'formula-rollup-fields': false,
  'automation-chat-trigger': false,
  'onboarding-wizard': false,
  'artifact-views': false,
  'relationship-field': false,
  'automation-apply-template': false,
};

interface FeatureFlagContextValue {
  flags: FeatureFlags;
  isEnabled: (flag: string) => boolean;
  loading: boolean;
}

const FeatureFlagContext = createContext<FeatureFlagContextValue>({
  flags: DEFAULT_FLAGS,
  isEnabled: () => false,
  loading: true,
});

export function FeatureFlagProvider({ children }: { children: React.ReactNode }) {
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FLAGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ref = doc(db, 'orgs', getCurrentOrgId(), 'settings', 'featureFlags');
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setFlags(prev => ({ ...prev, ...snap.data() }));
        }
        setLoading(false);
      },
      () => {
        // Document may not exist yet — use defaults silently
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  const isEnabled = useCallback(
    (flag: string) => flags[flag] === true,
    [flags],
  );

  const value = useMemo(
    () => ({ flags, isEnabled, loading }),
    [flags, isEnabled, loading],
  );

  return (
    <FeatureFlagContext.Provider value={value}>
      {children}
    </FeatureFlagContext.Provider>
  );
}

/** Check a single flag inside any component */
export function useFeatureFlag(flag: string): boolean {
  const { isEnabled } = useContext(FeatureFlagContext);
  return isEnabled(flag);
}

/** Access the full flag context */
export function useFeatureFlags() {
  return useContext(FeatureFlagContext);
}
