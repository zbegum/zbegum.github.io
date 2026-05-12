import { normalize } from './structures.js';

/** Extract filename from Firebase URL → local /sketches/ path */
function localSketchUrl(firebaseUrl) {
  if (!firebaseUrl) return null;
  // URL pattern: ...SMWYS_FILES%2F{filename}.png?alt=media&token=...
  const match = firebaseUrl.match(/SMWYS_FILES%2F([^?]+)/);
  if (match) return `/sketches/${decodeURIComponent(match[1])}`;
  return firebaseUrl; // fallback to original
}

/**
 * Parse the real sketchnet.json into graphData for react-force-graph-3d.
 *
 * Data shape:
 *   { Sketchnet_data: { [sketchKey]: { Original_meaning, Sketch_link, Meaning_list: { [word]: { Rating_between_image_and_meaning, Rating_between_meaning_and_context, ... } } } } }
 *
 * Produces:
 *   - Visual nodes: one per sketch (120 total)
 *   - Word nodes: one per unique meaning (normalized, shared across sketches)
 *   - Edges: sketch ↔ meaning, imageRate = avg of Rating_between_image_and_meaning
 *   - Filtered: only edges with imageRate >= minImageRate (default 6)
 *   - Orphan nodes (no edges after filter) are excluded
 */
export function parseSketchnetData(rawJson, minImageRate = 6) {
  const data = rawJson.Sketchnet_data;
  const wordRegistry = new Map(); // normalized key → { label, variants, visualIds, frequency }
  const allEdges = [];
  const contextStats = new Map();
  const visualNodes = [];

  let sketchIdx = 1;

  for (const [sketchKey, sketch] of Object.entries(data)) {
    const visualId = `v_${sketchKey}`;

    visualNodes.push({
      id: visualId,
      type: 'visual',
      label: sketchKey,
      imageUrl: localSketchUrl(sketch.Sketch_link),
      originalClass: sketch.Original_meaning,
      sketchIndex: sketchIdx++,
      wordCount: 0,
      neighbors: [],
      links: [],
    });

    const meanings = sketch.Meaning_list || {};
    for (const [meaningName, mData] of Object.entries(meanings)) {
      const wordKey = `w_${normalize(meaningName)}`;

      if (!wordRegistry.has(wordKey)) {
        wordRegistry.set(wordKey, {
          label: meaningName,
          variants: new Set(),
          visualIds: new Set(),
          frequency: 0,
        });
      }

      const reg = wordRegistry.get(wordKey);
      reg.variants.add(meaningName);
      reg.visualIds.add(visualId);
      reg.frequency++;

      // imageRate = average of Rating_between_image_and_meaning
      const ratings = mData.Rating_between_image_and_meaning || [];
      const imageRate = ratings.length > 0
        ? ratings.reduce((s, r) => s + r, 0) / ratings.length
        : 0;

      // Best context (highest avg Rating_between_meaning_and_context)
      const ctxMap = mData.Rating_between_meaning_and_context || {};
      let bestCtx = null;
      let bestCtxRate = 0;

      for (const [ctxName, ctxRates] of Object.entries(ctxMap)) {
        const avg = ctxRates.reduce((s, r) => s + r, 0) / ctxRates.length;
        if (avg > bestCtxRate) { bestCtxRate = avg; bestCtx = ctxName; }

        // Collect context stats
        if (!contextStats.has(ctxName)) {
          contextStats.set(ctxName, { name: ctxName, edgeCount: 0, uniqueWords: new Set() });
        }
        contextStats.get(ctxName).edgeCount++;
        contextStats.get(ctxName).uniqueWords.add(wordKey);
      }

      allEdges.push({
        source: visualId,
        target: wordKey,
        imageRate: Math.round(imageRate * 10) / 10,
        contextRate: Math.round(bestCtxRate * 10) / 10,
        context: bestCtx,
      });
    }
  }

  // Deduplicate: same visual + word → keep highest imageRate
  const edgeMap = new Map();
  for (const e of allEdges) {
    const key = `${e.source}|${e.target}`;
    if (!edgeMap.has(key) || edgeMap.get(key).imageRate < e.imageRate) {
      edgeMap.set(key, e);
    }
  }

  // Filter: only edges with imageRate >= minImageRate
  const filteredEdges = [...edgeMap.values()].filter(e => e.imageRate >= minImageRate);

  // Build word nodes from registry
  const wordNodes = [];
  let colorIdx = 0;
  for (const [wordKey, reg] of wordRegistry) {
    const isShared = reg.visualIds.size > 1;
    wordNodes.push({
      id: wordKey,
      type: 'word',
      label: reg.label,
      variants: [...reg.variants],
      isShared,
      frequency: reg.frequency,
      colorIdx: colorIdx++,
      neighbors: [],
      links: [],
    });
  }

  const nodes = [...visualNodes, ...wordNodes];

  // Cross-link neighbors via filtered edges
  const nodeMap = {};
  for (const n of nodes) nodeMap[n.id] = n;

  for (const link of filteredEdges) {
    const a = nodeMap[link.source];
    const b = nodeMap[link.target];
    if (a && b) {
      a.neighbors.push(b);
      b.neighbors.push(a);
      a.links.push(link);
      b.links.push(link);
    }
  }

  // Update wordCount on visuals (post-filter)
  for (const n of visualNodes) {
    n.wordCount = n.neighbors.length;
  }

  // Remove orphan nodes (no connections after filtering)
  const connectedNodes = nodes.filter(n => n.neighbors.length > 0);

  return {
    graphData: { nodes: connectedNodes, links: filteredEdges },
    contexts: contextStats,
  };
}
