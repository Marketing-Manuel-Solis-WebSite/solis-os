'use client';
import { motion } from 'framer-motion';
import { PenTool, MoreHorizontal, Users, Calendar, Lock, Globe, UsersRound } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import type { Whiteboard } from './constants';

interface Props {
  boards: Whiteboard[];
  onOpen: (board: Whiteboard) => void;
  onMenu: (board: Whiteboard, e: React.MouseEvent) => void;
}

export default function WhiteboardList({ boards, onOpen, onMenu }: Props) {
  const { t } = useI18n();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {boards.map((board, i) => {
        const updated = board.updatedAt?.toDate?.() || board.createdAt?.toDate?.();
        const timeStr = updated ? updated.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';

        return (
          <motion.div
            key={board.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            whileHover={{ y: -2 }}
            onClick={() => onOpen(board)}
            className="relative rounded-xl cursor-pointer overflow-hidden group"
            style={{
              background: 'var(--bg-elevated)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)',
              border: '1px solid var(--border-subtle, rgba(0,0,0,0.06))',
            }}
          >
            {/* Thumbnail area */}
            <div className="h-32 bg-[var(--bg-base)] relative flex items-center justify-center">
              <div className="grid grid-cols-3 gap-2 p-4 opacity-20">
                <div className="w-8 h-8 rounded bg-yellow-400" />
                <div className="w-8 h-8 rounded bg-blue-400" />
                <div className="w-8 h-8 rounded bg-green-400" />
                <div className="w-8 h-8 rounded bg-pink-400" />
                <div className="w-8 h-8 rounded bg-purple-400" />
                <div className="w-8 h-8 rounded bg-orange-400" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition bg-black/20">
                <span className="px-3 py-1.5 rounded-lg bg-white/90 text-sm font-medium text-gray-800">{t('whiteboards.openBoard')}</span>
              </div>
              <button
                onClick={e => { e.stopPropagation(); onMenu(board, e); }}
                className="absolute top-2 right-2 p-1 rounded-md bg-white/80 text-gray-600 opacity-0 group-hover:opacity-100 hover:bg-white transition"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>

            {/* Visibility badge */}
            {board.visibility === 'private' && (
              <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-500/15 text-red-400 text-[10px] font-bold z-10">
                <Lock className="h-3 w-3" />
                {t('whiteboards.private')}
              </div>
            )}
            {board.visibility === 'public' && (
              <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-500/15 text-blue-400 text-[10px] font-bold z-10">
                <Globe className="h-3 w-3" />
                {t('whiteboards.public')}
              </div>
            )}

            {/* Info */}
            <div className="p-3">
              <div className="flex items-center gap-1.5">
                {board.visibility === 'private' && <Lock className="h-3 w-3 text-red-400 shrink-0" />}
                <h3 className="text-[14px] font-semibold text-[var(--text-primary)] truncate">{board.name}</h3>
              </div>
              {board.description && (
                <p className="text-[12px] text-[var(--text-muted)] mt-0.5 truncate">{board.description}</p>
              )}
              <div className="flex items-center gap-3 mt-2">
                {board.createdByName && (
                  <div className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                    <Users className="h-3 w-3" />
                    <span>{board.createdByName}</span>
                  </div>
                )}
                {timeStr && (
                  <div className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                    <Calendar className="h-3 w-3" />
                    <span>{timeStr}</span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
