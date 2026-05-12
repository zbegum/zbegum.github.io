import useStore from '../state/store';

const TRANSITION = 'background-color 500ms, border-color 500ms, color 500ms, opacity 300ms';
const FONT = "'JetBrains Mono', monospace";
const STEPS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export default function SimilaritySlider() {
  const theme = useStore((s) => s.theme);
  const mode = useStore((s) => s.mode);
  const minSimilarity = useStore((s) => s.minSimilarity);
  const setMinSimilarity = useStore((s) => s.setMinSimilarity);
  const graphData = useStore((s) => s.graphData);

  const disabled = mode === 'focused';

  let sketchCount = 0;
  let wordCount = 0;
  if (graphData) {
    for (const n of graphData.nodes) {
      if (n.type === 'visual') sketchCount++;
      else wordCount++;
    }
  }
  const edgeCount = graphData ? graphData.links.length : 0;

  return (
    <div style={{
      position: 'fixed',
      bottom: 48,
      left: 12,
      width: 'min(360px, calc(100vw - 24px))',
      background: theme.panelBg,
      border: `1px solid ${theme.panelBorder}`,
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderRadius: 8,
      padding: '10px 14px',
      zIndex: 10,
      opacity: disabled ? 0.45 : 1,
      pointerEvents: disabled ? 'none' : 'auto',
      transition: TRANSITION,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
      }}>
        <span style={{
          fontFamily: FONT,
          fontSize: 10,
          color: theme.textMuted,
          lineHeight: 1,
        }}>
          image–meaning similarity
        </span>
        <span style={{
          fontFamily: FONT,
          fontSize: 11,
          color: theme.text,
          lineHeight: 1,
          fontWeight: 600,
        }}>
          {' '}{'\u2265'} {minSimilarity}
        </span>
      </div>

      {/* Likert scale */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        padding: '0 2px',
      }}>
        {STEPS.map((step) => {
          const selected = step === minSimilarity;
          return (
            <button
              key={step}
              disabled={disabled}
              onClick={() => setMinSimilarity(step)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                background: 'none',
                border: 'none',
                padding: '2px 0',
                cursor: disabled ? 'not-allowed' : 'pointer',
                outline: 'none',
              }}
            >
              <div style={{
                width: selected ? 14 : 10,
                height: selected ? 14 : 10,
                borderRadius: '50%',
                backgroundColor: selected
                  ? theme.text
                  : theme.textMuted + '22',
                border: selected ? `2px solid ${theme.text}` : `1px solid ${theme.textMuted}33`,
                transition: 'all 150ms',
              }} />
              <span style={{
                fontFamily: FONT,
                fontSize: 8,
                color: selected ? theme.text : theme.textMuted + '55',
                fontWeight: selected ? 700 : 400,
                lineHeight: 1,
              }}>
                {step}
              </span>
            </button>
          );
        })}
      </div>

      {/* Counts */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
        gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            backgroundColor: theme.sketch,
          }} />
          <span style={{
            fontFamily: FONT,
            fontSize: 9,
            color: theme.sketch,
            lineHeight: 1,
          }}>
            {sketchCount} sketches
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            backgroundColor: theme.word,
          }} />
          <span style={{
            fontFamily: FONT,
            fontSize: 9,
            color: theme.word,
            lineHeight: 1,
          }}>
            {wordCount} words
          </span>
        </div>
        <span style={{
          fontFamily: FONT,
          fontSize: 9,
          color: theme.textMuted,
          lineHeight: 1,
        }}>
          {edgeCount} edges
        </span>
      </div>
    </div>
  );
}
