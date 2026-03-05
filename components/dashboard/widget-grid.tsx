'use client';
import { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence } from 'framer-motion';
import type { WidgetLayout, WidgetProps } from '@/lib/dashboard-types';
import { StatCardWidget } from './widgets/stat-card';
import { TasksByStatusWidget } from './widgets/tasks-by-status';
import { MyTasksWidget } from './widgets/my-tasks';
import { ActivityFeedWidget } from './widgets/activity-feed';
import { GoalsProgressWidget } from './widgets/goals-progress';
import { CompletionTrendWidget } from './widgets/completion-trend';
import { UpcomingDeadlinesWidget } from './widgets/upcoming-deadlines';
import { PriorityBreakdownWidget } from './widgets/priority-breakdown';
import { TeamPerformanceWidget } from './widgets/team-performance';
import { InboxWidget } from './widgets/inbox-widget';
import { AIInsightsWidget } from './widgets/ai-insights';
import { Trash2, GripVertical } from 'lucide-react';

const WIDGET_COMPONENTS: Record<string, React.ComponentType<WidgetProps>> = {
  'stat-card': StatCardWidget,
  'tasks-by-status': TasksByStatusWidget,
  'my-tasks': MyTasksWidget,
  'activity-feed': ActivityFeedWidget,
  'goals-progress': GoalsProgressWidget,
  'completion-trend': CompletionTrendWidget,
  'upcoming-deadlines': UpcomingDeadlinesWidget,
  'priority-breakdown': PriorityBreakdownWidget,
  'team-performance': TeamPerformanceWidget,
  'inbox': InboxWidget,
  'ai-insights': AIInsightsWidget,
};

const MIN_HEIGHTS: Record<string, number> = {
  'stat-card': 150,
};
const DEFAULT_MIN_HEIGHT = 340;
const GAP = 20;

interface WidgetGridProps {
  widgets: WidgetLayout[];
  sharedProps: Omit<WidgetProps, 'config'>;
  editing?: boolean;
  onReorder?: (widgets: WidgetLayout[]) => void;
  onRemove?: (widgetId: string) => void;
}

function WidgetItem({ widget, editing, onRemove, sharedProps, cols }: {
  widget: WidgetLayout;
  editing?: boolean;
  onRemove?: (id: string) => void;
  sharedProps: Omit<WidgetProps, 'config'>;
  cols: number;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.widgetId });

  const span = Math.min(widget.w, cols);
  const minH = MIN_HEIGHTS[widget.type] || DEFAULT_MIN_HEIGHT;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    gridColumn: `span ${span}`,
    minHeight: minH,
    zIndex: isDragging ? 999 : undefined,
  };

  const Component = WIDGET_COMPONENTS[widget.type];
  if (!Component) return null;

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      className="flex flex-col"
      animate={editing && !isDragging ? {
        rotate: [0, -0.3, 0.3, -0.3, 0],
      } : { rotate: 0 }}
      transition={editing && !isDragging ? {
        duration: 0.35,
        repeat: Infinity,
        repeatDelay: 2,
        ease: 'easeInOut',
      } : { duration: 0.15 }}
    >
      {/* Editing controls — inline, no box, just buttons */}
      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="flex items-center justify-between px-1 pb-2">
              <div
                ref={setActivatorNodeRef}
                {...attributes}
                {...listeners}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[var(--text-muted)] cursor-grab active:cursor-grabbing select-none hover:text-[var(--accent)] hover:bg-[var(--accent-subtle)] transition-colors"
              >
                <GripVertical className="h-4 w-4" />
                <span className="text-[12px] font-medium">Mover</span>
              </div>
              <button
                type="button"
                onClick={() => onRemove?.(widget.widgetId)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[var(--text-muted)] cursor-pointer select-none hover:text-red-500 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                <span className="text-[12px] font-medium">Eliminar</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Widget content */}
      <div
        className={`flex-1 min-h-0 rounded-2xl transition-all duration-200 ${
          isDragging ? 'shadow-2xl scale-[1.02]' : ''
        }`}
      >
        <Component {...sharedProps} config={widget.config} />
      </div>
    </motion.div>
  );
}

export default function WidgetGrid({ widgets, sharedProps, editing, onReorder, onRemove }: WidgetGridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(4);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.offsetWidth;
      if (w >= 920) setCols(4);
      else if (w >= 580) setCols(2);
      else setCols(1);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const widgetIds = useMemo(() => widgets.map(w => w.widgetId), [widgets]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !onReorder) return;

    const oldIndex = widgets.findIndex(w => w.widgetId === active.id);
    const newIndex = widgets.findIndex(w => w.widgetId === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    onReorder(arrayMove(widgets, oldIndex, newIndex));
  }, [widgets, onReorder]);

  if (widgets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center mb-4">
          <svg className="h-8 w-8 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
          </svg>
        </div>
        <p className="text-[var(--text-muted)] text-sm">No hay widgets. Personaliza tu dashboard para añadir.</p>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={widgetIds} strategy={rectSortingStrategy}>
        <div
          ref={containerRef}
          className="overflow-visible"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap: GAP,
            padding: 0,
          }}
        >
          {widgets.map((widget, i) => (
            <WidgetItem
              key={widget.widgetId}
              widget={widget}
              sharedProps={sharedProps}
              editing={editing}
              onRemove={onRemove}
              cols={cols}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
