function extractClass(sketchName) {
  return sketchName.split('_')[0];
}

function normalize(str) {
  return str.trim().toLowerCase().replace(/\s+/g, '_');
}

export class Visual {
  constructor(sketchName, imageUrl) {
    this.id = `v_${sketchName}`;
    this.sketchName = sketchName;
    this.imageUrl = imageUrl;
    this.originalClass = extractClass(sketchName);
    this.words = new Set();
    this.neighbors = [];
    this.links = [];
  }
}

export class Word {
  constructor(originalMeaning) {
    this.id = `w_${normalize(originalMeaning)}`;
    this.label = originalMeaning;
    this.variants = new Set();
    this.visuals = new Set();
    this.isShared = false;
    this.frequency = 0;
    this.neighbors = [];
    this.links = [];
  }
}

export { extractClass, normalize };
