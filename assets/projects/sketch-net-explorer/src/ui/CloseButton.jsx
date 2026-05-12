import useStore from '../state/store';

export default function CloseButton() {
  const mode = useStore((s) => s.mode);
  const theme = useStore((s) => s.theme);

  if (mode !== 'focused') return null;

  return (
    <button
      onClick={() => {
        const handler = useStore.getState()._exitHandler;
        if (handler) handler();
      }}
      style={{
        position: 'fixed',
        top: 12,
        left: 12,
        width: 32,
        height: 32,
        border: `1px solid ${theme.panelBorder}`,
        borderRadius: 6,
        background: theme.panelBg,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        color: theme.text,
        fontSize: 16,
        lineHeight: '30px',
        textAlign: 'center',
        cursor: 'pointer',
        zIndex: 20,
        fontFamily: "'JetBrains Mono', monospace",
        padding: 0,
        transition: 'background 200ms, color 200ms',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = theme.hoverBg; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = theme.panelBg; }}
      title="Back to overview"
    >
      &#x2715;
    </button>
  );
}
