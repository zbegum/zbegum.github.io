import { useEffect, useRef, Component } from 'react';
import GraphContainer from './graph/GraphContainer';
import InfoPanel from './ui/InfoPanel';
import Legend from './ui/Legend';
import SimilaritySlider from './ui/SimilaritySlider';
import ThemeToggle from './ui/ThemeToggle';
import CloseButton from './ui/CloseButton';
import InfoButton from './ui/InfoButton';
import SearchButton from './ui/SearchButton';
import ColorToggle from './ui/ColorToggle';
import ContextFilter from './ui/ContextFilter';
import useStore from './state/store';
import sketchnetJson from './sketchnet.json';
import { parseSketchnetData } from './data/parser';
import { assignClusters } from './data/clustering';

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ color: '#ff4444', padding: 40, fontFamily: 'monospace', fontSize: 14 }}>
          <div>Runtime error:</div>
          <pre style={{ marginTop: 12, whiteSpace: 'pre-wrap' }}>{this.state.error.message}</pre>
          <pre style={{ marginTop: 8, color: '#888', fontSize: 11 }}>{this.state.error.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const STEPS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

// Precompute all thresholds synchronously before first render
const precomputedCache = new Map();
console.time('[SketchNet] Precompute');
for (const threshold of STEPS) {
  const result = parseSketchnetData(sketchnetJson, threshold);
  assignClusters(result.graphData);
  precomputedCache.set(threshold, result);
}
console.timeEnd('[SketchNet] Precompute');

export default function App() {
  const setGraphData = useStore((s) => s.setGraphData);
  const graphData = useStore((s) => s.graphData);
  const minSimilarity = useStore((s) => s.minSimilarity);
  const prevSimilarity = useRef(null);

  useEffect(() => {
    // Skip if already showing this threshold
    if (prevSimilarity.current === minSimilarity) return;
    prevSimilarity.current = minSimilarity;

    const cached = precomputedCache.get(minSimilarity);
    if (!cached) return;

    // Delay swap by a frame so the library's animation loop is stable
    const id = requestAnimationFrame(() => {
      setGraphData(cached.graphData, cached.contexts);
    });
    return () => cancelAnimationFrame(id);
  }, [minSimilarity, setGraphData]);

  return (
    <ErrorBoundary>
      {!graphData && (
        <div style={{
          position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#555', fontFamily: "'JetBrains Mono', monospace", fontSize: 13,
        }}>
          Loading graph...
        </div>
      )}
      <GraphContainer />
      <SearchButton />
      <ContextFilter />
      <ColorToggle />
      <ThemeToggle />
      <CloseButton />
      <InfoPanel />
      <SimilaritySlider />
      <Legend />
      <InfoButton />
    </ErrorBoundary>
  );
}
