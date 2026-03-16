'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Target } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { GOAL_STATUSES, GOAL_TYPES } from './constants';
import type { Goal } from './constants';

interface Props {
  goals: Goal[];
  onSelectGoal: (goal: Goal) => void;
}

// ---- Tree Node ----

interface TreeNodeProps {
  goal: Goal;
  children: Goal[];
  allGoals: Goal[];
  depth: number;
  onSelectGoal: (goal: Goal) => void;
  isLast: boolean;
}

function TreeNode({ goal, children, allGoals, depth, onSelectGoal, isLast }: TreeNodeProps) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(depth < 2); // auto-expand first 2 levels
  const statusInfo = GOAL_STATUSES.find(s => s.value === goal.status) || GOAL_STATUSES[0];
  const goalTypeInfo = GOAL_TYPES.find(gt => gt.value === goal.goalType);
  const hasChildren = children.length > 0;

  return (
    <div className="relative">
      {/* Node row */}
      <div className="flex items-center gap-0 group">
        {/* Expand/collapse button or bullet */}
        <div className="w-6 h-6 flex items-center justify-center shrink-0">
          {hasChildren ? (
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
              className="p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition"
            >
              {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          ) : (
            <div className="w-2 h-2 rounded-full" style={{ background: goal.color || '#7B68EE' }} />
          )}
        </div>

        {/* Node content */}
        <div
          onClick={() => onSelectGoal(goal)}
          className="flex items-center gap-2.5 flex-1 min-w-0 px-3 py-2.5 rounded-xl hover:bg-[var(--bg-hover)] cursor-pointer transition group"
        >
          {/* Color dot (for nodes with children, since bullet is replaced by chevron) */}
          {hasChildren && (
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: goal.color || '#7B68EE' }} />
          )}

          {/* Title */}
          <span className="text-[13px] font-medium text-[var(--text-primary)] truncate flex-1">
            {goal.name}
          </span>

          {/* Goal type badge */}
          {goalTypeInfo && goal.goalType !== 'goal' && (
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0"
              style={{ background: goalTypeInfo.color + '18', color: goalTypeInfo.color }}
            >
              {goal.goalType === 'objective' ? 'OBJ' : 'KR'}
            </span>
          )}

          {/* Status badge */}
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
            style={{ background: statusInfo.color + '18', color: statusInfo.color }}
          >
            {t(statusInfo.labelKey)}
          </span>

          {/* Progress bar */}
          <div className="flex items-center gap-1.5 w-24 shrink-0">
            <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(goal.progress, 100)}%`, background: goal.color || '#7B68EE' }}
              />
            </div>
            <span className="text-[11px] font-medium text-[var(--text-muted)] w-7 text-right">
              {goal.progress}%
            </span>
          </div>
        </div>
      </div>

      {/* Children (with SVG connector lines) */}
      <AnimatePresence initial={false}>
        {expanded && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="relative ml-3 pl-3 border-l-2 border-[var(--border-subtle)]">
              {children.map((child, idx) => {
                const grandchildren = allGoals.filter(g => g.parentGoalId === child.id);
                return (
                  <div key={child.id} className="relative">
                    {/* Horizontal connector line */}
                    <div
                      className="absolute left-[-14px] top-[18px] w-3 h-0 border-t-2 border-[var(--border-subtle)]"
                    />
                    <TreeNode
                      goal={child}
                      children={grandchildren}
                      allGoals={allGoals}
                      depth={depth + 1}
                      onSelectGoal={onSelectGoal}
                      isLast={idx === children.length - 1}
                    />
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---- Main Component ----

export default function GoalTreeView({ goals, onSelectGoal }: Props) {
  const { t } = useI18n();

  // Build tree: top-level goals are those without a parentGoalId
  const topLevel = goals.filter(g => !g.parentGoalId);
  const childrenOf = (parentId: string) => goals.filter(g => g.parentGoalId === parentId);

  if (goals.length === 0) {
    return (
      <div className="text-center py-20">
        <Target className="h-10 w-10 text-[var(--text-muted)]/20 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
          {t('goals.noGoals')}
        </h3>
        <p className="text-[14px] text-[var(--text-muted)]">{t('goals.noGoalsDesc')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-1 rounded-2xl bg-[var(--bg-elevated)] p-4 shadow-card border border-[var(--border-subtle)]">
      {topLevel.map((goal, idx) => (
        <TreeNode
          key={goal.id}
          goal={goal}
          children={childrenOf(goal.id)}
          allGoals={goals}
          depth={0}
          onSelectGoal={onSelectGoal}
          isLast={idx === topLevel.length - 1}
        />
      ))}
    </div>
  );
}
