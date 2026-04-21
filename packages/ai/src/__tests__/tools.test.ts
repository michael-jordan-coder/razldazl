import { describe, it, expect } from 'vitest';
import { toolSchemas, SYSTEM_PROMPT } from '../tools.js';

describe('ai tools', () => {
  it('exposes the expected tool set', () => {
    const names = toolSchemas.map((t) => t.name);
    expect(names).toEqual([
      'listFiles',
      'readFile',
      'findJSXElement',
      'setJSXProp',
      'updateJSXText',
      'addElement',
      'wrapElement',
      'deleteElement',
      'moveElement',
    ]);
  });

  it('coord-bearing edit tools declare source coords as required input', () => {
    // setJSXProp, updateJSXText, deleteElement take a single coord field named
    // `source` / `target`. addElement, wrapElement, moveElement take multiple.
    const coordFields: Record<string, string> = {
      setJSXProp: 'source',
      updateJSXText: 'source',
      deleteElement: 'target',
    };
    for (const [tool, field] of Object.entries(coordFields)) {
      const schema = toolSchemas.find((t) => t.name === tool)!.input_schema as {
        required: string[];
        properties: Record<string, { required?: string[] }>;
      };
      expect(schema.required).toContain(field);
      expect(schema.properties[field]?.required).toEqual([
        'fileName',
        'lineNumber',
        'columnNumber',
      ]);
    }
  });

  it('structural-edit tools expose their expected shapes', () => {
    const byName = Object.fromEntries(toolSchemas.map((t) => [t.name, t]));

    const add = byName.addElement!.input_schema as { required: string[] };
    expect(add.required).toEqual(['parent', 'position', 'element']);

    const wrap = byName.wrapElement!.input_schema as { required: string[] };
    expect(wrap.required).toEqual(['target', 'wrapper']);

    const move = byName.moveElement!.input_schema as { required: string[] };
    expect(move.required).toEqual(['target', 'newParent', 'position']);
  });

  it('system prompt mentions the tool discipline and design craft', () => {
    expect(SYSTEM_PROMPT).toMatch(/tools/i);
    expect(SYSTEM_PROMPT).toMatch(/source/i);
    expect(SYSTEM_PROMPT).toMatch(/tailwind/i);
    expect(SYSTEM_PROMPT).toMatch(/token/i);
  });
});
