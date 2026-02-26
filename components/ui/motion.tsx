'use client';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { useEffect, useState, useRef } from 'react';

// ============================================
// PAGE TRANSITION
// ============================================
export function PageTransition({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// STAGGER CONTAINER + ITEM
// ============================================
const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.05 },
  },
};

const staggerItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] } },
};

export function StaggerContainer({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className={className}>
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div variants={staggerItem} className={className}>
      {children}
    </motion.div>
  );
}

// ============================================
// MODAL OVERLAY + CONTENT
// ============================================
export function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

// ============================================
// SLIDE PANEL (for drawers)
// ============================================
export function SlidePanel({ children, side = 'right', width = 360, onClose, className = '' }: {
  children: React.ReactNode;
  side?: 'left' | 'right';
  width?: number;
  onClose?: () => void;
  className?: string;
}) {
  const x = side === 'right' ? width : -width;
  return (
    <motion.div
      initial={{ x, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x, opacity: 0 }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className={`shrink-0 ${className}`}
      style={{ width }}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// HOVER CARD
// ============================================
export function HoverCard({ children, className = '', onClick, style }: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}) {
  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: '0 12px 40px rgba(0,0,0,0.25)' }}
      whileTap={onClick ? { scale: 0.985 } : undefined}
      transition={{ duration: 0.2 }}
      className={className}
      onClick={onClick}
      style={style}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// ANIMATED COUNTER
// ============================================
export function AnimatedCounter({ value, duration = 0.8, className = '' }: {
  value: number;
  duration?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(false);

  useEffect(() => {
    if (ref.current && value === display) return;
    ref.current = true;
    const start = display;
    const diff = value - start;
    if (diff === 0) return;
    const startTime = Date.now();
    const durationMs = duration * 1000;

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + diff * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value, duration]); // eslint-disable-line react-hooks/exhaustive-deps

  return <span className={className}>{display.toLocaleString()}</span>;
}

// ============================================
// FADE IN ON MOUNT
// ============================================
export function FadeIn({ children, delay = 0, className = '' }: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// ANIMATED PRESENCE WRAPPER
// ============================================
export { AnimatePresence, motion };
