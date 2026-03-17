// ============================================================
// Mention Utilities — Shared extraction and resolution
// ============================================================
// Reuses the same regex pattern used in chat-side-effects.ts
// for consistency across all modules.

/**
 * Extract @mention display names from text content.
 * Matches @Word patterns with accented character support.
 */
export function extractMentions(text: string): string[] {
  const MENTION_RE = /@([A-Za-z\u00C0-\u024F]+)/g;
  const names: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = MENTION_RE.exec(text)) !== null) {
    names.push(match[1]);
  }
  return names;
}

/**
 * Resolve mention display names to user IDs.
 * Case-insensitive matching: exact or startsWith on displayName.
 */
export function resolveMentionUserIds(
  mentionNames: string[],
  members: { id?: string; userId?: string; displayName?: string }[],
): string[] {
  const ids: string[] = [];
  for (const name of mentionNames) {
    const lower = name.toLowerCase();
    const member = members.find(m =>
      m.displayName?.toLowerCase() === lower ||
      m.displayName?.toLowerCase().startsWith(lower)
    );
    const uid = member?.userId || member?.id;
    if (uid && !ids.includes(uid)) {
      ids.push(uid);
    }
  }
  return ids;
}

/**
 * Given old and new text, return only the NEW mentions (not in old text).
 */
export function getNewMentions(oldText: string, newText: string): string[] {
  const oldNames = new Set(extractMentions(oldText).map(n => n.toLowerCase()));
  return extractMentions(newText).filter(n => !oldNames.has(n.toLowerCase()));
}
