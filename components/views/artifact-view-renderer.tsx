'use client';
import { Suspense, lazy } from 'react';
import { Loader2 } from 'lucide-react';
import type { DashboardScopeType } from '@/lib/dashboard-types';

// Lazy-loaded heavy components
const ContextualDashboard = lazy(() => import('@/components/dashboard/contextual-dashboard'));
const DocEditor = lazy(() => import('@/components/views/lazy-doc-editor'));
const FormRenderer = lazy(() => import('@/components/views/lazy-form-renderer'));
const WhiteboardCanvas = lazy(() => import('@/components/views/lazy-whiteboard-canvas'));
const EmbedView = lazy(() => import('@/components/views/embed-view'));

export type ArtifactType = 'dashboard' | 'doc' | 'form' | 'whiteboard' | 'embed';

interface ArtifactViewRendererProps {
  artifactType: ArtifactType;
  /** The entity ID for the artifact (docId, formId, whiteboardId, or scope ID for dashboard) */
  artifactId?: string;
  /** Dashboard scope config — required when artifactType is 'dashboard' */
  scopeType?: DashboardScopeType;
  scopeId?: string;
  /** Pre-loaded data passed through to dashboard */
  tasks?: any[];
  goals?: any[];
  members?: any[];
  /** Callback when embed URL changes (for persistence) */
  onArtifactIdChange?: (newId: string) => void;
}

function LoadingFallback() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-[var(--accent)]/20 animate-ping" />
        <div className="relative w-10 h-10 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
        </div>
      </div>
    </div>
  );
}

export default function ArtifactViewRenderer({
  artifactType,
  artifactId,
  scopeType,
  scopeId,
  tasks,
  goals,
  members,
  onArtifactIdChange,
}: ArtifactViewRendererProps) {
  return (
    <Suspense fallback={<LoadingFallback />}>
      {artifactType === 'dashboard' && scopeType && scopeId && (
        <ContextualDashboard
          scopeType={scopeType}
          scopeId={scopeId}
          tasks={tasks}
          goals={goals}
          members={members}
        />
      )}
      {artifactType === 'doc' && (
        <DocEditor docId={artifactId} />
      )}
      {artifactType === 'form' && (
        <FormRenderer formId={artifactId} />
      )}
      {artifactType === 'whiteboard' && (
        <WhiteboardCanvas whiteboardId={artifactId} />
      )}
      {artifactType === 'embed' && (
        <EmbedView url={artifactId || ''} canEdit onUrlChange={onArtifactIdChange} />
      )}
    </Suspense>
  );
}
