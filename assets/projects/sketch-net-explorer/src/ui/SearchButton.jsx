import { useState, useRef, useEffect, useMemo } from 'react';
import useStore from '../state/store';

const FONT = "'JetBrains Mono', monospace";
const TRANSITION = 'background-color 500ms, border-color 500ms, color 500ms';

export default function SearchButton() {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);
  const theme = useStore((s) => s.theme);
  const graphData = useStore((s) => s.graphData);
  const mode = useStore((s) => s.mode);
  const disabled = mode === 'focused';

  const results = useMemo(() => {
    if (!graphData || !query.trim()) return [];
    const q = query.trim().toLowerCase();
    return graphData.nodes
      .filter((n) => n.type === 'word' && n.label.toLowerCase().includes(q))
      .slice(0, 12);
  }, [graphData, query]);

  const showDropdown = query.trim().length > 0 && focused;

  function handleSelect(node) {
    const handler = useStore.getState()._walkHandler;
    if (handler) handler(node);
    setQuery('');
    if (inputRef.current) inputRef.current.blur();
  }

  function handleRandom() {
    if (disabled || !graphData) return;
    const nodes = graphData.nodes;
    if (nodes.length === 0) return;
    const node = nodes[Math.floor(Math.random() * nodes.length)];
    const handler = useStore.getState()._walkHandler;
    if (handler) handler(node);
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showDropdown) return;
    function handleClick(e) {
      if (inputRef.current && !inputRef.current.parentElement.contains(e.target)) {
        setFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showDropdown]);

  const panelStyle = {
    background: theme.panelBg,
    border: `1px solid ${theme.panelBorder}`,
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    transition: TRANSITION,
  };
  const panelWidth = 'min(200px, calc(100vw - 72px))';

  return (
    <div style={{
      position: 'fixed',
      top: 12,
      left: 12,
      zIndex: 20,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      opacity: disabled ? 0.35 : 1,
      pointerEvents: disabled ? 'none' : 'auto',
    }}>
      {/* Search input */}
      <div style={{ position: 'relative' }}>
        <div style={{
          ...panelStyle,
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          padding: '0 10px',
          height: 32,
          width: panelWidth,
        }}>
          {/* Search icon */}
          <svg
            width="13" height="13" viewBox="0 0 24 24"
            fill="none" stroke={theme.textMuted}
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ flexShrink: 0, marginRight: 8 }}
          >
            <circle cx="10.5" cy="10.5" r="7" />
            <line x1="15.5" y1="15.5" x2="21" y2="21" />
          </svg>

          <input
            ref={inputRef}
            type="text"
            placeholder="search words…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              // Delay so click on result fires first
              setTimeout(() => setFocused(false), 150);
            }}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: theme.text,
              fontFamily: FONT,
              fontSize: 11,
              outline: 'none',
              padding: 0,
              lineHeight: 1,
            }}
          />
        </div>

        {/* Results dropdown */}
        {showDropdown && (
          <div style={{
            ...panelStyle,
            position: 'absolute',
            top: 38,
            left: 0,
            width: panelWidth,
            borderRadius: 8,
            padding: 6,
            maxHeight: 'min(260px, calc(100dvh - 96px))',
            overflowY: 'auto',
            fontFamily: FONT,
          }}>
            {results.length === 0 && (
              <div style={{ color: theme.textMuted, fontSize: 10, padding: '4px 8px' }}>
                no matches
              </div>
            )}
            {results.map((node) => (
              <div
                key={node.id}
                onMouseDown={() => handleSelect(node)}
                onMouseEnter={(e) => { e.currentTarget.style.background = theme.hoverBg; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                style={{
                  padding: '5px 8px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 6,
                }}
              >
                <span style={{ color: theme.word, fontSize: 11 }}>
                  {node.label}
                </span>
                {node.isShared && (
                  <span style={{
                    fontSize: 8,
                    padding: '1px 4px',
                    borderRadius: 3,
                    background: theme.word + '22',
                    color: theme.word,
                    flexShrink: 0,
                  }}>
                    shared
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Random zoom-in button */}
      <button
        onClick={handleRandom}
        title="Random zoom in"
        style={{
          ...panelStyle,
          width: 32,
          height: 32,
          borderRadius: 8,
          color: theme.textMuted,
          fontFamily: FONT,
          fontSize: 15,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          lineHeight: 1,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = theme.text; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = theme.textMuted; }}
      >
        {/* Dice icon */}
        <svg
          width="15" height="15" viewBox="0 0 24 24"
          fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <rect x="2" y="2" width="20" height="20" rx="3" />
          <circle cx="8" cy="8" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="16" cy="8" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="8" cy="16" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="16" cy="16" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      </button>
    </div>
  );
}
