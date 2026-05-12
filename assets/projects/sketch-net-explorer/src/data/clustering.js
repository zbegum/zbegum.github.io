/**
 * Visual affinity clustering.
 *
 * 1. Compute Jaccard similarity between all visual pairs on shared words.
 * 2. Build connected components at affinity > 0.15 (super-clusters).
 * 3. Distribute cluster centers on a sphere via golden spiral.
 * 4. Stamp each visual node with its clusterCenter.
 */

function distributeOnSphere(n, radius) {
  const points = [];
  const goldenRatio = (1 + Math.sqrt(5)) / 2;
  for (let i = 0; i < n; i++) {
    const theta = Math.acos(1 - 2 * (i + 0.5) / n);
    const phi = 2 * Math.PI * i / goldenRatio;
    points.push({
      x: radius * Math.sin(theta) * Math.cos(phi),
      y: radius * Math.sin(theta) * Math.sin(phi),
      z: radius * Math.cos(theta),
    });
  }
  return points;
}

function jaccard(setA, setB) {
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Find connected components using union-find.
 */
function connectedComponents(nodeCount, edges) {
  const parent = Array.from({ length: nodeCount }, (_, i) => i);
  const rank = new Array(nodeCount).fill(0);

  function find(x) {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  }

  function unite(a, b) {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return;
    if (rank[ra] < rank[rb]) { parent[ra] = rb; }
    else if (rank[ra] > rank[rb]) { parent[rb] = ra; }
    else { parent[rb] = ra; rank[ra]++; }
  }

  for (const [a, b] of edges) unite(a, b);

  const groups = new Map();
  for (let i = 0; i < nodeCount; i++) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(i);
  }
  return [...groups.values()];
}

/**
 * Assign cluster centers to all visual nodes in graphData.
 * Mutates nodes in place by adding `clusterId` and `clusterCenter`.
 *
 * @param {Object} graphData - { nodes, links }
 * @param {number} sphereRadius - radius for cluster center distribution
 */
export function assignClusters(graphData) {
  // Scale sphere radius with node count so sparse graphs stay compact
  const totalNodes = graphData.nodes.length;
  const sphereRadius = Math.max(60, Math.sqrt(totalNodes) * 20);

  // Collect visual nodes and build word-set map
  const visualNodes = graphData.nodes.filter(n => n.type === 'visual');
  const visualWordSets = new Map();

  for (const v of visualNodes) {
    // Gather word IDs from this visual's neighbors
    const wordIds = new Set();
    for (const neighbor of v.neighbors) {
      if (neighbor.type === 'word') wordIds.add(neighbor.id);
    }
    visualWordSets.set(v.id, wordIds);
  }

  // Build affinity edges at threshold > 0.15
  const affinityEdges = [];
  for (let i = 0; i < visualNodes.length; i++) {
    for (let j = i + 1; j < visualNodes.length; j++) {
      const setA = visualWordSets.get(visualNodes[i].id);
      const setB = visualWordSets.get(visualNodes[j].id);
      if (jaccard(setA, setB) > 0.15) {
        affinityEdges.push([i, j]);
      }
    }
  }

  // Find connected components (super-clusters)
  const components = connectedComponents(visualNodes.length, affinityEdges);

  // Distribute cluster centers on sphere
  const centers = distributeOnSphere(components.length, sphereRadius);

  // Stamp each visual node
  for (let ci = 0; ci < components.length; ci++) {
    const center = centers[ci];
    for (const vi of components[ci]) {
      visualNodes[vi].clusterId = ci;
      visualNodes[vi].clusterCenter = center;
    }
  }
}
