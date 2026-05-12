import { useState } from 'react';
import useStore from '../state/store';

const FONT = "'JetBrains Mono', monospace";
const TRANSITION = 'background-color 500ms, border-color 500ms, color 500ms';

export default function ContextFilter() {
  const [open, setOpen] = useState(false);
  const theme = useStore((s) => s.theme);
  const contexts = useStore((s) => s.contexts);
  const activeContext = useStore((s) => s.activeContext);
  const setActiveContext = useStore((s) => s.setActiveContext);

  if (!contexts || contexts.size === 0) return null;

  const sorted = [...contexts.values()]
    .sort((a, b) => b.edgeCount - a.edgeCount);

  const panelStyle = {
    background: theme.panelBg,
    border: `1px solid ${theme.panelBorder}`,
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    transition: TRANSITION,
  };

  return (
    <div style={{
      position: 'fixed',
      top: 52,
      left: 12,
      zIndex: 20,
    }}>
      {/* Toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          ...panelStyle,
          borderRadius: 8,
          height: 28,
          padding: '0 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          cursor: 'pointer',
          color: activeContext ? theme.text : theme.textMuted,
          fontFamily: FONT,
          fontSize: 10,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = theme.text; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = activeContext ? theme.text : theme.textMuted; }}
      >
        {/* Filter icon */}
        <svg
          width="11" height="11" viewBox="0 0 24 24"
          fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        >
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        {activeContext || 'contexts'}
        {activeContext && (
          <span
            onClick={(e) => { e.stopPropagation(); setActiveContext(activeContext); }}
            style={{ marginLeft: 2, opacity: 0.5, cursor: 'pointer' }}
          >
            ×
          </span>
        )}
      </button>

      {/* Dropdown with context chips */}
      {open && (
        <div style={{
          ...panelStyle,
          marginTop: 4,
          borderRadius: 8,
          padding: 8,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          maxWidth: 'min(320px, calc(100vw - 24px))',
          maxHeight: 'min(240px, calc(100dvh - 120px))',
          overflowY: 'auto',
        }}>
          {sorted.map(({ name, edgeCount, uniqueWords }) => {
            const isActive = activeContext === name;
            return (
              <button
                key={name}
                onClick={() => {
                  setActiveContext(name);
                  setOpen(false);
                }}
                style={{
                  background: isActive ? theme.word + '33' : 'transparent',
                  border: `1px solid ${isActive ? theme.word + '66' : theme.panelBorder}`,
                  borderRadius: 4,
                  padding: '3px 8px',
                  color: isActive ? theme.text : theme.textMuted,
                  fontFamily: FONT,
                  fontSize: 10,
                  cursor: 'pointer',
                  transition: TRANSITION,
                  lineHeight: 1.4,
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.borderColor = theme.word + '44'; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.borderColor = isActive ? theme.word + '66' : theme.panelBorder; }}
              >
                {name}
                <span style={{ opacity: 0.5, marginLeft: 4 }}>
                  {uniqueWords.size}w
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
