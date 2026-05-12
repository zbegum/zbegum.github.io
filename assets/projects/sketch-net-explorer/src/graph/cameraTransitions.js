/**
 * Camera transitions for focused mode.
 *
 * flyToFocusedNode: Step 7 — after B animation, fly to dynamic-distance view.
 * walkCamera:       Step 8 — offset-preserving dolly to new focus (uses _saved pos).
 * flyToOverview:    Step 10 — return to origin.
 */

import { getDynamicDistance } from './radialLayout';

function setOrbitTarget(graphRef, x, y, z, delay) {
  setTimeout(() => {
    const c = graphRef.current?.controls();
    if (c?.target) c.target.set(x, y, z);
  }, delay);
}

/**
 * Step 7: Camera flies to focused node after B layout completes.
 * Position: { F.x, F.y + 8, F.z + dynamicDist }
 * Starts after 800ms delay (B animation duration).
 */
export function flyToFocusedNode(graphRef, node) {
  const d = getDynamicDistance();
  setTimeout(() => {
    graphRef.current.cameraPosition(
      { x: node.x, y: node.y + 8, z: node.z + d },
      { x: node.x, y: node.y, z: node.z },
      1500
    );
    setOrbitTarget(graphRef, node.x, node.y, node.z, 1500);
  }, 800);
}

/**
 * Step 8.6: Walk camera — preserve offset, target saved position.
 * offset = currentCam - oldFocused.pos
 * target = newNode._saved + offset, lookAt newNode._saved
 */
export function walkCamera(graphRef, oldFocused, newNode) {
  const cam = graphRef.current.camera().position;
  const offset = {
    x: cam.x - oldFocused.x,
    y: cam.y - oldFocused.y,
    z: cam.z - oldFocused.z,
  };

  const tx = newNode._savedX, ty = newNode._savedY, tz = newNode._savedZ;

  graphRef.current.cameraPosition(
    { x: tx + offset.x, y: ty + offset.y, z: tz + offset.z },
    { x: tx, y: ty, z: tz },
    1200
  );

  setOrbitTarget(graphRef, tx, ty, tz, 1200);
}

/**
 * Step 10.5: Return to overview.
 */
export function flyToOverview(graphRef, nodeCount) {
  const n = nodeCount || 100;
  const dist = Math.max(150, Math.sqrt(n) * 30);
  graphRef.current.cameraPosition(
    { x: 0, y: 0, z: dist },
    { x: 0, y: 0, z: 0 },
    2000
  );
  setOrbitTarget(graphRef, 0, 0, 0, 2000);
}
