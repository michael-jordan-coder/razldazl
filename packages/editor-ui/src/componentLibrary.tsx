// Built-in starter component library. v1 of the UI library integration
// feature ships before the AI-driven shadcn install (sub-deliverables A + B
// in PRODUCT-ROADMAP/features/ui-library-integration.md). Each entry is a
// single-element JSX descriptor — flat by design, since the AST `addElement`
// op takes a flat descriptor (tag + props + optional text).
//
// These work in any Vite + React + Tailwind project (the demo and the
// majority of real-world targets) without external dependencies. When the
// AI-install flow lands, it will append shadcn entries beside these.

import type { JSXElementDescriptor } from '@product/protocol';

export interface ComponentEntry {
  name: string;
  description: string;
  /** Inline preview rendered as a tiny live React node in the picker grid. */
  preview: () => React.ReactNode;
  /** AST descriptor — what gets inserted when the user picks this. */
  descriptor: JSXElementDescriptor;
}

export const STARTER_COMPONENTS: ComponentEntry[] = [
  {
    name: 'Button',
    description: 'Primary action button',
    preview: () => (
      <span className="rounded bg-blue-600 px-2 py-0.5 text-[9px] font-medium text-white">
        Button
      </span>
    ),
    descriptor: {
      tag: 'button',
      props: {
        className:
          'px-4 py-2 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors',
      },
      text: 'Button',
    },
  },
  {
    name: 'Card',
    description: 'Bordered container with subtle shadow',
    preview: () => (
      <span className="block h-5 w-10 rounded border border-gray-300 bg-white shadow-sm" />
    ),
    descriptor: {
      tag: 'div',
      props: {
        className: 'p-6 rounded-lg border border-gray-200 bg-white shadow-sm',
      },
      text: 'Card content',
    },
  },
  {
    name: 'Input',
    description: 'Text input field',
    preview: () => (
      <span className="block h-4 w-12 rounded border border-gray-300 bg-white" />
    ),
    descriptor: {
      tag: 'input',
      props: {
        type: 'text',
        placeholder: 'Enter text...',
        className:
          'w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500',
      },
    },
  },
  {
    name: 'Badge',
    description: 'Small inline label',
    preview: () => (
      <span className="rounded-full bg-blue-100 px-1.5 text-[8px] font-medium text-blue-800">
        Badge
      </span>
    ),
    descriptor: {
      tag: 'span',
      props: {
        className:
          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800',
      },
      text: 'Badge',
    },
  },
  {
    name: 'Heading',
    description: 'Section heading',
    preview: () => <span className="text-[10px] font-bold text-gray-900">Heading</span>,
    descriptor: {
      tag: 'h2',
      props: { className: 'text-2xl font-bold text-gray-900' },
      text: 'Heading',
    },
  },
  {
    name: 'Paragraph',
    description: 'Body copy',
    preview: () => (
      <span className="block text-[8px] leading-tight text-gray-600">
        Lorem ipsum dolor sit
      </span>
    ),
    descriptor: {
      tag: 'p',
      props: { className: 'text-base text-gray-700 leading-relaxed' },
      text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    },
  },
];
