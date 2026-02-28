export function renderMarkdown(md: string): string {
  if (!md) return '';
  let html = md;

  // Escape HTML
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Code blocks (```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, code) => {
    return `<pre class="doc-code-block"><code class="language-${lang}">${code.trim()}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="doc-inline-code">$1</code>');

  // Headers
  html = html.replace(/^######\s+(.+)$/gm, '<h6 class="doc-h6">$1</h6>');
  html = html.replace(/^#####\s+(.+)$/gm, '<h5 class="doc-h5">$1</h5>');
  html = html.replace(/^####\s+(.+)$/gm, '<h4 class="doc-h4">$1</h4>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3 class="doc-h3">$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2 class="doc-h2">$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h1 class="doc-h1">$1</h1>');

  // Bold, italic, strikethrough, underline
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');
  html = html.replace(/__(.+?)__/g, '<u>$1</u>');

  // Horizontal rule
  html = html.replace(/^---$/gm, '<hr class="doc-hr" />');

  // Blockquote
  html = html.replace(/^&gt;\s+(.+)$/gm, '<blockquote class="doc-blockquote">$1</blockquote>');

  // Tables
  html = html.replace(/^(\|.+\|)\n(\|[-| :]+\|)\n((?:\|.+\|\n?)*)/gm, (_m, header, _sep, body) => {
    const heads = header.split('|').filter((c: string) => c.trim()).map((c: string) => `<th class="doc-th">${c.trim()}</th>`).join('');
    const rows = body.trim().split('\n').map((row: string) => {
      const cells = row.split('|').filter((c: string) => c.trim()).map((c: string) => `<td class="doc-td">${c.trim()}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    return `<table class="doc-table"><thead><tr>${heads}</tr></thead><tbody>${rows}</tbody></table>`;
  });

  // Checkbox lists
  html = html.replace(/^- \[x\]\s+(.+)$/gm, '<div class="doc-checkbox checked"><span class="doc-check">✓</span> <span class="doc-check-text done">$1</span></div>');
  html = html.replace(/^- \[ \]\s+(.+)$/gm, '<div class="doc-checkbox"><span class="doc-check-empty">○</span> <span class="doc-check-text">$1</span></div>');

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li class="doc-li">$1</li>');
  html = html.replace(/((?:<li class="doc-li">.*<\/li>\n?)+)/g, '<ul class="doc-ul">$1</ul>');

  // Ordered lists
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li class="doc-oli">$1</li>');
  html = html.replace(/((?:<li class="doc-oli">.*<\/li>\n?)+)/g, '<ol class="doc-ol">$1</ol>');

  // Images (MUST come before links)
  html = html.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    '<figure class="doc-figure"><img src="$2" alt="$1" class="doc-img" loading="lazy" /><figcaption class="doc-figcaption">$1</figcaption></figure>'
  );

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="doc-link" target="_blank" rel="noopener">$1</a>');

  // Paragraphs (lines that aren't already wrapped)
  html = html.replace(/^(?!<[a-z]|$)(.+)$/gm, '<p class="doc-p">$1</p>');

  // Clean up empty paragraphs
  html = html.replace(/<p class="doc-p"><\/p>/g, '<br />');

  return html;
}
