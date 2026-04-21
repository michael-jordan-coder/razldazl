// Small helpers for reading and mutating className strings. The panel uses
// these to find the "current" value of a group (e.g. the current bg-*-* class
// so the color picker can highlight it) and to swap one token for another
// without disturbing siblings.

export function classList(className: string | null | undefined): string[] {
  return (className ?? '').split(/\s+/).filter(Boolean);
}

export function hasClass(className: string | null | undefined, cls: string): boolean {
  return classList(className).includes(cls);
}

/** Find the first class matching a regex. Returns null if none. */
export function findClass(className: string | null | undefined, pattern: RegExp): string | null {
  for (const c of classList(className)) {
    if (pattern.test(c)) return c;
  }
  return null;
}

/** Remove all classes matching a regex. */
export function removeClasses(className: string | null | undefined, pattern: RegExp): string {
  return classList(className)
    .filter((c) => !pattern.test(c))
    .join(' ');
}

/**
 * Replace any class in a group with `next`. If `next` is null, just remove
 * the group. Keeps order stable — appends to the end if the group wasn't
 * present before.
 */
export function replaceGroup(
  className: string | null | undefined,
  pattern: RegExp,
  next: string | null,
): string {
  const list = classList(className);
  const withoutGroup = list.filter((c) => !pattern.test(c));
  if (next === null || next === '') return withoutGroup.join(' ');
  const stillIncludes = list.some((c) => c === next);
  return stillIncludes ? withoutGroup.concat(next).join(' ') : withoutGroup.concat(next).join(' ');
}

/**
 * For spacing scales like p-*, px-*, py-*, gap-*, we match the *-{stepValue}
 * form. stepValue can be a number or a decimal like "0.5", "1.5".
 */
export function spacingGroupPattern(prefix: string): RegExp {
  // Matches e.g. `px-0`, `px-0.5`, `px-2.5`, `px-12`.
  return new RegExp(`^${escapeRegex(prefix)}-(?:\\d+(?:\\.\\d+)?|px)$`);
}

export function colorGroupPattern(prefix: 'bg' | 'text' | 'border'): RegExp {
  // Matches e.g. `bg-slate-500`, `text-blue-600`, `border-red-300`.
  return new RegExp(`^${prefix}-[a-z]+-\\d+$`);
}

export function textSizePattern(): RegExp {
  return /^text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)$/;
}

export function fontWeightPattern(): RegExp {
  return /^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/;
}

export function radiusPattern(): RegExp {
  return /^rounded(?:-(?:none|sm|md|lg|xl|2xl|3xl|full))?$/;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Human-readable spacing step label, e.g. 2 → "2 (8px)", 0.5 → "0.5 (2px)". */
export function spacingLabel(step: number): string {
  return `${step} · ${step * 4}px`;
}
