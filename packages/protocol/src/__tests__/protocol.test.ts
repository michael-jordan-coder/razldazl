import { describe, it, expect } from 'vitest';
import {
  jsxSourceSchema,
  toolCallSchema,
  wsEnvelopeSchema,
  chatPartSchema,
  previewToEditorSchema,
} from '../index.js';

describe('protocol schemas', () => {
  it('accepts a valid JSXSource', () => {
    expect(
      jsxSourceSchema.parse({ fileName: '/a.tsx', lineNumber: 1, columnNumber: 0 }),
    ).toBeTruthy();
  });

  it('rejects a JSXSource with a zero lineNumber', () => {
    expect(() =>
      jsxSourceSchema.parse({ fileName: '/a.tsx', lineNumber: 0, columnNumber: 0 }),
    ).toThrow();
  });

  it('discriminates tool calls', () => {
    const parsed = toolCallSchema.parse({
      tool: 'setJSXProp',
      args: {
        source: { fileName: '/a.tsx', lineNumber: 1, columnNumber: 0 },
        prop: 'className',
        value: 'text-xl',
      },
    });
    expect(parsed.tool).toBe('setJSXProp');
  });

  it('accepts each structural tool-call variant', () => {
    const source = { fileName: '/a.tsx', lineNumber: 1, columnNumber: 1 };
    expect(
      toolCallSchema.parse({
        tool: 'addElement',
        args: {
          parent: source,
          position: 'end',
          element: { tag: 'div', props: { className: 'x' }, text: 'hi' },
        },
      }).tool,
    ).toBe('addElement');

    expect(
      toolCallSchema.parse({
        tool: 'wrapElement',
        args: { target: source, wrapper: { tag: 'section' } },
      }).tool,
    ).toBe('wrapElement');

    expect(
      toolCallSchema.parse({
        tool: 'deleteElement',
        args: { target: source },
      }).tool,
    ).toBe('deleteElement');

    expect(
      toolCallSchema.parse({
        tool: 'moveElement',
        args: { target: source, newParent: source, position: 'start' },
      }).tool,
    ).toBe('moveElement');
  });

  it('strips text from wrapElement.wrapper (schema omits the field)', () => {
    const source = { fileName: '/a.tsx', lineNumber: 1, columnNumber: 1 };
    const parsed = toolCallSchema.parse({
      tool: 'wrapElement',
      args: { target: source, wrapper: { tag: 'div', text: 'no' } },
    });
    // @ts-expect-error — text is not a declared field on wrapper
    expect(parsed.args.wrapper.text).toBeUndefined();
  });

  it('accepts every envelope variant', () => {
    expect(
      wsEnvelopeSchema.parse({
        type: 'call',
        id: '1',
        api: 'ai',
        method: 'runTurn',
        args: {},
      }),
    ).toBeTruthy();
    expect(
      wsEnvelopeSchema.parse({ type: 'callback', id: '1', ok: true, result: null }),
    ).toBeTruthy();
    expect(
      wsEnvelopeSchema.parse({ type: 'callback', id: '1', ok: false, error: 'boom' }),
    ).toBeTruthy();
    expect(
      wsEnvelopeSchema.parse({ type: 'event', topic: 'chat', data: {} }),
    ).toBeTruthy();
  });

  it('accepts chat parts', () => {
    expect(chatPartSchema.parse({ kind: 'text', id: '1', text: 'hi' })).toBeTruthy();
    expect(
      chatPartSchema.parse({
        kind: 'tool-call',
        id: '1',
        tool: 'setJSXProp',
        args: {},
        state: 'running',
      }),
    ).toBeTruthy();
  });

  it('accepts preview→editor selected event', () => {
    expect(
      previewToEditorSchema.parse({
        kind: 'selected',
        source: { fileName: '/a.tsx', lineNumber: 1, columnNumber: 1 },
        rect: { x: 0, y: 0, width: 10, height: 10 },
        tag: 'div',
        text: 'Hello',
        className: null,
      }),
    ).toBeTruthy();
  });
});
