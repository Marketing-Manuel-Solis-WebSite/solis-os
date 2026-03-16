'use client';

// ============================================================
// Bottom Sheet — Draggable sheet for mobile task details
// ============================================================

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useSwipeGesture } from '@/lib/hooks/use-mobile-detect';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export default function BottomSheet({ open, onClose, title, children }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const startY = useRef(0);
  const dragging = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    dragging.current = true;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragging.current) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) setDragOffset(dy); // Only allow downward drag
  }, []);

  const handleTouchEnd = useCallback(() => {
    dragging.current = false;
    if (dragOffset > 100) {
      onClose();
    }
    setDragOffset(0);
  }, [dragOffset, onClose]);

  // Close on escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] md:hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="absolute bottom-0 left-0 right-0 bg-[var(--bg-base)] rounded-t-2xl shadow-xl max-h-[85vh] flex flex-col transition-transform duration-200"
        style={{ transform: `translateY(${dragOffset}px)` }}
      >
        {/* Handle */}
        <div
          className="flex items-center justify-center py-3 cursor-grab active:cursor-grabbing shrink-0"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-10 h-1 rounded-full bg-[var(--border)]" />
        </div>

        {/* Title */}
        {title && (
          <div className="px-5 pb-3 border-b border-[var(--border-subtle)] shrink-0">
            <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">{title}</h3>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {children}
        </div>
      </div>
    </div>
  );
}
