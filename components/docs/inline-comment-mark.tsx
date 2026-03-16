'use client';

// ================================================================
// CommentMark — TipTap Mark extension that highlights commented
// text with a yellow background. Stores commentId as an attribute.
// ================================================================

import { Mark, mergeAttributes } from '@tiptap/core';

export const CommentMark = Mark.create({
  name: 'inlineComment',

  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-comment-id'),
        renderHTML: (attributes) => {
          if (!attributes.commentId) return {};
          return { 'data-comment-id': attributes.commentId };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'mark[data-comment-id]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'mark',
      mergeAttributes(HTMLAttributes, {
        class: 'inline-comment-highlight',
        style: 'background-color: rgba(255, 213, 79, 0.3); border-bottom: 2px solid rgba(255, 213, 79, 0.7); cursor: pointer; padding: 0 1px; border-radius: 2px;',
      }),
      0,
    ];
  },
});

export default CommentMark;
