import useStore from '../state/store';

const TRANSITION = 'background-color 500ms, border-color 500ms, color 500ms';

function walkTo(node) {
  const handler = useStore.getState()._walkHandler;
  if (handler) handler(node);
}

function Particles({ count, color }) {
  const dots = [];
  for (let i = 0; i < count; i++) {
    dots.push(
      <div key={i} style={{
        width: 3, height: 3, borderRadius: '50%',
        backgroundColor: color,
      }} />
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {dots}
    </div>
  );
}

function rateToParticles(imageRate) {
  const t = (imageRate - 1) / 9;
  return Math.max(1, Math.round(t * t * 6));
}

function getConnectedWords(node) {
  if (node.type !== 'visual') return [];
  const words = [];
  for (const link of node.links) {
    const target = link.source === node || link.source?.id === node.id
      ? (typeof link.target === 'object' ? link.target : null)
      : (typeof link.source === 'object' ? link.source : null);
    if (target && target.type === 'word') {
      words.push({ node: target, imageRate: link.imageRate });
    }
  }
  words.sort((a, b) => b.imageRate - a.imageRate);
  return words;
}

function getConnectedVisuals(node) {
  if (node.type !== 'word') return [];
  const visuals = [];
  for (const link of node.links) {
    const target = link.source === node || link.source?.id === node.id
      ? (typeof link.target === 'object' ? link.target : null)
      : (typeof link.source === 'object' ? link.source : null);
    if (target && target.type === 'visual') {
      visuals.push({ node: target, imageRate: link.imageRate });
    }
  }
  visuals.sort((a, b) => b.imageRate - a.imageRate);
  return visuals;
}

function getContexts(node) {
  const contextCounts = {};
  for (const link of node.links) {
    const ctx = link.context;
    if (ctx) contextCounts[ctx] = (contextCounts[ctx] || 0) + 1;
  }
  return Object.entries(contextCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
}

function ContextChips({ contexts, theme }) {
  const activeContext = useStore((s) => s.activeContext);
  const setActiveContext = useStore((s) => s.setActiveContext);

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {contexts.map(({ name, count }) => {
        const isActive = activeContext === name;
        return (
          <button
            key={name}
            onClick={() => setActiveContext(name)}
            style={{
              background: isActive ? theme.word + '33' : 'transparent',
              border: `1px solid ${isActive ? theme.word + '66' : theme.panelBorder}`,
              borderRadius: 4,
              padding: '2px 7px',
              color: isActive ? theme.text : theme.textMuted,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              cursor: 'pointer',
              transition: TRANSITION,
              lineHeight: 1.4,
            }}
            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.borderColor = theme.word + '44'; }}
            onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.borderColor = theme.panelBorder; }}
          >
            {name}{count != null ? ` (${count})` : ''}
          </button>
        );
      })}
    </div>
  );
}

function wordColor(node, theme) {
  return node.__wordColor || theme.word;
}

function VisualInfo({ node, theme }) {
  const words = getConnectedWords(node);
  const contexts = getContexts(node);
  // subscribe to colorSeed so we re-render when colors shuffle
  useStore((s) => s.colorSeed);
  const edgeColor = theme.edgeRgb === '255,255,255' ? '#ffffff' : '#000000';

  return (
    <>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, lineHeight: 1.3 }}>
        Sketch #{node.sketchIndex}
      </div>
      <div style={{ color: theme.textMuted, fontSize: 11, marginBottom: 8 }}>
        Original class: {node.originalClass}<br />
        Interpretations: {node.wordCount}
      </div>

      <div style={{ color: theme.textMuted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 12, marginBottom: 6 }}>
        Connected words
      </div>
      {words.map(({ node: w, imageRate }) => (
        <div
          key={w.id}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', cursor: 'pointer', borderRadius: 4 }}
          onClick={() => walkTo(w)}
          onMouseEnter={(e) => { e.currentTarget.style.background = theme.hoverBg; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <span style={{ color: wordColor(w, theme) }}>
            {w.label}
            {w.isShared && (
              <span style={{ display: 'inline-block', fontSize: 9, padding: '1px 5px', borderRadius: 3, background: wordColor(w, theme) + '22', color: wordColor(w, theme), marginLeft: 6 }}>
                shared
              </span>
            )}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Particles count={rateToParticles(imageRate)} color={edgeColor + '66'} />
            <span style={{ color: theme.textMuted, fontSize: 11, minWidth: 18, textAlign: 'right' }}>{imageRate}</span>
          </div>
        </div>
      ))}

      {contexts.length > 0 && (
        <>
          <div style={{ color: theme.textMuted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 12, marginBottom: 6 }}>
            Top contexts
          </div>
          <ContextChips contexts={contexts} theme={theme} />
        </>
      )}
    </>
  );
}

function WordInfo({ node, theme }) {
  const visuals = getConnectedVisuals(node);
  const contexts = getContexts(node);
  useStore((s) => s.colorSeed);
  const wc = wordColor(node, theme);
  const edgeColor = theme.edgeRgb === '255,255,255' ? '#ffffff' : '#000000';

  return (
    <>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, lineHeight: 1.3, color: wc }}>
        "{node.label}"
        {node.isShared && (
          <span style={{ display: 'inline-block', fontSize: 9, padding: '1px 5px', borderRadius: 3, background: wc + '22', color: wc, marginLeft: 6 }}>
            shared
          </span>
        )}
      </div>
      <div style={{ color: theme.textMuted, fontSize: 11, marginBottom: 8 }}>
        {node.variants && node.variants.length > 1 && (
          <>Also called: {node.variants.filter(v => v !== node.label).join(', ')}<br /></>
        )}
        Appears in: {visuals.length} visual{visuals.length !== 1 ? 's' : ''}
      </div>

      <div style={{ color: theme.textMuted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 12, marginBottom: 6 }}>
        Connected visuals
      </div>
      {visuals.map(({ node: v, imageRate }) => (
        <div
          key={v.id}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', cursor: 'pointer', borderRadius: 4 }}
          onClick={() => walkTo(v)}
          onMouseEnter={(e) => { e.currentTarget.style.background = theme.hoverBg; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <span style={{ color: theme.sketch }}>Sketch #{v.sketchIndex}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Particles count={rateToParticles(imageRate)} color={edgeColor + '66'} />
            <span style={{ color: theme.textMuted, fontSize: 11, minWidth: 18, textAlign: 'right' }}>{imageRate}</span>
          </div>
        </div>
      ))}

      {contexts.length > 0 && (
        <>
          <div style={{ color: theme.textMuted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 12, marginBottom: 6 }}>
            Contexts seen in
          </div>
          <ContextChips contexts={contexts} theme={theme} />
        </>
      )}
    </>
  );
}

function RotateButton({ node, theme }) {
  if (node.type !== 'visual' || !node.__imgSprite) return null;

  const handleRotate = () => {
    node.__imgSprite.material.rotation -= Math.PI / 2;
  };

  return (
    <button
      onClick={handleRotate}
      style={{
        width: '100%',
        marginTop: 10,
        padding: '5px 0',
        background: 'transparent',
        border: `1px solid ${theme.panelBorder}`,
        borderRadius: 4,
        color: theme.textMuted,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
        cursor: 'pointer',
        transition: TRANSITION,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.color = theme.text; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = theme.textMuted; }}
    >
      rotate 90°
    </button>
  );
}

export default function InfoPanel() {
  const focusedNode = useStore((s) => s.focusedNode);
  const theme = useStore((s) => s.theme);

  if (!focusedNode) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 52,
      right: 12,
      width: 'min(280px, calc(100vw - 24px))',
      maxHeight: 'calc(100dvh - 64px)',
      overflowY: 'auto',
      background: theme.panelBg,
      border: `1px solid ${theme.panelBorder}`,
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderRadius: 8,
      padding: '14px 16px',
      zIndex: 10,
      fontFamily: "'JetBrains Mono', monospace",
      color: theme.text,
      fontSize: 12,
      transition: TRANSITION,
    }}>
      {focusedNode.type === 'visual'
        ? <VisualInfo node={focusedNode} theme={theme} />
        : <WordInfo node={focusedNode} theme={theme} />
      }
      <RotateButton node={focusedNode} theme={theme} />
    </div>
  );
}
