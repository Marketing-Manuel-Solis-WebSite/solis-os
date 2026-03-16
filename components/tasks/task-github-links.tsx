'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/lib/i18n';
import { GitBranch, GitPullRequest, GitCommit, CheckCircle, XCircle, Clock, ExternalLink, Trash2 } from 'lucide-react';
import { getTaskLinks, removeTaskLink, type TaskLink, type TaskLinkType, type TaskLinkStatus } from '@/lib/task-links';

interface Props {
  taskId: string;
  canEdit: boolean;
}

const TYPE_CONFIG: Record<TaskLinkType, { icon: typeof GitBranch; label: string }> = {
  pr: { icon: GitPullRequest, label: 'Pull Request' },
  commit: { icon: GitCommit, label: 'Commit' },
  branch: { icon: GitBranch, label: 'Branch' },
  issue: { icon: GitBranch, label: 'Issue' },
  check_run: { icon: CheckCircle, label: 'CI Check' },
};

function isSafeUrl(url: string): boolean {
  return url.startsWith('https://') || url.startsWith('http://');
}

const STATUS_CONFIG: Record<string, { color: string; icon: typeof CheckCircle }> = {
  open: { color: 'text-green-400', icon: Clock },
  closed: { color: 'text-red-400', icon: XCircle },
  merged: { color: 'text-purple-400', icon: CheckCircle },
  success: { color: 'text-green-400', icon: CheckCircle },
  failure: { color: 'text-red-400', icon: XCircle },
  pending: { color: 'text-yellow-400', icon: Clock },
  active: { color: 'text-blue-400', icon: GitBranch },
};

export default function TaskGithubLinks({ taskId, canEdit }: Props) {
  const { t } = useI18n();
  const [links, setLinks] = useState<TaskLink[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getTaskLinks(taskId)
      .then(result => { if (!cancelled) setLinks(result); })
      .catch(() => { if (!cancelled) setLinks([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [taskId]);

  const handleRemove = async (linkId: string) => {
    try {
      await removeTaskLink(linkId);
      setLinks(prev => prev.filter(l => l.id !== linkId));
    } catch (err) {
      console.error('[TaskGithubLinks] Remove failed:', err);
    }
  };

  if (loading) return null;
  if (links.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="text-[12px] uppercase tracking-[0.06em] text-[var(--text-muted)] font-semibold flex items-center gap-1.5">
        <GitBranch className="h-3.5 w-3.5" />
        GitHub
      </div>
      <div className="space-y-1.5">
        {links.map(link => {
          const typeConf = TYPE_CONFIG[link.type] || TYPE_CONFIG.branch;
          const statusConf = STATUS_CONFIG[link.status] || STATUS_CONFIG.active;
          const TypeIcon = typeConf.icon;
          const StatusIcon = statusConf.icon;

          return (
            <div
              key={link.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-[var(--bg-tertiary)]/60 hover:bg-[var(--bg-tertiary)] transition group"
            >
              <TypeIcon className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] text-[var(--text-primary)] truncate">
                  {link.title}
                </div>
                {link.repo && (
                  <div className="text-[11px] text-[var(--text-muted)] truncate">
                    {link.repo}
                  </div>
                )}
              </div>
              <StatusIcon className={`h-3.5 w-3.5 shrink-0 ${statusConf.color}`} />
              {isSafeUrl(link.url) ? (
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-[var(--text-muted)] hover:text-[var(--accent)] transition"
                  title="Open in GitHub"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : (
                <span
                  className="shrink-0 text-[var(--text-muted)] opacity-50 cursor-not-allowed"
                  title="Invalid URL"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </span>
              )}
              {canEdit && (
                <button
                  onClick={() => link.id && handleRemove(link.id)}
                  className="shrink-0 text-[var(--text-muted)] hover:text-red-400 transition opacity-0 group-hover:opacity-100"
                  title="Remove link"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
