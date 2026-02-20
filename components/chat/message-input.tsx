'use client';
import { useState, useRef, useEffect } from 'react';
import { Send, X, Reply, Edit2, AtSign, Smile } from 'lucide-react';

interface Props {
  channelName: string;
  members: any[];
  replyTo: any;
  editingMsg: any;
  onSend: (content: string, mentions: string[]) => void;
  onEdit: (msgId: string, content: string) => void;
  onCancelReply: () => void;
  onCancelEdit: () => void;
}

export default function MessageInput({ channelName, members, replyTo, editingMsg, onSend, onEdit, onCancelReply, onCancelEdit }: Props) {
  const [txt, setTxt] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentions, setMentions] = useState<string[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // When editing, prefill content
  useEffect(() => {
    if (editingMsg) {
      setTxt(editingMsg.content || '');
      inputRef.current?.focus();
    }
  }, [editingMsg?.id]);

  // Focus when replying
  useEffect(() => {
    if (replyTo) inputRef.current?.focus();
  }, [replyTo?.id]);

  const handleSubmit = () => {
    if (!txt.trim()) return;
    if (editingMsg) {
      onEdit(editingMsg.id, txt.trim());
      setTxt('');
    } else {
      onSend(txt.trim(), mentions);
      setTxt('');
      setMentions([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    // @ mention
    if (e.key === '@') {
      setShowMentions(true);
      setMentionQuery('');
    }
  };

  const handleChange = (val: string) => {
    setTxt(val);
    // Check if user is typing @mention
    const atMatch = val.match(/@(\w*)$/);
    if (atMatch) {
      setShowMentions(true);
      setMentionQuery(atMatch[1].toLowerCase());
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (member: any) => {
    const atMatch = txt.match(/@(\w*)$/);
    if (atMatch) {
      const before = txt.slice(0, txt.length - atMatch[0].length);
      setTxt(`${before}@${member.displayName} `);
      setMentions([...mentions, member.id]);
    }
    setShowMentions(false);
    inputRef.current?.focus();
  };

  const filteredMembers = members.filter(m =>
    m.displayName?.toLowerCase().includes(mentionQuery)
  ).slice(0, 6);

  return (
    <div className="border-t border-[#1F2937]/60 bg-[#0C1017] shrink-0">
      {/* Reply / Edit banner */}
      {(replyTo || editingMsg) && (
        <div className="flex items-center gap-2 px-5 py-2 border-b border-[#1F2937]/40 bg-[#0A0E16]">
          {replyTo && (
            <>
              <Reply className="h-3.5 w-3.5 text-[#D4A843]" />
              <span className="text-[11px] text-gray-500">Replying to</span>
              <span className="text-[11px] text-[#D4A843] font-semibold">{replyTo.displayName}</span>
              <span className="text-[11px] text-gray-600 truncate flex-1">{replyTo.content?.slice(0, 50)}</span>
              <button onClick={onCancelReply} className="p-1 text-gray-600 hover:text-gray-400"><X className="h-3.5 w-3.5" /></button>
            </>
          )}
          {editingMsg && (
            <>
              <Edit2 className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-[11px] text-blue-400 font-semibold flex-1">Editing message</span>
              <button onClick={() => { onCancelEdit(); setTxt(''); }} className="p-1 text-gray-600 hover:text-gray-400"><X className="h-3.5 w-3.5" /></button>
            </>
          )}
        </div>
      )}

      {/* Mention dropdown */}
      {showMentions && filteredMembers.length > 0 && (
        <div className="mx-5 mb-1 rounded-xl bg-[#111827] border border-[#1F2937] shadow-xl overflow-hidden">
          {filteredMembers.map(m => (
            <button key={m.id} onClick={() => insertMention(m)}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/[0.03] transition">
              <div className="w-6 h-6 rounded-full bg-[#D4A843]/10 flex items-center justify-center text-[10px] font-bold text-[#D4A843]">
                {m.displayName?.[0]?.toUpperCase()}
              </div>
              <span>{m.displayName}</span>
              {m.role && <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#1F2937] text-gray-600 ml-auto">{m.role}</span>}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-4">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={txt}
              onChange={e => handleChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${channelName ? '#' + channelName : ''}... (@ to mention)`}
              rows={1}
              className="w-full px-4 py-2.5 rounded-xl bg-[#111827] border border-[#1F2937] text-sm text-gray-200 placeholder:text-gray-700 outline-none focus:border-[#D4A843]/30 resize-none max-h-32"
              style={{ minHeight: '42px' }}
              onInput={(e) => {
                const t = e.target as HTMLTextAreaElement;
                t.style.height = 'auto';
                t.style.height = Math.min(t.scrollHeight, 128) + 'px';
              }}
            />
          </div>
          <button onClick={handleSubmit} disabled={!txt.trim()}
            className={`h-[42px] px-5 rounded-xl text-sm font-semibold flex items-center gap-2 transition ${
              editingMsg
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/20 hover:bg-blue-500/30'
                : 'btn-gold disabled:opacity-30'
            }`}>
            <Send className="h-4 w-4" />
            {editingMsg ? 'Update' : 'Send'}
          </button>
        </div>
        <div className="flex items-center gap-3 mt-1.5 px-1">
          <span className="text-[10px] text-gray-700">Shift+Enter for new line</span>
          <span className="text-[10px] text-gray-700">@ to mention</span>
        </div>
      </div>
    </div>
  );
}