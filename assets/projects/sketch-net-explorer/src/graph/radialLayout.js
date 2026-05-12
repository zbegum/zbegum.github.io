/**
 * Focused-mode layout system.
 *
 * Step 1: Save ALL node positions, pin everything.
 * Step 2: Identify groups A (focused), B (neighbors), C (externals, cap 5).
 * Step 4: Arrange B in golden-spiral sphere (r=25) around A.
 * Step 5: Arrange C in 25° cones behind their B parents (dist 12–18).
 * Step 8/9: Walk — dissolve → recompute → rearrange.
 * Step 10: Exit — restore all saved positions, unpin, resume sim.
 */

// ─── state ───

let _allNodes = [];
let _focusedNode = null;
let _groupB = [];
let _groupC = [];
let _groupBSet = new Set();
let _groupCSet = new Set();
let _beyondCap = new Map();     // B node id → hidden count
let _bTargets = [];

const activeAnims = new Set();
const timers = [];

// ─── constants ───

const B_RADIUS_MIN = 35;
const B_RADIUS_MAX = 70;
const C_MIN_DIST = 25;
const C_MAX_DIST = 40;
const C_CAP = 3;
const CONE_HALF = 12.5 * Math.PI / 180; // 25° total

// ─── helpers ───

function goldenSphere(n) {
  const pts = [];
  if (n === 0) return pts;
  const gr = (1 + Math.sqrt(5)) / 2;
  for (let i = 0; i < n; i++) {
    const theta = Math.acos(1 - 2 * (i + 0.5) / n);
    const phi = 2 * Math.PI * i / gr;
    pts.push({
      x: Math.sin(theta) * Math.cos(phi),
      y: Math.sin(theta) * Math.sin(phi),
      z: Math.cos(theta),
    });
  }
  return pts;
}

function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

function animate(nodes, targets, duration, onComplete) {
  if (nodes.length === 0) { if (onComplete) onComplete(); return; }
  const starts = nodes.map(n => ({ x: n.x, y: n.y, z: n.z }));
  const t0 = performance.now();
  let fid;

  function step(now) {
    activeAnims.delete(fid);
    const p = Math.min(1, (now - t0) / duration);
    const e = easeOut(p);
    for (let i = 0; i < nodes.length; i++) {
      const nx = starts[i].x + (targets[i].x - starts[i].x) * e;
      const ny = starts[i].y + (targets[i].y - starts[i].y) * e;
      const nz = starts[i].z + (targets[i].z - starts[i].z) * e;
      nodes[i].x = nx; nodes[i].y = ny; nodes[i].z = nz;
      nodes[i].fx = nx; nodes[i].fy = ny; nodes[i].fz = nz;
    }
    if (p < 1) {
      fid = requestAnimationFrame(step);
      activeAnims.add(fid);
    } else if (onComplete) {
      onComplete();
    }
  }

  fid = requestAnimationFrame(step);
  activeAnims.add(fid);
}

function linkRate(nodeA, nodeB) {
  const link = nodeA.links.find(lk => {
    const s = typeof lk.source === 'object' ? lk.source.id : lk.source;
    const t = typeof lk.target === 'object' ? lk.target.id : lk.target;
    return (s === nodeA.id && t === nodeB.id) || (t === nodeA.id && s === nodeB.id);
  });
  return link ? link.imageRate : 6;
}

// ─── Step 1: save & freeze ───

export function saveAllPositions(graphData) {
  _allNodes = graphData.nodes;
  for (const n of _allNodes) {
    n._savedX = n.x;
    n._savedY = n.y;
    n._savedZ = n.z;
    n.fx = n.x;
    n.fy = n.y;
    n.fz = n.z;
  }
}

// ─── Step 2: identify groups ───

export function computeGroups(focusedNode) {
  _focusedNode = focusedNode;
  _groupB = [...focusedNode.neighbors];

  const bIds = new Set(_groupB.map(n => n.id));
  bIds.add(focusedNode.id);

  _groupC = [];
  _groupCSet = new Set();
  _beyondCap = new Map();
  const claimed = new Set();

  for (const b of _groupB) {
    const exts = [];
    for (const ext of b.neighbors) {
      if (bIds.has(ext.id) || claimed.has(ext.id)) continue;
      exts.push({ node: ext, rate: linkRate(b, ext) });
    }
    exts.sort((a, b2) => b2.rate - a.rate);
    const capped = exts.slice(0, C_CAP);
    const beyond = exts.length - capped.length;
    if (beyond > 0) _beyondCap.set(b.id, beyond);

    for (const { node } of capped) {
      claimed.add(node.id);
      _groupCSet.add(node.id);
      _groupC.push(node);
    }
  }

  _groupBSet = new Set(_groupB.map(n => n.id));
  return { groupBSet: _groupBSet, groupCSet: _groupCSet };
}

// ─── Step 4 + 5: position groups ───

function computeBTargets() {
  const pts = goldenSphere(_groupB.length);
  const cx = _focusedNode.x, cy = _focusedNode.y, cz = _focusedNode.z;
  _bTargets = pts.map((p, i) => {
    const rate = linkRate(_focusedNode, _groupB[i]);
    // Higher imageRate → closer to center (shorter radius)
    const t = (rate - 1) / 9; // 0..1
    const radius = B_RADIUS_MAX - t * (B_RADIUS_MAX - B_RADIUS_MIN);
    return {
      x: cx + p.x * radius,
      y: cy + p.y * radius,
      z: cz + p.z * radius,
    };
  });
  return _bTargets;
}

function computeCTargets(bTargets) {
  const targets = [];
  const cx = _focusedNode.x, cy = _focusedNode.y, cz = _focusedNode.z;
  const ga = 2 * Math.PI / ((1 + Math.sqrt(5)) / 2);

  // Build map: B id → index in _groupB / bTargets
  const bIdx = new Map();
  for (let i = 0; i < _groupB.length; i++) bIdx.set(_groupB[i].id, i);

  // Build map: B id → [C nodes]
  const childrenOf = new Map();
  const claimed = new Set();
  const bIds = new Set(_groupB.map(n => n.id));
  bIds.add(_focusedNode.id);

  for (const b of _groupB) {
    const exts = [];
    for (const ext of b.neighbors) {
      if (bIds.has(ext.id) || claimed.has(ext.id)) continue;
      exts.push({ node: ext, rate: linkRate(b, ext) });
    }
    exts.sort((a, b2) => b2.rate - a.rate);
    const kids = exts.slice(0, C_CAP).map(e => e.node);
    for (const k of kids) claimed.add(k.id);
    if (kids.length > 0) childrenOf.set(b.id, kids);
  }

  for (const b of _groupB) {
    const kids = childrenOf.get(b.id);
    if (!kids || kids.length === 0) continue;

    const i = bIdx.get(b.id);
    const bt = bTargets[i];

    // outward direction: F → B target
    const ox = bt.x - cx, oy = bt.y - cy, oz = bt.z - cz;
    const oLen = Math.sqrt(ox * ox + oy * oy + oz * oz);
    if (oLen < 0.01) continue;
    const dx = ox / oLen, dy = oy / oLen, dz = oz / oLen;

    // perpendicular frame
    let ux = 0, uy = 1, uz = 0;
    if (Math.abs(dy) > 0.9) { ux = 1; uy = 0; }
    let axX = uy * dz - uz * dy, axY = uz * dx - ux * dz, axZ = ux * dy - uy * dx;
    const aL = Math.sqrt(axX * axX + axY * axY + axZ * axZ);
    axX /= aL; axY /= aL; axZ /= aL;
    const ayX = dy * axZ - dz * axY, ayY = dz * axX - dx * axZ, ayZ = dx * axY - dy * axX;

    for (let j = 0; j < kids.length; j++) {
      const dist = kids.length === 1
        ? (C_MIN_DIST + C_MAX_DIST) / 2
        : C_MIN_DIST + (C_MAX_DIST - C_MIN_DIST) * (j / (kids.length - 1));

      let theta = 0, phi = 0;
      if (kids.length > 1) {
        theta = CONE_HALF * ((j + 1) / kids.length);
        phi = ga * j;
      }

      const cZ = dist * Math.cos(theta);
      const cR = dist * Math.sin(theta);
      const cX = cR * Math.cos(phi);
      const cY = cR * Math.sin(phi);

      targets.push({
        x: bt.x + dx * cZ + axX * cX + ayX * cY,
        y: bt.y + dy * cZ + axY * cX + ayY * cY,
        z: bt.z + dz * cZ + axZ * cX + ayZ * cY,
      });
    }
  }

  return targets;
}

export function arrangeAll(bDur = 800, cDelay = 200, cDur = 1000) {
  if (!_focusedNode || _groupB.length === 0) return;

  // pin focused node
  _focusedNode.fx = _focusedNode.x;
  _focusedNode.fy = _focusedNode.y;
  _focusedNode.fz = _focusedNode.z;

  const bTgts = computeBTargets();
  const cTgts = computeCTargets(bTgts);

  animate(_groupB, bTgts, bDur);

  if (_groupC.length > 0 && cTgts.length > 0) {
    const tid = setTimeout(() => { animate(_groupC, cTgts, cDur); }, cDelay);
    timers.push(tid);
  }
}

// ─── dissolve (walk) ───

export function dissolveAll(duration = 400, onComplete) {
  cancelAllAnimations();

  const nodes = [..._groupB, ..._groupC];
  const targets = nodes.map(n => ({ x: n._savedX, y: n._savedY, z: n._savedZ }));

  animate(nodes, targets, duration, onComplete);
}

// ─── restore (exit) ───

export function restoreAll(duration = 600, onComplete) {
  cancelAllAnimations();

  const nodes = [..._groupB, ..._groupC];
  const targets = nodes.map(n => ({ x: n._savedX, y: n._savedY, z: n._savedZ }));

  function finish() {
    // unpin every node
    for (const n of _allNodes) {
      n.fx = undefined;
      n.fy = undefined;
      n.fz = undefined;
    }
    _focusedNode = null;
    _groupB = [];
    _groupC = [];
    _groupBSet = new Set();
    _groupCSet = new Set();
    _beyondCap = new Map();
    _bTargets = [];
    _allNodes = [];
    if (onComplete) onComplete();
  }

  if (nodes.length === 0) { finish(); return; }
  animate(nodes, targets, duration, finish);
}

// ─── cancel ───

export function cancelAllAnimations() {
  for (const id of activeAnims) cancelAnimationFrame(id);
  activeAnims.clear();
  for (const tid of timers) clearTimeout(tid);
  timers.length = 0;
}

// ─── accessors ───

export function getGroups() {
  return {
    focusedNode: _focusedNode,
    groupB: _groupB,
    groupC: _groupC,
    groupBSet: _groupBSet,
    groupCSet: _groupCSet,
    beyondCap: _beyondCap,
  };
}

export function getDynamicDistance() {
  const fovRad = 75 * Math.PI / 180;
  return Math.max(60, B_RADIUS_MAX / Math.tan(fovRad / 2) * 1.8);
}
