interface Props {
  hasSelection: boolean;
  onPick(text: string): void;
}

const WITH_SELECTION = [
  'Change the color',
  'Make it bigger',
  'Swap the text',
  'Add a hover state',
];

const NO_SELECTION = [
  'Change the button color to blue',
  'Make the heading larger',
  'Add a new section below the hero',
  'Swap the icon for a sparkle',
];

export const EmptyState = ({ hasSelection, onPick }: Props) => {
  const ideas = hasSelection ? WITH_SELECTION : NO_SELECTION;

  return (
    <div className="flex flex-col gap-3 px-1 py-2">
      <div
        className="flex flex-col gap-1"
      >
        <h3
          className="text-[12px] font-semibold"
          style={{ color: 'var(--ui-text)' }}
        >
          {hasSelection ? 'Change this element' : 'Describe a change'}
        </h3>
        <p
          className="text-[11px] leading-[16px]"
          style={{ color: 'var(--ui-text-secondary)' }}
        >
          {hasSelection
            ? "Ask in natural language — I'll modify this element."
            : 'Select an element in the preview, or describe what you want below.'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {ideas.map((idea) => (
          <button
            key={idea}
            type="button"
            onClick={() => onPick(idea)}
            className="rounded-[6px] border px-2 py-1.5 text-left text-[10.5px] leading-[14px] transition-colors hover:border-[var(--ui-border-strong)]"
            style={{
              background: 'var(--ui-bg-input)',
              borderColor: 'var(--ui-border)',
              color: 'var(--ui-text-secondary)',
            }}
          >
            {idea}
          </button>
        ))}
      </div>
    </div>
  );
};
