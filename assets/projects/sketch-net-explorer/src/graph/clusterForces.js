import * as d3 from 'd3-force-3d';

function clusterForce(strength) {
  let nodes;
  function force(alpha) {
    for (const node of nodes) {
      if (node.type === 'visual' && node.clusterCenter) {
        node.vx += (node.clusterCenter.x - node.x) * strength * alpha;
        node.vy += (node.clusterCenter.y - node.y) * strength * alpha;
        node.vz += (node.clusterCenter.z - node.z) * strength * alpha;
      }
    }
  }
  force.initialize = (_nodes) => { nodes = _nodes; };
  return force;
}

export function applyClusterForces(graphRef) {
  const fg = graphRef.current;
  if (!fg) return;

  const gd = typeof fg.graphData === 'function' ? fg.graphData() : null;
  const n = gd ? gd.nodes.length : 100;

  // Scale forces with graph density: sparse → tighter, dense → roomier
  const scale = Math.max(0.3, Math.min(1, n / 300));

  fg.d3Force('link')
    .distance(link => (15 + (10 - link.imageRate) * 8) * scale)
    .strength(link => 0.3 + (link.imageRate / 10) * 0.4);

  fg.d3Force('charge')
    .strength(node => node.type === 'visual' ? -120 * scale : -20 * scale);

  fg.d3Force('cluster', clusterForce(0.4));

  fg.d3Force('collision',
    d3.forceCollide()
      .radius(node => node.type === 'visual' ? 8 * scale : 2)
      .strength(0.4)
      .iterations(1)
  );

  fg.d3Force('center', d3.forceCenter(0, 0, 0).strength(0.05));
}
