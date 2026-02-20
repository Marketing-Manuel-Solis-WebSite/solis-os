'use client';
import { X, Pin } from 'lucide-react';

interface Props {
  messages: any[];
  members: any[];
  onClose: () => void;
  onUnpin: (msgId: string) => void;
}

export default function PinnedDrawer({ messages, members, onClose, onUnpin }: Props) {
  return (
    <div className="w-[320px] shrink-0 bg-[#0C1017] border-l border-[#1F2937]/60 flex flex-col h-full overflow-hidden anim-slide">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1F2937]/60">
        <div className="flex items-center gap-2">
          <Pin className="h-4 w-4 text-[#D4A843]" />
          <h3 className="text-sm font-bold text-white">Pinned Messages ({messages.length})</h3>
        </div>
        <button onClick={onClose} className="p-2 text-gray-600 hover:text-gray-400 rounded-lg"><X className="h-4 w-4" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 ? (
          <div className="text-center py-10">
            <Pin className="h-8 w-8 text-gray-800 mx-auto mb-2" />
            <p className="text-xs text-gray-700">No pinned messages</p>
          </div>
        ) : messages.map(msg => {
          const time = msg.createdAt?.toDate?.();
          return (
            <div key={msg.id} className="rounded-xl border border-[#D4A843]/10 bg-[#111827] p-3.5 group">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-6 h-6 rounded-full bg-[#D4A843]/10 flex items-center justify-center text-[9px] font-bold text-[#D4A843]">
                  {msg.displayName?.[0]?.toUpperCase()}
                </div>
                <span className="text-xs font-semibold text-white">{msg.displayName}</span>
                {time && <span className="text-[10px] text-gray-700 ml-auto">{time.toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>}
              </div>
              <p className="text-sm text-gray-300 leading-relaxed">{msg.content}</p>
              <button onClick={() => onUnpin(msg.id)}
                className="mt-2 text-[10px] text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition flex items-center gap-1">
                <Pin className="h-3 w-3" /> Unpin
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}