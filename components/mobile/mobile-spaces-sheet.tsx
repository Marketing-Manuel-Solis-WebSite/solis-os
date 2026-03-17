'use client';

// ============================================================
// Mobile Spaces Sheet — Bottom sheet listing user's accessible
// spaces with quick navigation to each space page.
// ============================================================

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { motion } from 'framer-motion';
import { Layers, ChevronRight, Users } from 'lucide-react';
import BottomSheet from '@/components/mobile/bottom-sheet';

interface Props {
  open: boolean;
  onClose: () => void;
}

// Tap animation
const tapVariants = {
  tap: { scale: 0.97, transition: { duration: 0.1 } },
};

export default function MobileSpacesSheet({ open, onClose }: Props) {
  const { teams } = useAuth();
  const { t, lang } = useI18n();

  // Only show active teams
  const activeTeams = teams.filter(team => team.status !== 'archived');

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.spaces')}
    >
      {activeTeams.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-[var(--text-muted)]">
          <Layers className="h-8 w-8 mb-2 opacity-40" />
          <p className="text-[13px]">
            {lang === 'es' ? 'No hay espacios disponibles' : 'No spaces available'}
          </p>
        </div>
      ) : (
        <div className="space-y-2 pb-4">
          {activeTeams.map(team => (
            <motion.div key={team.id} whileTap="tap" variants={tapVariants}>
              <Link
                href={`/app/spaces/${team.id}`}
                onClick={onClose}
                className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-elevated)] active:bg-[var(--bg-hover)] transition-colors"
              >
                {/* Space icon/color */}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-[16px] shrink-0"
                  style={{ backgroundColor: team.color || 'var(--accent)' }}
                >
                  {team.icon || team.name.charAt(0).toUpperCase()}
                </div>

                {/* Space info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-[var(--text-primary)] truncate">
                    {team.name}
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)] flex items-center gap-1 mt-0.5">
                    <Users className="h-3 w-3" />
                    {team.description || t('mobile.members')}
                  </p>
                </div>

                {/* Chevron */}
                <ChevronRight className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </BottomSheet>
  );
}
