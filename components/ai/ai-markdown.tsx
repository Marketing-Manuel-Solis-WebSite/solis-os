'use client';
import React, { useMemo } from 'react';
import AICodeBlock from './ai-code-block';

interface Props {
  content: string;
}

// =====================================================
// BLOCK-LEVEL PARSER — splits content into typed blocks
// =====================================================
type Block =
  | { type: 'code'; language: string; code: string }
  | { type: 'table'; rows: string[][] }
  | { type: 'heading'; level: number; text: string }
  | { type: 'blockquote'; lines: string[] }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'checklist'; items: { checked: boolean; text: string }[] }
  | { type: 'hr' }
  | { type: 'paragraph'; text: string };

function parseBlocks(raw: string): Block[] {
  const lines = raw.split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.trimStart().startsWith('```')) {
      const lang = line.trimStart().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push({ type: 'code', language: lang, code: codeLines.join('\n') });
      continue;
    }

    // Table (line has pipes)
    if (/^\|.+\|$/.test(line.trim())) {
      const tableLines: string[] = [];
      while (i < lines.length && /^\|.+\|$/.test(lines[i].trim())) {
        tableLines.push(lines[i]);
        i++;
      }
      const rows: string[][] = [];
      for (const tl of tableLines) {
        const cells = tl.split('|').slice(1, -1).map(c => c.trim());
        // Skip separator rows (---|--)
        if (cells.every(c => /^[-:]+$/.test(c))) continue;
        rows.push(cells);
      }
      if (rows.length > 0) blocks.push({ type: 'table', rows });
      continue;
    }

    // Heading
    const hMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (hMatch) {
      blocks.push({ type: 'heading', level: hMatch[1].length, text: hMatch[2] });
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim()) || /^\*\*\*+$/.test(line.trim())) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // Blockquote
    if (line.trimStart().startsWith('> ')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trimStart().startsWith('> ')) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({ type: 'blockquote', lines: quoteLines });
      continue;
    }

    // Checklist
    if (/^[-*]\s+\[[ xX]\]\s/.test(line)) {
      const items: { checked: boolean; text: string }[] = [];
      while (i < lines.length && /^[-*]\s+\[[ xX]\]\s/.test(lines[i])) {
        const m = lines[i].match(/^[-*]\s+\[([ xX])\]\s(.+)$/);
        if (m) items.push({ checked: m[1] !== ' ', text: m[2] });
        i++;
      }
      blocks.push({ type: 'checklist', items });
      continue;
    }

    // Unordered list
    if (/^[-*]\s+(?!\[)/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ''));
        i++;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ''));
        i++;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    // Empty line — skip
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Paragraph — collect consecutive non-empty, non-special lines
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trimStart().startsWith('```') &&
      !lines[i].trimStart().startsWith('> ') &&
      !/^#{1,4}\s/.test(lines[i]) &&
      !/^[-*]\s/.test(lines[i]) &&
      !/^\d+\.\s/.test(lines[i]) &&
      !/^\|.+\|$/.test(lines[i].trim()) &&
      !/^---+$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: 'paragraph', text: paraLines.join('\n') });
    }
  }

  return blocks;
}

// =====================================================
// INLINE PARSER — handles bold, italic, code, links
// =====================================================
function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Pattern: code, bold-italic, bold, italic, links, strikethrough
  const regex = /(`[^`]+`)|(\*\*\*(.+?)\*\*\*)|(\*\*(.+?)\*\*)|(\*(.+?)\*)|(\[([^\]]+)\]\(([^)]+)\))|(~~(.+?)~~)/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      nodes.push(<span key={key++}>{text.slice(lastIndex, match.index)}</span>);
    }

    if (match[1]) {
      // Inline code
      const code = match[1].slice(1, -1);
      nodes.push(
        <code
          key={key++}
          className="px-1.5 py-0.5 rounded-md text-[0.875em] font-mono bg-[var(--bg-tertiary)] text-[var(--accent)] border border-[var(--border-subtle)]"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {code}
        </code>
      );
    } else if (match[2]) {
      // Bold italic
      nodes.push(<strong key={key++} className="font-semibold text-[var(--text-primary)]"><em>{match[3]}</em></strong>);
    } else if (match[4]) {
      // Bold
      nodes.push(<strong key={key++} className="font-semibold text-[var(--text-primary)]">{match[5]}</strong>);
    } else if (match[6]) {
      // Italic
      nodes.push(<em key={key++} className="italic">{match[7]}</em>);
    } else if (match[8]) {
      // Link
      nodes.push(
        <a
          key={key++}
          href={match[10]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--accent)] underline underline-offset-2 decoration-[var(--accent)]/40 hover:decoration-[var(--accent)] transition-colors"
        >
          {match[9]}
        </a>
      );
    } else if (match[11]) {
      // Strikethrough
      nodes.push(<del key={key++} className="text-[var(--text-muted)] line-through">{match[12]}</del>);
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    nodes.push(<span key={key++}>{text.slice(lastIndex)}</span>);
  }

  return nodes.length > 0 ? nodes : [<span key={0}>{text}</span>];
}

// =====================================================
// MAIN COMPONENT
// =====================================================
export default function AIMarkdown({ content }: Props) {
  const blocks = useMemo(() => parseBlocks(content), [content]);

  return (
    <div className="ai-md space-y-3">
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'code':
            return <AICodeBlock key={i} code={block.code} language={block.language} />;

          case 'heading': {
            const cls = [
              'text-[1.375rem] font-bold mt-5 mb-2 pb-2 border-b border-[var(--border-subtle)]', // h1
              'text-[1.125rem] font-bold mt-4 mb-1.5',    // h2
              'text-base font-semibold mt-3 mb-1',          // h3
              'text-sm font-semibold mt-2 mb-0.5',          // h4
            ][block.level - 1] || 'text-sm font-semibold';
            const Tag = (`h${block.level}`) as 'h1' | 'h2' | 'h3' | 'h4';
            return <Tag key={i} className={`${cls} text-[var(--text-primary)] leading-snug`}>{renderInline(block.text)}</Tag>;
          }

          case 'paragraph':
            return (
              <p key={i} className="text-[0.9375rem] leading-[1.75] text-[var(--text-secondary)]" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                {renderInline(block.text)}
              </p>
            );

          case 'blockquote':
            return (
              <blockquote key={i} className="border-l-2 border-[var(--accent)] pl-4 py-2 my-3 bg-[var(--accent-subtle)] rounded-r-lg">
                {block.lines.map((line, j) => (
                  <p key={j} className="text-[0.9375rem] leading-relaxed text-[var(--text-tertiary)] italic">
                    {renderInline(line)}
                  </p>
                ))}
              </blockquote>
            );

          case 'ul':
            return (
              <ul key={i} className="space-y-1 my-2 pl-1">
                {block.items.map((item, j) => (
                  <li key={j} className="flex gap-2.5 text-[0.9375rem] leading-relaxed text-[var(--text-secondary)]">
                    <span className="text-[var(--text-muted)] shrink-0 mt-[2px]">&#8212;</span>
                    <span style={{ overflowWrap: 'anywhere' }}>{renderInline(item)}</span>
                  </li>
                ))}
              </ul>
            );

          case 'ol':
            return (
              <ol className="space-y-1 my-2 pl-1" key={i}>
                {block.items.map((item, j) => (
                  <li key={j} className="flex gap-2.5 text-[0.9375rem] leading-relaxed text-[var(--text-secondary)]">
                    <span className="text-[var(--text-muted)] shrink-0 font-semibold text-[13px] mt-[2px] min-w-[18px]">{j + 1}.</span>
                    <span style={{ overflowWrap: 'anywhere' }}>{renderInline(item)}</span>
                  </li>
                ))}
              </ol>
            );

          case 'checklist':
            return (
              <div key={i} className="space-y-1.5 my-2">
                {block.items.map((item, j) => (
                  <div key={j} className="flex items-start gap-2.5">
                    <div className={`w-4 h-4 rounded shrink-0 mt-1 flex items-center justify-center text-[10px] ${
                      item.checked
                        ? 'bg-[var(--success)] text-white'
                        : 'border-2 border-[var(--border-strong)] bg-[var(--bg-base)]'
                    }`}>
                      {item.checked && '✓'}
                    </div>
                    <span className={`text-[0.9375rem] leading-relaxed ${item.checked ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text-secondary)]'}`}
                      style={{ overflowWrap: 'anywhere' }}>
                      {renderInline(item.text)}
                    </span>
                  </div>
                ))}
              </div>
            );

          case 'table':
            return (
              <div key={i} className="my-3 overflow-x-auto rounded-xl border border-[var(--border)]" style={{ maxWidth: '100%' }}>
                <table className="w-full text-sm border-collapse">
                  {block.rows.length > 0 && (
                    <thead>
                      <tr className="bg-[var(--bg-tertiary)]">
                        {block.rows[0].map((cell, ci) => (
                          <th key={ci} className="px-3 py-2 text-left text-[12px] font-semibold text-[var(--text-primary)] uppercase tracking-wider border-b border-[var(--border)]">
                            {renderInline(cell)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                  )}
                  <tbody>
                    {block.rows.slice(1).map((row, ri) => (
                      <tr key={ri} className="hover:bg-[var(--bg-hover)] transition-colors">
                        {row.map((cell, ci) => (
                          <td key={ci} className="px-3 py-2 text-[var(--text-secondary)] border-b border-[var(--border-subtle)]" style={{ overflowWrap: 'anywhere' }}>
                            {renderInline(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );

          case 'hr':
            return <hr key={i} className="border-none h-px bg-[var(--border)] my-5" />;

          default:
            return null;
        }
      })}
    </div>
  );
}
