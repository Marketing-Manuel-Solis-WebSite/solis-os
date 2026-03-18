// ================================================================
// HTML Sanitization — XSS prevention for user-generated content
// ================================================================
// Uses DOMPurify to strip dangerous elements/attributes while
// preserving legitimate formatting from the rich text editor.

import DOMPurify from 'isomorphic-dompurify';

const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr', 'div', 'span',
  'strong', 'em', 'b', 'i', 'u', 'del', 's',
  'ul', 'ol', 'li',
  'blockquote', 'pre', 'code',
  'a', 'img', 'figure', 'figcaption',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'sup', 'sub', 'mark', 'details', 'summary',
];

const ALLOWED_ATTR = [
  'href', 'src', 'alt', 'title', 'class', 'id',
  'target', 'rel', 'loading', 'width', 'height',
  'colspan', 'rowspan', 'style',
];

/**
 * Sanitize HTML to prevent XSS attacks.
 * Preserves formatting from TipTap/rich text editor output.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
}
