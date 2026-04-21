// Helpers for reading and mutating className strings. The panel uses these
// to find the "current" value of a group (e.g. the current bg-*-* class so
// the color picker can highlight it) and to swap one token for another
// without disturbing siblings.
//
// Unparametrized patterns live as module-scope constants so each render
// reuses a single RegExp instance per group (avoids compiling ~25 regexes
// on every DesignPanel render).

export function classList(className: string | null | undefined): string[] {
  return (className ?? '').split(/\s+/).filter(Boolean);
}

export function hasClass(className: string | null | undefined, cls: string): boolean {
  return classList(className).includes(cls);
}

export function findClass(className: string | null | undefined, pattern: RegExp): string | null {
  for (const c of classList(className)) {
    if (pattern.test(c)) return c;
  }
  return null;
}

export function removeClasses(className: string | null | undefined, pattern: RegExp): string {
  return classList(className)
    .filter((c) => !pattern.test(c))
    .join(' ');
}

/**
 * Replace any class matching `pattern` with `next`. If `next` is null or
 * empty, just strip the group. If `next` is already present outside the
 * group, dedupe. Runs a single classList split per call.
 */
export function replaceGroup(
  className: string | null | undefined,
  pattern: RegExp,
  next: string | null,
): string {
  const withoutGroup = classList(className).filter((c) => !pattern.test(c));
  if (!next) return withoutGroup.join(' ');
  if (withoutGroup.includes(next)) return withoutGroup.join(' ');
  return [...withoutGroup, next].join(' ');
}

// --- Constant patterns (unparametrized) -----------------------------------

export const TEXT_SIZE_PATTERN =
  /^text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)$/;

export const FONT_WEIGHT_PATTERN =
  /^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/;

export const RADIUS_PATTERN = /^rounded(?:-(?:none|sm|md|lg|xl|2xl|3xl|full))?$/;

export const FLEX_DIRECTION_PATTERN = /^flex-(row|col)(-reverse)?$/;

export const ALIGN_ITEMS_PATTERN = /^items-(start|center|end|stretch|baseline)$/;

export const JUSTIFY_CONTENT_PATTERN =
  /^justify-(start|center|end|between|around|evenly)$/;

// Explicit whitelist — cannot collide with text-{size} (text-sm) or
// text-{color}-{shade} (text-blue-600).
export const TEXT_ALIGN_PATTERN = /^text-(left|center|right|justify)$/;

export const DISPLAY_MODE_PATTERN = /^(flex|grid)$/;

// Back-compat accessors so existing call sites don't churn.
export const textSizePattern = (): RegExp => TEXT_SIZE_PATTERN;
export const fontWeightPattern = (): RegExp => FONT_WEIGHT_PATTERN;
export const radiusPattern = (): RegExp => RADIUS_PATTERN;
export const flexDirectionPattern = (): RegExp => FLEX_DIRECTION_PATTERN;
export const alignItemsPattern = (): RegExp => ALIGN_ITEMS_PATTERN;
export const justifyContentPattern = (): RegExp => JUSTIFY_CONTENT_PATTERN;
export const textAlignPattern = (): RegExp => TEXT_ALIGN_PATTERN;

// --- Parametrized patterns ------------------------------------------------

const COLOR_PATTERNS: Record<'bg' | 'text' | 'border', RegExp> = {
  bg: /^bg-[a-z]+-\d+$/,
  text: /^text-[a-z]+-\d+$/,
  border: /^border-[a-z]+-\d+$/,
};

export function colorGroupPattern(prefix: 'bg' | 'text' | 'border'): RegExp {
  return COLOR_PATTERNS[prefix];
}

const SPACING_PATTERN_CACHE = new Map<string, RegExp>();

export function spacingGroupPattern(prefix: string): RegExp {
  let pat = SPACING_PATTERN_CACHE.get(prefix);
  if (!pat) {
    pat = new RegExp(`^${escapeRegex(prefix)}-(?:\\d+(?:\\.\\d+)?|px)$`);
    SPACING_PATTERN_CACHE.set(prefix, pat);
  }
  return pat;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** True if the element has `flex` or `grid` in its className. */
export function isFlexContainer(className: string | null | undefined): boolean {
  return hasClass(className, 'flex') || hasClass(className, 'grid');
}

/** Returns which display mode is active, if any. */
export function displayMode(className: string | null | undefined): 'flex' | 'grid' | null {
  if (hasClass(className, 'flex')) return 'flex';
  if (hasClass(className, 'grid')) return 'grid';
  return null;
}

export function spacingLabel(step: number): string {
  return `${step} · ${step * 4}px`;
}
