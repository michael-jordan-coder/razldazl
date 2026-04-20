import { describe, it, expect } from 'vitest';
import { toolSchemas, SYSTEM_PROMPT } from '../tools.js';

describe('ai tools', () => {
  it('exposes both first-slice tools', () => {
    const names = toolSchemas.map((t) => t.name);
    expect(names).toEqual(['setJSXProp', 'updateJSXText']);
  });

  it('each tool declares source coords as required input', () => {
    for (const tool of toolSchemas) {
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

  it('system prompt mentions the tool discipline', () => {
    expect(SYSTEM_PROMPT).toMatch(/tools/i);
    expect(SYSTEM_PROMPT).toMatch(/source/i);
  });
});
