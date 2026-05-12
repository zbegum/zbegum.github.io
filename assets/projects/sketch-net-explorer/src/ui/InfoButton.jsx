import { useState } from 'react';
import useStore from '../state/store';

const FONT = "'JetBrains Mono', monospace";
const TRANSITION = 'background-color 500ms, border-color 500ms, color 500ms';

const GUIDE = [
  { action: 'Navigate', desc: 'Drag to rotate, right-drag to pan. Scroll zooms toward your cursor.' },
  { action: 'Search', desc: 'Type in the search bar (top-left) to find a word, then click a result to zoom in.' },
  { action: 'Random', desc: 'Click the dice button next to search to jump to a random node.' },
  { action: 'Focus', desc: 'Click any sketch or word to enter focused mode. Its connections arrange in rings around it.' },
  { action: 'Walk', desc: 'In focused mode, click a neighbor to walk to it. Click background or X to exit.' },
  { action: 'Context filter', desc: 'Click "contexts" (below search) to filter edges by context. Works in both overview and focused mode.' },
  { action: 'Similarity', desc: 'Drag the bottom slider to set the minimum image-rate threshold (1–9). Lower = denser graph.' },
  { action: 'Rotate sketch', desc: 'In focused mode, click "rotate 90°" in the info panel to rotate the sketch image.' },
  { action: 'Colors', desc: 'Click the palette button to shuffle word colors. Each click gives a new random palette.' },
  { action: 'Theme', desc: 'Click the sun/moon button to toggle light / dark mode.' },
];

const ENTRIES = [
  {
    term: 'Sketch',
    desc: 'Each sketch image is one of 120 hand-drawn sketches. Click one to enter focused mode and see its interpretations arranged around it.',
  },
  {
    term: 'Interpretation (word)',
    desc: 'Words that participants used to describe a sketch. A small faint dot means the word is unique to one sketch. A larger bright dot means it is shared across multiple sketches.',
  },
  {
    term: 'Shared / Unique',
    desc: 'A shared interpretation appears in more than one sketch — it bridges different visuals. A unique interpretation belongs to only one sketch.',
  },
  {
    term: 'Image–Meaning Similarity',
    desc: 'Each edge carries an image-rate (1–10): how strongly a word matches the sketch image, averaged from annotator ratings. More particles flowing along an edge means a higher score. The threshold slider filters out edges below the chosen value — lower = denser graph, higher = only the strongest associations.',
  },
  {
    term: 'Context',
    desc: 'Each sketch–word pair was also rated for how well the word fits within different situational contexts (e.g. "animal", "furniture"). The top context shown in the info panel is the one with the highest average rating for that connection.',
  },
  {
    term: 'Focused mode',
    desc: 'Clicking a sketch or word rearranges the graph: the selection moves to center, its direct connections form an inner ring, and secondary connections appear as a faint outer ring. Click another item in the rings to "walk" to it, or click the background to exit.',
  },
  {
    term: 'Clusters',
    desc: 'Sketches that share many of the same words are grouped into clusters using Jaccard similarity. Cluster centers are spread on a sphere so related sketches naturally drift together in the 3D view.',
  },
];

export default function InfoButton() {
  const [open, setOpen] = useState(false);
  const theme = useStore((s) => s.theme);

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: 'fixed',
          bottom: 12,
          right: 12,
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: theme.panelBg,
          border: `1px solid ${theme.panelBorder}`,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          color: open ? theme.text : theme.textMuted,
          fontFamily: FONT,
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer',
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: TRANSITION,
          padding: 0,
          lineHeight: 1,
        }}
      >
        ?
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 15,
          }}
        />
      )}

      {open && (
        <div style={{
          position: 'fixed',
          bottom: 48,
          right: 12,
          width: 'min(320px, calc(100vw - 24px))',
          maxHeight: 'calc(100dvh - 64px)',
          overflowY: 'auto',
          background: theme.panelBg,
          border: `1px solid ${theme.panelBorder}`,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: 8,
          padding: '14px 16px',
          zIndex: 20,
          fontFamily: FONT,
          transition: TRANSITION,
        }}>
          {/* ── How to use ── */}
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            color: theme.text,
            marginBottom: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            How to use
          </div>

          {GUIDE.map(({ action, desc }, i) => (
            <div key={i} style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: theme.text }}>{action}</span>
              <span style={{ fontSize: 10, color: theme.textMuted, lineHeight: 1.5 }}> — {desc}</span>
            </div>
          ))}

          {/* ── Divider ── */}
          <div style={{
            height: 1,
            background: theme.panelBorder,
            margin: '14px 0',
          }} />

          {/* ── Glossary ── */}
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            color: theme.text,
            marginBottom: 12,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            Glossary
          </div>

          {ENTRIES.map(({ term, desc }, i) => (
            <div key={i} style={{ marginBottom: i < ENTRIES.length - 1 ? 10 : 0 }}>
              <div style={{
                fontSize: 11,
                fontWeight: 600,
                color: theme.text,
                marginBottom: 2,
              }}>
                {term}
              </div>
              <div style={{
                fontSize: 10,
                color: theme.textMuted,
                lineHeight: 1.5,
              }}>
                {desc}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
