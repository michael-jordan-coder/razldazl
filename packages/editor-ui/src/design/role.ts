// Role taxonomy for the Design panel. The panel reshapes per role: text
// elements get typography + alignment, buttons get padding + fill, containers
// get layout + gap, etc.
//
// Role classification is heuristic — the preview-agent only sends the
// lowercase HTML tag name (React component names are lost). We use tag + text
// content + className hints. First matching rule wins; order matters.
//
// This is a UI concern only. Classification never affects correctness of the
// underlying AST edits — users can always fall back to the Classes textarea.

import type { Selection } from '../useSelection.js';

export type Role = 'text' | 'button' | 'input' | 'image' | 'container' | 'fallback';

export type SectionId =
  | 'element'
  | 'content'
  | 'typography'
  | 'textAlign'
  | 'fill'
  | 'shape'
  | 'layout'
  | 'padding'
  | 'gap'
  | 'classes';

const TEXT_TAGS = new Set([
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'span',
  'label',
  'li',
  'strong',
  'em',
  'small',
  'blockquote',
  'code',
  'mark',
  'cite',
  'figcaption',
  'summary',
]);

const INPUT_TAGS = new Set(['input', 'textarea', 'select']);
const IMAGE_TAGS = new Set(['img', 'svg', 'picture', 'video', 'canvas']);
const CONTAINER_TAGS = new Set([
  'div',
  'section',
  'main',
  'header',
  'footer',
  'article',
  'aside',
  'nav',
  'ul',
  'ol',
  'form',
  'fieldset',
  'body',
  'html',
  'details',
  'dialog',
]);

export function roleOf(selection: Selection): Role {
  const tag = selection.tag;
  if (INPUT_TAGS.has(tag)) return 'input';
  if (IMAGE_TAGS.has(tag)) return 'image';
  if (tag === 'button') return 'button';
  // A link with only text content reads as a button for styling purposes.
  if (tag === 'a' && selection.text !== null) return 'button';
  if (TEXT_TAGS.has(tag) && selection.text !== null) return 'text';
  if (CONTAINER_TAGS.has(tag)) return 'container';
  return 'fallback';
}

export const ROLE_SECTIONS: Record<Role, readonly SectionId[]> = {
  text: ['element', 'content', 'typography', 'textAlign', 'classes'],
  button: ['element', 'content', 'typography', 'fill', 'shape', 'padding', 'classes'],
  input: ['element', 'fill', 'shape', 'typography', 'padding', 'classes'],
  image: ['element', 'fill', 'shape', 'classes'],
  container: ['element', 'fill', 'shape', 'layout', 'padding', 'gap', 'classes'],
  fallback: ['element', 'fill', 'shape', 'padding', 'classes'],
};

export const ROLE_LABEL: Record<Role, string> = {
  text: 'Text',
  button: 'Button',
  input: 'Input',
  image: 'Image',
  container: 'Container',
  fallback: 'Element',
};
