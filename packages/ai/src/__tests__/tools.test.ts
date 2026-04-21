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
    ]);
  });

  it('edit tools declare source coords as required input', () => {
    const editTools = toolSchemas.filter((t) => t.name === 'setJSXProp' || t.name === 'updateJSXText');
    expect(editTools).toHaveLength(2);
    for (const tool of editTools) {
      const schema = tool.input_schema as {
        required: string[];
        properties: Record<string, { required?: string[] }>;
      };
      expect(schema.required).toContain('source');
      expect(schema.properties.source?.required).toEqual([
        'fileName',
        'lineNumber',
        'columnNumber',
      ]);
    }
  });

  it('system prompt mentions the tool discipline and design craft', () => {
    expect(SYSTEM_PROMPT).toMatch(/tools/i);
    expect(SYSTEM_PROMPT).toMatch(/source/i);
    expect(SYSTEM_PROMPT).toMatch(/tailwind/i);
    expect(SYSTEM_PROMPT).toMatch(/token/i);
  });
});
