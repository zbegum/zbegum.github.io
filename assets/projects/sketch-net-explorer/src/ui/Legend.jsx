import useStore from '../state/store';

const TRANSITION = 'background-color 500ms, border-color 500ms, color 500ms';
const FONT = "'JetBrains Mono', monospace";

export default function Legend() {
  const theme = useStore((s) => s.theme);

  return (
    <div style={{
      position: 'fixed',
      bottom: 12,
      left: 12,
      maxWidth: 'calc(100vw - 24px)',
      background: theme.panelBg,
      border: `1px solid ${theme.panelBorder}`,
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderRadius: 8,
      padding: '10px 14px',
      display: 'flex',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 14,
      zIndex: 10,
      pointerEvents: 'none',
      transition: TRANSITION,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <div style={{ width: 10, height: 10, borderRadius: 2, background: theme.textMuted + '44', flexShrink: 0 }} />
        <span style={{ fontFamily: FONT, fontSize: 10, color: theme.textMuted, lineHeight: 1 }}>sketch</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ fontFamily: FONT, fontSize: 10, color: theme.word, lineHeight: 1, fontWeight: 600 }}>word</span>
        <span style={{ fontFamily: FONT, fontSize: 10, color: theme.textMuted, lineHeight: 1 }}>shared</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ fontFamily: FONT, fontSize: 10, color: theme.word, lineHeight: 1, opacity: 0.4 }}>word</span>
        <span style={{ fontFamily: FONT, fontSize: 10, color: theme.textMuted, lineHeight: 1 }}>unique</span>
      </div>
    </div>
  );
}
