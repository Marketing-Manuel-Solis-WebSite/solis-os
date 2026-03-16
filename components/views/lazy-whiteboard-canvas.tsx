'use client';
import { PenTool } from 'lucide-react';

interface LazyWhiteboardCanvasProps {
  whiteboardId?: string;
}

export default function LazyWhiteboardCanvas({ whiteboardId }: LazyWhiteboardCanvasProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
        <PenTool className="h-8 w-8 text-emerald-400" />
      </div>
      <div className="text-center">
        <p className="text-[14px] font-medium text-[var(--text-primary)] mb-1">Whiteboard</p>
        <p className="text-[12px] text-[var(--text-muted)]">
          {whiteboardId ? `Editing whiteboard ${whiteboardId}` : 'Create a new whiteboard to get started'}
        </p>
      </div>
    </div>
  );
}
