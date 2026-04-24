export const ThinkingIndicator = () => (
  <div
    className="flex items-center gap-2 rounded-[6px] px-2.5 py-1.5 text-[11px]"
    style={{
      background: 'var(--ui-bg-input)',
      color: 'var(--ui-text-secondary)',
    }}
  >
    <span className="inline-flex items-center gap-[3px]" aria-hidden>
      <Dot delay={0} />
      <Dot delay={150} />
      <Dot delay={300} />
    </span>
    <span>Thinking…</span>
  </div>
);

const Dot = ({ delay }: { delay: number }) => (
  <span
    className="inline-block h-1 w-1 rounded-full"
    style={{
      background: 'var(--ui-text-secondary)',
      animation: `thinking 1.2s ease-in-out ${delay}ms infinite`,
    }}
  />
);
