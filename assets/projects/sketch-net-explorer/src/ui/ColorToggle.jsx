import useStore from '../state/store';

const TRANSITION = 'background-color 500ms, border-color 500ms, color 500ms';

export default function ColorToggle() {
  const theme = useStore((s) => s.theme);
  const colorSeed = useStore((s) => s.colorSeed);
  const shuffleColors = useStore((s) => s.shuffleColors);
  const active = colorSeed > 0;

  return (
    <button
      onClick={shuffleColors}
      title="Shuffle word colors"
      style={{
        position: 'fixed',
        top: 12,
        right: 72,
        zIndex: 20,
        width: 32,
        height: 32,
        borderRadius: 8,
        background: theme.panelBg,
        border: `1px solid ${theme.panelBorder}`,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        color: active ? theme.text : theme.textMuted,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        lineHeight: 1,
        transition: TRANSITION,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.color = theme.text; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = active ? theme.text : theme.textMuted; }}
    >
      {/* Palette icon */}
      <svg
        width="15" height="15" viewBox="0 0 24 24"
        fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      >
        <circle cx="13.5" cy="6.5" r="2" fill={active ? '#ff00ff' : 'none'} />
        <circle cx="17.5" cy="10.5" r="2" fill={active ? '#00ffcc' : 'none'} />
        <circle cx="8.5" cy="7.5" r="2" fill={active ? '#00ccff' : 'none'} />
        <circle cx="6.5" cy="12" r="2" fill={active ? '#ccff00' : 'none'} />
        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.5-.67 1.5-1.5 0-.38-.14-.72-.38-1-.23-.26-.37-.6-.37-.98 0-.83.67-1.52 1.5-1.52H16c3.31 0 6-2.69 6-6 0-5.52-4.48-9-10-9z" />
      </svg>
    </button>
  );
}
