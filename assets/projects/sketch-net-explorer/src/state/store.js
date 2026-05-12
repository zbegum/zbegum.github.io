import { create } from 'zustand';
import { THEMES } from '../data/constants';

const useStore = create((set) => ({
  mode: 'overview',
  focusedNode: null,
  previousNode: null,

  // overview hover
  hoveredNode: null,
  highlightNodes: new Set(),
  highlightLinks: new Set(),

  // focused mode groups
  groupBSet: new Set(),
  groupCSet: new Set(),

  activeContext: null,
  minSimilarity: 6,
  colorSeed: 1, // 0 = single color, >0 = colorful (each value = new shuffle)

  graphData: null,
  contexts: new Map(),

  currentTheme: 'light',
  theme: THEMES.light,

  toggleTheme: () => set((state) => {
    const next = state.currentTheme === 'dark' ? 'light' : 'dark';
    return { currentTheme: next, theme: THEMES[next] };
  }),

  setGraphData: (graphData, contexts) => set({ graphData, contexts }),

  hoverNode: (node) => {
    const highlightNodes = new Set();
    const highlightLinks = new Set();
    if (node) {
      highlightNodes.add(node);
      for (const neighbor of node.neighbors) highlightNodes.add(neighbor);
      for (const link of node.links) highlightLinks.add(link);
    }
    set({ hoveredNode: node, highlightNodes, highlightLinks });
  },

  clearHover: () => set({
    hoveredNode: null,
    highlightNodes: new Set(),
    highlightLinks: new Set(),
  }),

  focusNode: (node) => set({
    mode: 'focused',
    focusedNode: node,
    previousNode: null,
    hoveredNode: null,
    highlightNodes: new Set(),
    highlightLinks: new Set(),
    groupBSet: new Set(),
    groupCSet: new Set(),
  }),

  setGroups: (groupBSet, groupCSet) => set({ groupBSet, groupCSet }),

  walkToNode: (node) => set((state) => ({
    previousNode: state.focusedNode,
    focusedNode: node,
    groupBSet: new Set(),
    groupCSet: new Set(),
    activeContext: null,
  })),

  exitFocus: () => set({
    mode: 'overview',
    focusedNode: null,
    previousNode: null,
    hoveredNode: null,
    highlightNodes: new Set(),
    highlightLinks: new Set(),
    groupBSet: new Set(),
    groupCSet: new Set(),
    // activeContext persists across mode changes for global filtering
  }),

  _walkHandler: null,
  registerWalkHandler: (fn) => set({ _walkHandler: fn }),

  _exitHandler: null,
  registerExitHandler: (fn) => set({ _exitHandler: fn }),

  setActiveContext: (context) => set((s) => ({
    activeContext: s.activeContext === context ? null : context,
  })),
  setMinSimilarity: (val) => set({ minSimilarity: val }),
  shuffleColors: () => set((s) => ({ colorSeed: s.colorSeed + 1 })),
}));

export default useStore;
