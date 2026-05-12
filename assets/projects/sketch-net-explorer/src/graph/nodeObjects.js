import SpriteText from 'three-spritetext';
import useStore from '../state/store';
import { getGroups } from './radialLayout';

const activeFades = new Set();

// Match the library's sphere radius calculation: Math.cbrt(val) * nodeRelSize
const NODE_REL_SIZE = 4; // library default
function sphereRadius(node) {
  const val = node.type === 'visual' ? 8 : node.isShared ? 1.5 : 0.6;
  return Math.cbrt(val) * NODE_REL_SIZE;
}

const OVERVIEW_IMG_SIZE = 10;
const FOCUSED_IMG_SIZE = 22;
const NEIGHBOR_IMG_SIZE = 16;

function fadeSprite(sprite, from, to, duration, onComplete) {
  if (sprite.__fadeId) { cancelAnimationFrame(sprite.__fadeId); activeFades.delete(sprite.__fadeId); }
  const start = performance.now();
  function step(now) {
    activeFades.delete(sprite.__fadeId);
    const t = Math.min(1, (now - start) / duration);
    sprite.material.opacity = from + (to - from) * t;
    if (t < 1) {
      sprite.__fadeId = requestAnimationFrame(step);
      activeFades.add(sprite.__fadeId);
    } else {
      sprite.__fadeId = null;
      if (onComplete) onComplete();
    }
  }
  sprite.__fadeId = requestAnimationFrame(step);
  activeFades.add(sprite.__fadeId);
}

function cancelAllFades() {
  for (const id of activeFades) cancelAnimationFrame(id);
  activeFades.clear();
}

/**
 * Animate scale for square sprites (images). Sets x=y=size.
 */
function animateScale(sprite, fromSize, toSize, duration) {
  if (sprite.__scaleId) { cancelAnimationFrame(sprite.__scaleId); }
  const start = performance.now();
  function step(now) {
    const t = Math.min(1, (now - start) / duration);
    const ease = 1 - Math.pow(1 - t, 3);
    const s = fromSize + (toSize - fromSize) * ease;
    sprite.scale.set(s, s, 1);
    if (t < 1) {
      sprite.__scaleId = requestAnimationFrame(step);
    } else {
      sprite.__scaleId = null;
    }
  }
  sprite.__scaleId = requestAnimationFrame(step);
}

/**
 * Animate scale for text sprites. Multiplies original x/y by a factor,
 * preserving the aspect ratio.
 */
function animateScaleFactor(sprite, origX, origY, fromFactor, toFactor, duration) {
  if (sprite.__scaleId) { cancelAnimationFrame(sprite.__scaleId); }
  const start = performance.now();
  function step(now) {
    const t = Math.min(1, (now - start) / duration);
    const ease = 1 - Math.pow(1 - t, 3);
    const f = fromFactor + (toFactor - fromFactor) * ease;
    sprite.scale.set(origX * f, origY * f, 1);
    if (t < 1) {
      sprite.__scaleId = requestAnimationFrame(step);
    } else {
      sprite.__scaleId = null;
    }
  }
  sprite.__scaleId = requestAnimationFrame(step);
}

/**
 * Scale up sprites and add labels in focused mode.
 */
export function enhanceFocusedNeighborhood(focusedNode) {
  const { theme } = useStore.getState();
  const { beyondCap } = getGroups();

  // Scale up visual node sprites (square — absolute sizing is fine)
  if (focusedNode.type === 'visual' && focusedNode.__imgSprite) {
    animateScale(focusedNode.__imgSprite, OVERVIEW_IMG_SIZE, FOCUSED_IMG_SIZE, 500);
  } else if (focusedNode.type === 'word') {
    for (const neighbor of focusedNode.neighbors) {
      if (neighbor.type === 'visual' && neighbor.__imgSprite) {
        animateScale(neighbor.__imgSprite, OVERVIEW_IMG_SIZE, NEIGHBOR_IMG_SIZE, 500);
      }
    }
  }

  // Scale up word sprites proportionally (preserve aspect ratio)
  const nodesToEnhance = [focusedNode, ...focusedNode.neighbors];

  nodesToEnhance.forEach((node) => {
    if (node.type === 'visual') return;
    if (!node.__wordSprite) return;

    const isFocused = node === focusedNode;
    const targetFactor = isFocused ? 2.5 : 1.6;

    // Store original scale on first encounter
    if (!node.__wordOrigScaleX) {
      node.__wordOrigScaleX = node.__wordSprite.scale.x;
      node.__wordOrigScaleY = node.__wordSprite.scale.y;
    }

    const origX = node.__wordOrigScaleX;
    const origY = node.__wordOrigScaleY;
    const currentFactor = node.__wordSprite.scale.y / origY;

    animateScaleFactor(node.__wordSprite, origX, origY, currentFactor, targetFactor, 400);

    node.__wordSprite.material.opacity = 1;
    if (node.__threeObj) node.__threeObj.__labelAdded = true;
  });
}

/**
 * Reset scales and clean up on exit/walk.
 */
export function clearFocusLabels(previousFocused, instant = false) {
  if (!previousFocused) return;

  cancelAllFades();

  const nodesToClean = [previousFocused, ...previousFocused.neighbors];

  nodesToClean.forEach((node) => {
    const obj = node.__threeObj;
    if (obj) obj.__labelAdded = false;

    // Reset visual node sprite scale and rotation
    if (node.__imgSprite) {
      node.__imgSprite.material.rotation = 0;
      if (instant) {
        node.__imgSprite.scale.set(OVERVIEW_IMG_SIZE, OVERVIEW_IMG_SIZE, 1);
      } else {
        const currentSize = node.__imgSprite.scale.x;
        animateScale(node.__imgSprite, currentSize, OVERVIEW_IMG_SIZE, 400);
      }
    }

    // Reset word sprite scale (proportional)
    if (node.__wordSprite && node.__wordOrigScaleX) {
      const origX = node.__wordOrigScaleX;
      const origY = node.__wordOrigScaleY;
      const currentFactor = node.__wordSprite.scale.y / origY;

      if (instant) {
        node.__wordSprite.scale.set(origX, origY, 1);
      } else {
        animateScaleFactor(node.__wordSprite, origX, origY, currentFactor, 1, 400);
      }
    }
  });
}
