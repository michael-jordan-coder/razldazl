/**
 * Turn a raw tool-call into a short, human-readable summary line.
 *
 * Cursor's chat reads naturally ("Read Button.tsx", "Edited 3 lines in App.tsx") —
 * we mirror that instead of exposing protocol-level names ("setJSXProp").
 *
 * Unknown tools fall back to the tool name itself; safe for future tools.
 */

type Unknown = Record<string, unknown>;

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function asObj(v: unknown): Unknown | undefined {
  return v && typeof v === 'object' ? (v as Unknown) : undefined;
}

function basename(path: string): string {
  const i = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return i >= 0 ? path.slice(i + 1) : path;
}

function summarizeOp(op: Unknown): string | undefined {
  const kind = str(op.op);
  if (!kind) return undefined;

  switch (kind) {
    case 'setJSXProp': {
      const prop = str(op.prop) ?? 'prop';
      const raw = op.value;
      const label =
        typeof raw === 'string'
          ? `"${raw.length > 28 ? raw.slice(0, 25) + '…' : raw}"`
          : typeof raw === 'number' || typeof raw === 'boolean'
            ? String(raw)
            : 'value';
      return `Set ${prop} to ${label}`;
    }
    case 'updateJSXText': {
      const t = str(op.text);
      return t
        ? `Changed text to "${t.length > 28 ? t.slice(0, 25) + '…' : t}"`
        : 'Changed text';
    }
    case 'addElement':
      return `Added <${str(op.tag) ?? 'element'}>`;
    case 'wrapElement':
      return `Wrapped in <${str(op.tag) ?? 'element'}>`;
    case 'deleteElement':
      return 'Removed element';
    case 'moveElement':
      return 'Moved element';
    default:
      return kind;
  }
}

export interface HumanizedTool {
  title: string;
  detail?: string;
  fileHint?: string;
}

export function humanizeTool(tool: string, args: unknown): HumanizedTool {
  const a = asObj(args) ?? {};

  switch (tool) {
    case 'readFile': {
      const path = str(a.path);
      return {
        title: path ? `Read ${basename(path)}` : 'Read a file',
        fileHint: path,
      };
    }

    case 'listFiles': {
      const dir = str(a.dir);
      return {
        title: dir ? `Browsed ${dir}` : 'Browsed the project',
      };
    }

    case 'findJSXElement': {
      const selector = str(a.selector);
      return {
        title: selector ? `Found ${selector}` : 'Searched for an element',
      };
    }

    case 'applyEdit': {
      const ops = Array.isArray(a.ops) ? a.ops : [];
      const count = ops.length;
      if (count === 0) return { title: 'Applied no changes' };
      if (count === 1) {
        const one = asObj(ops[0]);
        const summary = one ? summarizeOp(one) : undefined;
        return {
          title: summary ?? 'Edited an element',
        };
      }
      return {
        title: `Applied ${count} changes`,
        detail: ops
          .slice(0, 3)
          .map((op) => {
            const o = asObj(op);
            return o ? summarizeOp(o) : undefined;
          })
          .filter((v): v is string => !!v)
          .join(' · '),
      };
    }

    case 'typecheck':
      return { title: 'Typechecked the project' };

    case 'checkBuildErrors':
      return { title: 'Checked for build errors' };

    default:
      return { title: tool };
  }
}
