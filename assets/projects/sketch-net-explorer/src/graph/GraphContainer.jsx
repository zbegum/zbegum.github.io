import { useRef, useState, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import SpriteText from 'three-spritetext';
import ForceGraph3D from 'react-force-graph-3d';
import useStore from '../state/store';
import { WORD_PALETTE_DARK, WORD_PALETTE_LIGHT } from '../data/constants';
import { applyClusterForces } from './clusterForces';
import { flyToFocusedNode, walkCamera, flyToOverview } from './cameraTransitions';
import { enhanceFocusedNeighborhood, clearFocusLabels } from './nodeObjects';
import {
  saveAllPositions,
  computeGroups,
  arrangeAll,
  dissolveAll,
  restoreAll,
  cancelAllAnimations,
} from './radialLayout';

// ─── Texture cache (persists across re-renders) ───
const textureCache = new Map();
const textureLoader = new THREE.TextureLoader();
const OVERVIEW_IMG_SIZE = 10;

const EMPTY_GRAPH = { nodes: [], links: [] };

export default function GraphContainer() {
  const graphRef = useRef();
  const storeGraphData = useStore((s) => s.graphData);
  const [mounted, setMounted] = useState(false);

  // Let ForceGraph3D fully initialize before feeding data
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const graphData = mounted ? storeGraphData : null;
  const mode = useStore((s) => s.mode);
  const focusedNode = useStore((s) => s.focusedNode);
  const hoveredNode = useStore((s) => s.hoveredNode);
  const highlightNodes = useStore((s) => s.highlightNodes);
  const highlightLinks = useStore((s) => s.highlightLinks);
  const groupBSet = useStore((s) => s.groupBSet);
  const groupCSet = useStore((s) => s.groupCSet);
  const currentTheme = useStore((s) => s.currentTheme);
  const theme = useStore((s) => s.theme);
  const colorSeed = useStore((s) => s.colorSeed);
  const activeContext = useStore((s) => s.activeContext);
  const cAlpha = currentTheme === 'dark' ? 0.15 : 0.2;

  useEffect(() => {
    if (!graphRef.current || !graphData) return;
    applyClusterForces(graphRef);
    // Let the simulation run long enough to settle clusters properly
    graphRef.current.d3ReheatSimulation();
  }, [graphData]);

  // ─── Free navigation: zoom toward cursor ───
  useEffect(() => {
    if (!graphRef.current) return;

    const timer = setTimeout(() => {
      const controls = graphRef.current?.controls();
      if (!controls) return;

      // Disable built-in zoom — we handle it ourselves
      controls.noZoom = true;
      controls.noPan = false;
      controls.noRotate = false;
      controls.panSpeed = 1.5;
      controls.rotateSpeed = 2;
    }, 200);

    // Remove fog
    const scene = graphRef.current.scene();
    if (scene) scene.fog = null;

    // Zoom-to-cursor: scroll moves camera toward the 3D point under cursor
    const renderer = graphRef.current.renderer();
    const el = renderer?.domElement;
    if (!el) return () => clearTimeout(timer);

    const mouse = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();
    const ZOOM_FACTOR = 0.08;

    function onWheel(e) {
      e.preventDefault();
      const fg = graphRef.current;
      if (!fg) return;

      const camera = fg.camera();
      const rect = el.getBoundingClientRect();

      // Normalized device coords (-1 to +1)
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      // Direction from camera through cursor
      raycaster.setFromCamera(mouse, camera);
      const dir = raycaster.ray.direction;

      // Zoom amount: negative deltaY = zoom in
      const delta = -Math.sign(e.deltaY) * ZOOM_FACTOR;
      const dist = camera.position.length() || 100;
      const move = dist * delta;

      camera.position.x += dir.x * move;
      camera.position.y += dir.y * move;
      camera.position.z += dir.z * move;

      // Also shift the orbit target so rotation stays centered on where we're looking
      const controls = fg.controls();
      if (controls?.target) {
        controls.target.x += dir.x * move * 0.5;
        controls.target.y += dir.y * move * 0.5;
        controls.target.z += dir.z * move * 0.5;
      }
    }

    el.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      clearTimeout(timer);
      el.removeEventListener('wheel', onWheel);
    };
  }, [graphData]);

  const isDimming = hoveredNode || focusedNode || activeContext;

  // ─── Custom node objects ───
  const handleNodeThreeObject = useCallback((node) => {
    if (node.type === 'visual') {
      // Sketch → image sprite
      const material = new THREE.SpriteMaterial({
        transparent: true,
        opacity: 1,
        depthWrite: false,
        depthTest: false,
      });
      const sprite = new THREE.Sprite(material);
      sprite.renderOrder = 10;
      sprite.scale.set(OVERVIEW_IMG_SIZE, OVERVIEW_IMG_SIZE, 1);

      node.__imgSprite = sprite;
      node.__imgBaseSize = OVERVIEW_IMG_SIZE;

      const url = node.imageUrl;
      if (url) {
        const cached = textureCache.get(url);
        if (cached) {
          material.map = cached;
          material.needsUpdate = true;
        } else {
          textureLoader.load(url, (texture) => {
            textureCache.set(url, texture);
            material.map = texture;
            material.needsUpdate = true;
          });
        }
      }

      return sprite;
    }

    // Word → text label — pick color from current seed
    const { colorSeed: seed, currentTheme: ct } = useStore.getState();
    let wordColor = ct === 'dark' ? '#6cc8c8' : '#2a9d8f';
    if (seed > 0 && node.colorIdx != null) {
      const pal = ct === 'dark' ? WORD_PALETTE_DARK : WORD_PALETTE_LIGHT;
      let shuffled = [...pal];
      let s = seed;
      for (let i = shuffled.length - 1; i > 0; i--) {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        const j = s % (i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      wordColor = shuffled[node.colorIdx % shuffled.length];
    }
    node.__wordColor = wordColor;

    const textSize = node.isShared ? 2.5 : 1.6;
    const wordSprite = new SpriteText(node.label);
    wordSprite.color = wordColor;
    wordSprite.textHeight = textSize;
    wordSprite.fontFace = "'JetBrains Mono', monospace";
    wordSprite.backgroundColor = false;
    wordSprite.material.depthWrite = false;
    wordSprite.material.transparent = true;
    wordSprite.material.opacity = node.isShared ? 0.9 : 0.35;
    node.__wordSprite = wordSprite;

    return wordSprite;
  }, []);

  // ─── Sync custom node opacity with dimming state ───
  // Build set of nodes connected by activeContext edges for fast lookup
  const contextNodeIds = (() => {
    if (!activeContext || !graphData) return null;
    const ids = new Set();
    // In focused mode: only edges from the focused node
    if (focusedNode) {
      ids.add(focusedNode.id);
      for (const link of focusedNode.links) {
        if (link.context === activeContext) {
          const sId = typeof link.source === 'object' ? link.source.id : link.source;
          const tId = typeof link.target === 'object' ? link.target.id : link.target;
          ids.add(sId);
          ids.add(tId);
        }
      }
    } else {
      // In overview mode: all edges matching the context
      for (const link of graphData.links) {
        if (link.context === activeContext) {
          const sId = typeof link.source === 'object' ? link.source.id : link.source;
          const tId = typeof link.target === 'object' ? link.target.id : link.target;
          ids.add(sId);
          ids.add(tId);
        }
      }
    }
    return ids;
  })();

  useEffect(() => {
    if (!graphData) return;
    for (const node of graphData.nodes) {
      const sprite = node.__imgSprite || node.__wordSprite;
      if (!sprite) continue;

      const restAlpha = node.type === 'visual' ? 1
        : node.isShared ? 0.9 : 0.4;

      let opacity;
      if (hoveredNode && !focusedNode) {
        // Overview hover — always takes priority
        opacity = highlightNodes.has(node) ? 1 : 0.06;
      } else if (focusedNode) {
        if (node === focusedNode) opacity = 1;
        else if (groupBSet.has(node.id)) {
          // If context filter active, dim non-matching B neighbors
          opacity = (contextNodeIds && !contextNodeIds.has(node.id)) ? 0.15 : 1;
        }
        else if (groupCSet.has(node.id)) opacity = cAlpha;
        else opacity = 0.02;
      } else if (contextNodeIds) {
        // Overview mode with context filter active
        opacity = contextNodeIds.has(node.id) ? restAlpha : 0.06;
      } else {
        opacity = restAlpha;
      }

      sprite.material.opacity = opacity;
    }
  }, [graphData, isDimming, hoveredNode, focusedNode, highlightNodes, groupBSet, groupCSet, cAlpha, contextNodeIds]);

  // ─── Sync word sprite colors (shuffle on each seed bump) ───
  useEffect(() => {
    if (!graphData) return;
    const palette = currentTheme === 'dark' ? WORD_PALETTE_DARK : WORD_PALETTE_LIGHT;
    const defaultColor = currentTheme === 'dark' ? '#6cc8c8' : '#2a9d8f';

    // Simple seeded shuffle: create a permuted palette for this seed
    let shuffled = palette;
    if (colorSeed > 0) {
      shuffled = [...palette];
      let s = colorSeed;
      for (let i = shuffled.length - 1; i > 0; i--) {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        const j = s % (i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
    }

    for (const node of graphData.nodes) {
      if (node.type !== 'word' || !node.__wordSprite) continue;
      const color = colorSeed > 0
        ? shuffled[node.colorIdx % shuffled.length]
        : defaultColor;

      // SpriteText.color setter re-renders canvas and resets scale.
      // Preserve current scale across the color change.
      const sx = node.__wordSprite.scale.x;
      const sy = node.__wordSprite.scale.y;
      node.__wordSprite.color = color;
      node.__wordSprite.scale.set(sx, sy, 1);

      // Also update the original scale refs if they exist
      if (node.__wordOrigScaleX) {
        // Recalc: origScale was set before color change, but SpriteText
        // may now have a different internal size. Keep the factor.
        const factor = sy / (node.__wordOrigScaleY || sy);
        node.__wordOrigScaleX = node.__wordSprite.scale.x / factor || sx;
        node.__wordOrigScaleY = node.__wordSprite.scale.y / factor || sy;
      }

      node.__wordColor = color;
    }
  }, [graphData, colorSeed, currentTheme]);

  const handleNodeLabel = useCallback(
    (node) => {
      if (node.__threeObj?.__labelAdded) return null;
      return node.type === 'visual' ? `Sketch #${node.sketchIndex}` : node.label;
    },
    []
  );

  const handleNodeHover = useCallback((node) => {
    const { mode: m, hoverNode, clearHover } = useStore.getState();
    if (m === 'focused') return;
    if (node) {
      hoverNode(node);
    } else {
      clearHover();
    }
  }, []);

  // ─── Click handler: focus (overview) or walk (focused) ───
  const handleNodeClick = useCallback((node) => {
    if (!graphRef.current) return;
    const state = useStore.getState();

    if (state.mode === 'overview') {
      // ── Steps 1–7: Enter focused mode ──

      // Step 1: Save & freeze all positions
      saveAllPositions(state.graphData);

      // Step 2: Identify groups
      const { groupBSet: bSet, groupCSet: cSet } = computeGroups(node);

      // Atomic state update — focusedNode + groups set together, no empty-groups flash
      useStore.setState({
        mode: 'focused',
        focusedNode: node,
        previousNode: null,
        hoveredNode: null,
        highlightNodes: new Set(),
        highlightLinks: new Set(),
        groupBSet: bSet,
        groupCSet: cSet,
      });

      // Keep simulation ticking so the library syncs link/particle positions
      graphRef.current.d3ReheatSimulation();

      // Steps 4+5: Arrange B (800ms) then C (200ms delay, 1000ms)
      arrangeAll(800, 200, 1000);

      // Step 7: Camera flies after B animation (800ms delay inside flyToFocusedNode)
      flyToFocusedNode(graphRef, node);

      // Labels after a short delay for objects to settle
      setTimeout(() => enhanceFocusedNeighborhood(node), 100);

    } else if (state.mode === 'focused') {
      // ── Steps 8/9: Walk — B or C click ──
      const { groupBSet: bSet, groupCSet: cSet } = state;
      if (!bSet.has(node.id) && !cSet.has(node.id)) return;
      if (node === state.focusedNode) return;

      const oldFocused = state.focusedNode;

      // Pin clicked node at current position so dissolve doesn't move it
      node.fx = node.x;
      node.fy = node.y;
      node.fz = node.z;

      // Snap-remove old labels
      clearFocusLabels(oldFocused, true);

      // Camera dolly to new node's saved position (offset-preserving)
      walkCamera(graphRef, oldFocused, node);

      // Update store (sets previousNode, clears groups)
      state.walkToNode(node);

      // Keep simulation ticking for position sync
      graphRef.current.d3ReheatSimulation();

      // Dissolve old layout (400ms)
      dissolveAll(400, () => {
        // At 400ms: recompute groups, arrange new layout
        const { groupBSet: newB, groupCSet: newC } = computeGroups(node);
        useStore.getState().setGroups(newB, newC);

        // Re-reheat so new arrangement animations also sync
        graphRef.current.d3ReheatSimulation();

        // Arrange with walk timings: B 800ms, C delay 200ms + 1000ms
        arrangeAll(800, 200, 1000);

        // Labels after short delay
        setTimeout(() => enhanceFocusedNeighborhood(node), 100);
      });
    }
  }, []);

  // Register walk handler for InfoPanel clicks
  useEffect(() => {
    useStore.getState().registerWalkHandler((node) => {
      handleNodeClick(node);
    });
  }, [handleNodeClick]);

  // ─── Exit focus: background click (Step 10) ───
  const handleBackgroundClick = useCallback(() => {
    const state = useStore.getState();
    if (state.mode !== 'focused') return;

    const focused = state.focusedNode;
    const gd = state.graphData;

    // Cancel any in-flight layout animations
    try { cancelAllAnimations(); } catch (_) {}

    // Remove labels
    try { if (focused) clearFocusLabels(focused, true); } catch (_) {}

    // Camera back to overview
    try { flyToOverview(graphRef, gd ? gd.nodes.length : 100); } catch (_) {}

    // Unpin ALL nodes so simulation can take over
    if (gd) {
      for (const n of gd.nodes) {
        n.fx = undefined;
        n.fy = undefined;
        n.fz = undefined;
      }
    }

    // ALWAYS force state back to overview
    useStore.getState().exitFocus();

    // Reheat simulation so nodes settle
    try {
      if (graphRef.current) graphRef.current.d3ReheatSimulation();
    } catch (_) {}
  }, []);

  // Register exit handler for close button
  useEffect(() => {
    useStore.getState().registerExitHandler(() => {
      handleBackgroundClick();
    });
  }, [handleBackgroundClick]);

  // ─── Step 6: Visibility & styling ───

  const getNodeColor = useCallback((node) => {
    const rgb = node.type === 'visual' ? theme.sketchRgb : theme.wordRgb;
    const restAlpha = node.type === 'visual' ? 1.0
      : node.isShared ? 0.9 : 0.4;

    if (!isDimming) return `rgba(${rgb},${restAlpha})`;

    // Overview hover
    if (hoveredNode && !focusedNode) {
      if (highlightNodes.has(node)) return `rgba(${rgb},1.0)`;
      return `rgba(${rgb},0.06)`;
    }

    // Focused mode
    if (focusedNode) {
      if (node === focusedNode) return `rgba(${rgb},1.0)`;        // Group A
      if (groupBSet.has(node.id)) return `rgba(${rgb},1.0)`;      // Group B
      if (groupCSet.has(node.id)) return `rgba(${rgb},${cAlpha})`; // Group C
      return `rgba(${rgb},0.02)`;                                  // Others
    }

    // Overview mode with context filter
    if (contextNodeIds) {
      return contextNodeIds.has(node.id) ? `rgba(${rgb},${restAlpha})` : `rgba(${rgb},0.06)`;
    }

    return `rgba(${rgb},${restAlpha})`;
  }, [isDimming, hoveredNode, focusedNode, highlightNodes, groupBSet, groupCSet, cAlpha, theme, contextNodeIds]);

  const getNodeVal = useCallback((node) => {
    if (focusedNode && groupCSet.has(node.id)) return 0.3; // Group C smaller
    if (node.type === 'visual') return 8;
    return node.isShared ? 1.5 : 0.6;
  }, [focusedNode, groupCSet]);

  const getLinkColor = useCallback((link) => {
    const eRgb = theme.edgeRgb;

    // Overview hover
    if (hoveredNode && !focusedNode) {
      if (highlightLinks.has(link)) return `rgba(${eRgb},0.4)`;
      if (isDimming) return `rgba(${eRgb},0.02)`;
      return `rgba(${eRgb},0.08)`;
    }

    // Focused mode
    if (focusedNode) {
      const sId = typeof link.source === 'object' ? link.source.id : link.source;
      const tId = typeof link.target === 'object' ? link.target.id : link.target;

      // F↔B edge
      const isFocusEdge =
        (sId === focusedNode.id && groupBSet.has(tId)) ||
        (tId === focusedNode.id && groupBSet.has(sId));
      if (isFocusEdge) {
        // Dim if context filter is active and this edge doesn't match
        if (activeContext && link.context !== activeContext) return `rgba(${eRgb},0.08)`;
        return `rgba(${eRgb},0.4)`;
      }

      // B↔C edge
      const isBCEdge =
        (groupBSet.has(sId) && groupCSet.has(tId)) ||
        (groupCSet.has(sId) && groupBSet.has(tId));
      if (isBCEdge) return `rgba(${eRgb},0.06)`;

      // Everything else hidden
      return `rgba(${eRgb},0)`;
    }

    // Overview mode with context filter
    if (activeContext) {
      return link.context === activeContext ? `rgba(${eRgb},0.2)` : `rgba(${eRgb},0.02)`;
    }

    return `rgba(${eRgb},0.08)`;
  }, [isDimming, hoveredNode, focusedNode, highlightLinks, groupBSet, groupCSet, theme, activeContext]);

  const getLinkWidth = useCallback((link) => {
    // Overview hover
    if (hoveredNode && !focusedNode) {
      return highlightLinks.has(link) ? 0.3 : 0.04;
    }

    // Focused mode
    if (focusedNode) {
      const sId = typeof link.source === 'object' ? link.source.id : link.source;
      const tId = typeof link.target === 'object' ? link.target.id : link.target;

      const isFocusEdge =
        (sId === focusedNode.id && groupBSet.has(tId)) ||
        (tId === focusedNode.id && groupBSet.has(sId));
      if (isFocusEdge) return 0.1 + (link.imageRate / 10) * 0.4;

      const isBCEdge =
        (groupBSet.has(sId) && groupCSet.has(tId)) ||
        (groupCSet.has(sId) && groupBSet.has(tId));
      if (isBCEdge) return 0.04;

      return 0;
    }

    // Overview mode with context filter: matching edges slightly thicker
    if (activeContext) {
      return link.context === activeContext ? 0.12 : 0.02;
    }

    return 0.04;
  }, [hoveredNode, focusedNode, highlightLinks, groupBSet, groupCSet, activeContext]);

  const getLinkParticles = useCallback((link) => {
    // Dramatic but lighter: imageRate 1→0, 5→1, 7→3, 9→5, 10→6
    const t = (link.imageRate - 1) / 9; // 0..1
    const particles = Math.round(t * t * 6);

    // Overview hover
    if (hoveredNode && !focusedNode) {
      return highlightLinks.has(link) ? particles : 0;
    }

    // Focused mode: particles only on F↔B edges
    if (focusedNode) {
      const sId = typeof link.source === 'object' ? link.source.id : link.source;
      const tId = typeof link.target === 'object' ? link.target.id : link.target;

      const isFocusEdge =
        (sId === focusedNode.id && groupBSet.has(tId)) ||
        (tId === focusedNode.id && groupBSet.has(sId));
      if (isFocusEdge) {
        if (activeContext && link.context !== activeContext) return 0;
        return particles;
      }
    }

    // Overview mode with context filter: show particles on matching edges
    if (!focusedNode && activeContext) {
      return link.context === activeContext ? Math.max(1, particles) : 0;
    }

    return 0;
  }, [hoveredNode, focusedNode, highlightLinks, groupBSet, activeContext]);

  return (
    <ForceGraph3D
      ref={graphRef}
      graphData={graphData || EMPTY_GRAPH}
      backgroundColor={theme.bg}
      nodeThreeObject={handleNodeThreeObject}
      nodeLabel={handleNodeLabel}
      onNodeHover={handleNodeHover}
      onNodeClick={handleNodeClick}
      onBackgroundClick={handleBackgroundClick}
      nodeColor={getNodeColor}
      nodeVal={getNodeVal}
      nodeOpacity={1}
      enableNodeDrag={false}
      linkColor={getLinkColor}
      linkWidth={getLinkWidth}
      linkDirectionalParticles={getLinkParticles}
      linkDirectionalParticleWidth={0.8}
      linkDirectionalParticleSpeed={0.005}
      warmupTicks={50}
      cooldownTicks={200}
    />
  );
}
