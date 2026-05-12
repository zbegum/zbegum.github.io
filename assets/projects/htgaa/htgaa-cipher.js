// ═══════════════════════════════════════════════════════════════
// PROTEIN REGISTRY
// ═══════════════════════════════════════════════════════════════

const PROTEINS = {
  // Default — bright red, fast-maturing FP. Sequence verified against FPbase
  // (Gadella 2023). Derived from mScarlet-2A-84W with mutations
  // V2_G5delinsDST / K48R / T109A / K183R / Y194F / M227_K232delinsSGGS — note
  // the native MDELYK cap was intentionally replaced with SGGS, so the trailing
  // GGSGGS is part of the protein, not a linker.
  mScarlet3: {
    name: 'mScarlet3',
    fullName: 'mScarlet3',
    color: '#e0455c',
    aa: 'MDSTEAVIKEFMRFKVHMEGSMNGHEFEIEGEGEGRPYEGTQTAKLRVTKGGPLPFSWDILSPQFMYGSRAFTKHPADIPDYWKQSFPEGFKWERVMNFEDGGAVSVAQDTSLEDGTLIYKVKLRGTNFPPDGPVMQKKTMGWEASTERLYPEDVVLKGDIKMALRLKDGGRYLADFKTTYRAKKPVQMPGAFNIDRKLDITSHNEDYTVVEQYERSVARHSTGGSGGS',
    excitation: 569,
    emission: 600,
    organism: 'Synthetic — engineered from DsRed/mRFP scaffold',
    paper: 'Gadella et al., Nat Methods 20:541–545 (2023)',
    glow: 'red',
    sourceNote: 'Sequence verified against FPbase (Gadella 2023). Derived from mScarlet-2A-84W; key mutations: V2_G5delinsDST · K48R · T109A · K183R · Y194F · M227_K232delinsSGGS.',
    refs: [
      { label: 'FPbase mScarlet3', url: 'https://www.fpbase.org/protein/mscarlet3/' },
      { label: 'PDB 7ZCT', url: 'https://www.rcsb.org/structure/7ZCT' },
    ],
  },
  sfGFP: {
    name: 'sfGFP',
    fullName: 'Superfolder GFP',
    color: '#2d7a4f',
    aa: 'MSKGEELFTGVVPILVELDGDVNGHKFSVRGEGEGDATNGKLTLKFICTTGKLPVPWPTLVTTLTYGVQCFSRYPDHMKRHDFFKSAMPEGYVQERTISFKDDGTYKTRAEVKFEGDTLVNRIELKGIDFKEDGNILGHKLEYNFNSHNVYITADKQKNGIKANFKIRHNVEDGSVQLADHYQQNTPIGDGPVLLPDNHYLSTQSVLSKDPNEKRDHMVLLEFVTAAGITHGMDELYK',
    excitation: 485,
    emission: 510,
    organism: 'Aequorea victoria',
    paper: 'Pédelacq et al., Nat Biotechnol 24:79–88 (2006)',
    glow: 'green',
    sourceNote: 'Canonical sfGFP — Pédelacq et al. 2006. EGFP backbone with stabilizing mutations S30R · Y39N · N105T · Y145F · I171V · A206V.',
    refs: [
      { label: 'FPbase superfolder-gfp', url: 'https://www.fpbase.org/protein/superfolder-gfp/' },
      { label: 'UniProt P42212', url: 'https://www.uniprot.org/uniprotkb/P42212/entry' },
    ],
  },
};

let activeKey = (() => {
  try { const k = localStorage.getItem('htgaa_protein'); if (k && PROTEINS[k]) return k; } catch (e) {}
  return 'mScarlet3';
})();
let currentAA = PROTEINS[activeKey].aa;
let currentCapacity = 0; // computed after bitsFor/CODON_TABLE are defined, see below

// ═══════════════════════════════════════════════════════════════
// BIOLOGICAL CONSTANTS
// ═══════════════════════════════════════════════════════════════

const CODON_TABLE = {
  'F': ['TTC','TTT'],
  'L': ['CTG','TTA','TTG','CTT','CTC','CTA'],
  'I': ['ATT','ATC','ATA'],
  'M': ['ATG'],
  'V': ['GTG','GTT','GTC','GTA'],
  'S': ['AGC','TCT','AGT','TCC','TCA','TCG'],
  'P': ['CCG','CCA','CCT','CCC'],
  'T': ['ACC','ACG','ACT','ACA'],
  'A': ['GCG','GCC','GCA','GCT'],
  'Y': ['TAT','TAC'],
  '*': ['TAA','TGA','TAG'],
  'H': ['CAT','CAC'],
  'Q': ['CAG','CAA'],
  'N': ['AAC','AAT'],
  'K': ['AAA','AAG'],
  'D': ['GAT','GAC'],
  'E': ['GAA','GAG'],
  'C': ['TGC','TGT'],
  'W': ['TGG'],
  'R': ['CGC','CGT','CGG','CGA','AGA','AGG'],
  'G': ['GGC','GGT','GGG','GGA']
};

function bitsFor(aa) {
  const n = CODON_TABLE[aa].length;
  return n <= 1 ? 0 : Math.floor(Math.log2(n));
}

function computeCapacity(aa) {
  let cap = 0;
  for (const c of aa) cap += bitsFor(c);
  return cap;
}

currentCapacity = computeCapacity(currentAA);

function setActiveProtein(key) {
  if (!PROTEINS[key] || key === activeKey) return;
  activeKey = key;
  currentAA = PROTEINS[key].aa;
  currentCapacity = computeCapacity(currentAA);
  try { localStorage.setItem('htgaa_protein', key); } catch (e) {}
  // Hide any previous result — capacity changed, so the old encoded sequence
  // belongs to a different protein.
  lastEncodeResult = null;
  const res = document.getElementById('enc-result');
  if (res) res.style.display = 'none';
  refreshProteinUI();
  updateCapacityPreview();
}

// ═══════════════════════════════════════════════════════════════
// HUFFMAN
// ═══════════════════════════════════════════════════════════════

class HuffNode {
  constructor(ch, freq, left, right) {
    this.ch = ch; this.freq = freq; this.left = left || null; this.right = right || null;
  }
}

function buildHuffman(bytes) {
  const freq = {};
  for (const b of bytes) freq[b] = (freq[b]||0) + 1;
  const nodes = Object.entries(freq).map(([ch,f]) => new HuffNode(parseInt(ch), f));
  if (nodes.length === 1) nodes.push(new HuffNode(nodes[0].ch === 0 ? 1 : 0, 0));
  while (nodes.length > 1) {
    nodes.sort((a,b) => a.freq - b.freq || (a.ch??256) - (b.ch??256));
    const l = nodes.shift(), r = nodes.shift();
    nodes.push(new HuffNode(null, l.freq + r.freq, l, r));
  }
  const codes = {};
  (function walk(n, prefix) {
    if (n.ch !== null) { codes[n.ch] = prefix || '0'; return; }
    walk(n.left, prefix+'0'); walk(n.right, prefix+'1');
  })(nodes[0], '');
  return codes;
}

function huffEncode(bytes) {
  const codes = buildHuffman(bytes);
  const bits = bytes.map(b => codes[b]).join('');
  return { bits, codes };
}

function huffDecode(bits, codes) {
  const rev = {};
  for (const [byte, code] of Object.entries(codes)) rev[code] = parseInt(byte);
  const out = [];
  let buf = '';
  for (const b of bits) {
    buf += b;
    if (rev[buf] !== undefined) { out.push(rev[buf]); buf = ''; }
  }
  return new Uint8Array(out);
}

// ═══════════════════════════════════════════════════════════════
// ENCODE / DECODE
// ═══════════════════════════════════════════════════════════════

function rotateBits(bits, offset) {
  if (!bits.length || offset === 0) return bits;
  const o = ((offset % bits.length) + bits.length) % bits.length;
  return bits.slice(o) + bits.slice(0, o);
}

function unrotateBits(bits, offset) {
  return rotateBits(bits, bits.length - offset);
}

function bitsToSequence(bitStream, aaSeq = currentAA) {
  let pos = 0;
  const codons = [];
  for (const aa of aaSeq) {
    const opts = CODON_TABLE[aa];
    const b = bitsFor(aa);
    if (b === 0) { codons.push(opts[0]); continue; }
    let idx = 0;
    for (let i = 0; i < b; i++) {
      idx = (idx << 1) | (pos < bitStream.length ? parseInt(bitStream[pos++]) : 0);
    }
    codons.push(opts[idx % opts.length]);
  }
  return codons;
}

function sequenceToBits(codons, aaSeq = currentAA) {
  let bits = '';
  for (let i = 0; i < codons.length; i++) {
    const aa = aaSeq[i];
    const b = bitsFor(aa);
    if (b === 0) continue;
    const idx = CODON_TABLE[aa].indexOf(codons[i]);
    if (idx < 0) return null;
    bits += idx.toString(2).padStart(b, '0');
  }
  return bits;
}

function maxHomopolymer(seq) {
  let max = 1, cur = 1;
  for (let i = 1; i < seq.length; i++) {
    if (seq[i] === seq[i-1]) { cur++; if (cur > max) max = cur; }
    else cur = 1;
  }
  return max;
}

function gcContent(seq) {
  const gc = [...seq].filter(c => c==='G'||c==='C').length;
  return gc / seq.length;
}

function encode(message) {
  const aaSeq = currentAA;
  const cap = currentCapacity;
  const proteinKey = activeKey;
  const bytes = new TextEncoder().encode(message);
  const { bits: rawBits, codes } = huffEncode([...bytes]);

  if (rawBits.length > cap) {
    return { error: `Message needs ${rawBits.length} bits but ${PROTEINS[proteinKey].name} capacity is ${cap} bits. Shorten your message or pick a larger protein.` };
  }

  // Score offsets lexicographically: (internal restriction-site count, max
  // homopolymer). Zero cuts beats every cut-bearing offset regardless of hp,
  // because a single internal NdeI/XhoI site breaks cloning entirely.
  function countCuts(seq) {
    return (seq.match(/CATATG/g) || []).length + (seq.match(/CTCGAG/g) || []).length;
  }
  function randomPadding(n) {
    let s = '';
    for (let i = 0; i < n; i++) s += Math.random() < 0.5 ? '0' : '1';
    return s;
  }
  // Try deterministic all-zero padding first; if no rotation achieves zero
  // cuts, retry with random paddings. The decoder only reads the first
  // rawBits.length bits, so padding values don't affect round-trip.
  const padLen = cap - rawBits.length;
  const PAD_ATTEMPTS = 6;
  let best = null;
  for (let attempt = 0; attempt < PAD_ATTEMPTS; attempt++) {
    const padding = attempt === 0 ? '0'.repeat(padLen) : randomPadding(padLen);
    const padded = rawBits + padding;
    for (let off = 0; off < cap; off++) {
      const rotated = rotateBits(padded, off);
      const codons = bitsToSequence(rotated, aaSeq);
      // Synthesized insert = codons after the start Met + stop. Vector's NdeI
      // site (CATATG) supplies the ATG; we provide TAA at the end.
      const insertSeq = codons.slice(1).join('') + 'TAA';
      const cuts = countCuts(insertSeq);
      const hp = maxHomopolymer(insertSeq);
      if (!best || cuts < best.cuts || (cuts === best.cuts && hp < best.hp)) {
        best = { off, cuts, hp, codons, seq: insertSeq };
      }
      if (best.cuts === 0 && best.hp <= 4) break;
    }
    if (best.cuts === 0 && best.hp <= 4) break;
  }
  const bestOffset = best.off;
  const bestHP = best.hp;
  const bestCodons = best.codons;
  const bestSeq = best.seq;

  const extractedBits = sequenceToBits(bestCodons, aaSeq);
  const unrotated = unrotateBits(extractedBits, bestOffset);
  const decoded = huffDecode(unrotated.slice(0, rawBits.length), codes);
  const verify = new TextDecoder().decode(decoded);

  const defaultCodons = [...aaSeq].map(aa => CODON_TABLE[aa][0]);
  const changed = bestCodons.filter((c, i) => c !== defaultCodons[i]).length;
  const modRate = changed / aaSeq.length;

  let bitCursor = 0;
  const codonIsReal = aaSeq.split('').map(aa => {
    const b = bitsFor(aa);
    let hasReal = false;
    for (let j = 0; j < b; j++) {
      if ((bitCursor + j + bestOffset) % cap < rawBits.length) hasReal = true;
    }
    bitCursor += b;
    return hasReal;
  });

  // Internal restriction-site check — the cloning sites must not appear inside
  // the insert or the vector enzymes will cut it.
  const ndeISites = (bestSeq.match(/CATATG/g) || []).length;
  const xhoISites = (bestSeq.match(/CTCGAG/g) || []).length;

  return {
    cds: bestSeq,
    codons: bestCodons,
    codonIsReal,
    offset: bestOffset,
    huffCodes: codes,
    rawBitLen: rawBits.length,
    gc: gcContent(bestSeq),
    hp: bestHP,
    modRate,
    ndeISites,
    xhoISites,
    proteinKey,
    aaSeq,
    verified: verify === message,
    metadata: {
      config: { protein: proteinKey, aa_sequence: aaSeq, version: 2, vector: 'pET-28a(+)', cloning: 'NdeI/XhoI' },
      encoding: { huffman_codes: codes, bit_length: rawBits.length, rotation_offset: bestOffset }
    }
  };
}

function decode(dnaInput, metadataStr) {
  let meta;
  try { meta = JSON.parse(metadataStr); } catch(e) {
    return { error: 'Invalid metadata JSON: ' + e.message };
  }

  // Pick the protein from the metadata so a metadata.json from a different
  // active protein still decodes correctly. Fallbacks: explicit aa_sequence in
  // metadata, then the currently selected protein.
  const metaProteinKey = meta.config && meta.config.protein;
  const metaAA = meta.config && (meta.config.aa_sequence || meta.config.sfgfp_aa);
  const aaSeq = (metaProteinKey && PROTEINS[metaProteinKey] && PROTEINS[metaProteinKey].aa)
    || metaAA
    || currentAA;
  const proteinName = (metaProteinKey && PROTEINS[metaProteinKey] && PROTEINS[metaProteinKey].name) || 'protein';

  const seq = dnaInput.replace(/[^ATCGatcg]/g, '').toUpperCase();
  const cdsLen = aaSeq.length * 3;
  const insertLen = (aaSeq.length - 1) * 3;
  let cds = null;

  // Strategy 1: Sanger read of cloned plasmid — CATATG (NdeI) supplies the ATG
  const ndeiIdx = seq.indexOf('CATATG');
  if (ndeiIdx >= 0) {
    const start = ndeiIdx + 2;
    if (start + cdsLen <= seq.length) cds = seq.slice(start, start + cdsLen);
  }

  // Strategy 2: scan for ATG followed by N valid synonymous codons
  if (!cds) {
    for (let i = 0; i <= seq.length - cdsLen; i++) {
      if (seq.slice(i, i+3) !== 'ATG') continue;
      const candidate = seq.slice(i, i + cdsLen);
      let match = true;
      for (let j = 0; j < aaSeq.length; j++) {
        const codon = candidate.slice(j*3, j*3+3);
        if (!CODON_TABLE[aaSeq[j]] || !CODON_TABLE[aaSeq[j]].includes(codon)) {
          match = false; break;
        }
      }
      if (match) { cds = candidate; break; }
    }
  }

  // Strategy 3: pasted insert without leading ATG (our encoder's output format).
  if (!cds) {
    for (let i = 0; i <= seq.length - insertLen; i++) {
      const candidate = seq.slice(i, i + insertLen);
      let match = true;
      for (let j = 0; j < aaSeq.length - 1; j++) {
        const codon = candidate.slice(j*3, j*3+3);
        const aa = aaSeq[j+1];
        if (!CODON_TABLE[aa] || !CODON_TABLE[aa].includes(codon)) {
          match = false; break;
        }
      }
      if (match) { cds = 'ATG' + candidate; break; }
    }
  }

  if (!cds) return { error: `Could not find ${proteinName} CDS in the provided sequence.` };

  const codons = [];
  for (let i = 0; i < cds.length; i += 3) codons.push(cds.slice(i, i+3));

  const bits = sequenceToBits(codons, aaSeq);
  if (!bits) return { error: 'Codon extraction failed — sequence may have mutations.' };

  const { huffman_codes, bit_length, rotation_offset } = meta.encoding;
  const unrotated = unrotateBits(bits, rotation_offset);
  const msgBits = unrotated.slice(0, bit_length);

  try {
    const decoded = huffDecode(msgBits, huffman_codes);
    const message = new TextDecoder().decode(decoded);
    return { message, bitsUsed: bit_length, codonsRead: codons.length, proteinName };
  } catch(e) {
    return { error: 'Huffman decode failed: ' + e.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// UI
// ═══════════════════════════════════════════════════════════════

let lastEncodeResult = null;
let currentSeqMode = 'dna';

function setSeqMode(mode) {
  currentSeqMode = mode;
  document.querySelectorAll('.seq-mode-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('mode-' + mode).classList.add('active');
  ['dna','protein'].forEach(m => {
    document.getElementById('mode-desc-' + m).style.display = m === mode ? 'block' : 'none';
  });
  if (lastEncodeResult) renderSeqDisplay(lastEncodeResult, mode);
}

// Physicochemical amino-acid palette (background + text) for the protein view.
const AA_PALETTE = {
  // Hydrophobic / aliphatic — green
  A: { bg: '#e6f4ea', fg: '#1b5e20' }, V: { bg: '#e6f4ea', fg: '#1b5e20' },
  L: { bg: '#e6f4ea', fg: '#1b5e20' }, I: { bg: '#e6f4ea', fg: '#1b5e20' },
  M: { bg: '#e6f4ea', fg: '#1b5e20' }, P: { bg: '#e6f4ea', fg: '#1b5e20' },
  // Aromatic — amber
  F: { bg: '#fff3e0', fg: '#bf5a00' }, Y: { bg: '#fff3e0', fg: '#bf5a00' },
  W: { bg: '#fff3e0', fg: '#bf5a00' },
  // Polar uncharged — purple
  S: { bg: '#f3e5f5', fg: '#6a1b9a' }, T: { bg: '#f3e5f5', fg: '#6a1b9a' },
  N: { bg: '#f3e5f5', fg: '#6a1b9a' }, Q: { bg: '#f3e5f5', fg: '#6a1b9a' },
  C: { bg: '#fff8c4', fg: '#7a5a00' },
  // Special — grey
  G: { bg: '#f0f0f0', fg: '#555555' },
  // Positive — blue
  K: { bg: '#e3f2fd', fg: '#0d47a1' }, R: { bg: '#e3f2fd', fg: '#0d47a1' },
  H: { bg: '#e3f2fd', fg: '#0d47a1' },
  // Negative — red
  D: { bg: '#ffebee', fg: '#b71c1c' }, E: { bg: '#ffebee', fg: '#b71c1c' },
};

function renderSeqDisplay(result, mode) {
  const el = document.getElementById('r-seq-display');
  el.innerHTML = '';
  const protKey = result.proteinKey || activeKey;
  const protColor = (PROTEINS[protKey] && PROTEINS[protKey].color) || 'var(--green)';

  if (mode === 'dna') {
    const seq = result.cds;
    el.style.color = '';
    el.innerHTML = `<span style="color:${protColor}">${seq.slice(0,-3)}</span><span style="color:var(--muted);font-weight:500">${seq.slice(-3)}</span>`;

  } else if (mode === 'protein') {
    const aa = result.aaSeq || currentAA;
    let html = `<div style="display:flex;flex-wrap:wrap;gap:3px">`;
    for (let i = 0; i < aa.length; i++) {
      const showNum = i % 35 === 0;
      if (showNum && i > 0) html += `<div style="width:100%;height:0"></div>`;
      if (showNum) html += `<span style="color:var(--muted);font-size:9px;min-width:24px;padding-top:2px">${i+1}</span>`;
      const c = AA_PALETTE[aa[i]] || { bg: 'var(--surface)', fg: 'var(--text)' };
      html += `<span style="background:${c.bg};border:1px solid ${c.fg}1f;border-radius:3px;padding:2px 5px;font-size:11px;color:${c.fg};font-weight:500" title="${aa[i]}">${aa[i]}</span>`;
    }
    html += `</div>`;
    html += `<div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:10px;font-size:10px;color:var(--muted)">
      <span><span style="display:inline-block;width:9px;height:9px;background:#e6f4ea;border:1px solid #1b5e201f;border-radius:2px;vertical-align:middle;margin-right:4px"></span>hydrophobic</span>
      <span><span style="display:inline-block;width:9px;height:9px;background:#fff3e0;border:1px solid #bf5a001f;border-radius:2px;vertical-align:middle;margin-right:4px"></span>aromatic</span>
      <span><span style="display:inline-block;width:9px;height:9px;background:#f3e5f5;border:1px solid #6a1b9a1f;border-radius:2px;vertical-align:middle;margin-right:4px"></span>polar</span>
      <span><span style="display:inline-block;width:9px;height:9px;background:#e3f2fd;border:1px solid #0d47a11f;border-radius:2px;vertical-align:middle;margin-right:4px"></span>positive</span>
      <span><span style="display:inline-block;width:9px;height:9px;background:#ffebee;border:1px solid #b71c1c1f;border-radius:2px;vertical-align:middle;margin-right:4px"></span>negative</span>
      <span><span style="display:inline-block;width:9px;height:9px;background:#fff8c4;border:1px solid #7a5a001f;border-radius:2px;vertical-align:middle;margin-right:4px"></span>cysteine</span>
      <span><span style="display:inline-block;width:9px;height:9px;background:#f0f0f0;border:1px solid #5555551f;border-radius:2px;vertical-align:middle;margin-right:4px"></span>glycine</span>
    </div>`;
    el.innerHTML = html;
  }
}

function switchTab(name) {
  const tabs = ['encode','decode','about'];
  document.querySelectorAll('.tab').forEach((t,i) => t.classList.toggle('active', tabs[i] === name));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-' + name).classList.add('active');
}

function updateCapacityPreview() {
  const msg = document.getElementById('enc-message').value;
  try { localStorage.setItem('htgaa_msg', msg); } catch (e) {}
  if (!msg) {
    document.getElementById('enc-cap-bar').style.width = '0%';
    document.getElementById('enc-cap-bar').style.background = '';
    document.getElementById('enc-cap-label').textContent = '0 / ' + currentCapacity + ' bits';
    document.getElementById('enc-cap-label').style.color = '';
    document.getElementById('enc-cap-warn').style.display = 'none';
    document.getElementById('enc-btn').disabled = false;
    return;
  }
  const bytes = [...new TextEncoder().encode(msg)];
  const codes = buildHuffman(bytes);
  const bits = bytes.map(b => codes[b]).join('').length;
  const pct = Math.min(bits / currentCapacity * 100, 100);
  const over = bits > currentCapacity;
  document.getElementById('enc-cap-bar').style.width = pct + '%';
  document.getElementById('enc-cap-bar').style.background = over ? 'var(--red)' : '';
  document.getElementById('enc-cap-label').textContent = bits + ' / ' + currentCapacity + ' bits';
  document.getElementById('enc-cap-label').style.color = over ? 'var(--red)' : '';
  document.getElementById('enc-cap-warn').style.display = over ? 'block' : 'none';
  document.getElementById('enc-btn').disabled = over;
}

function encodeMessage() {
  const msg = document.getElementById('enc-message').value.trim();
  if (!msg) return;
  document.getElementById('enc-spinner').style.display = 'inline-block';

  setTimeout(() => {
    const result = encode(msg);
    document.getElementById('enc-spinner').style.display = 'none';

    if (result.error) { alert(result.error); return; }
    lastEncodeResult = result;
    document.getElementById('enc-result').style.display = 'block';

    document.getElementById('r-len').textContent = (result.cds.length) + ' nt';
    document.getElementById('r-gc').textContent = (result.gc * 100).toFixed(1) + '%';
    document.getElementById('r-bits').textContent = result.rawBitLen;
    document.getElementById('r-hp').textContent = result.hp;
    document.getElementById('r-mod').textContent = (result.modRate * 100).toFixed(1) + '%';

    const alerts = document.getElementById('enc-alerts');
    alerts.innerHTML = '';
    if (result.verified) alerts.innerHTML += '<div class="alert success"><div class="alert-dot"></div>Round-trip verified — decode produces exact original message</div>';
    if (result.gc >= 0.40 && result.gc <= 0.65) {
      alerts.innerHTML += '<div class="alert success"><div class="alert-dot"></div>GC content ' + (result.gc*100).toFixed(1) + '% is within Twist\'s recommended range</div>';
    } else {
      alerts.innerHTML += '<div class="alert warning"><div class="alert-dot"></div>GC content ' + (result.gc*100).toFixed(1) + '% — check Twist guidelines</div>';
    }
    if (result.hp <= 6) {
      alerts.innerHTML += '<div class="alert success"><div class="alert-dot"></div>Max homopolymer run: ' + result.hp + ' nt (Twist limit: 6)</div>';
    } else {
      alerts.innerHTML += '<div class="alert warning"><div class="alert-dot"></div>Max homopolymer run: ' + result.hp + ' nt — may need manual review</div>';
    }

    if (result.ndeISites === 0 && result.xhoISites === 0) {
      alerts.innerHTML += '<div class="alert success"><div class="alert-dot"></div>No internal NdeI / XhoI sites — clean for pET-28a(+) cloning</div>';
    } else {
      const which = [];
      if (result.ndeISites > 0) which.push(result.ndeISites + '× NdeI (CATATG)');
      if (result.xhoISites > 0) which.push(result.xhoISites + '× XhoI (CTCGAG)');
      alerts.innerHTML += '<div class="alert error"><div class="alert-dot"></div>Internal restriction site(s) found: ' + which.join(', ') + ' — these will cut the insert during cloning. Try a different message or message length.</div>';
    }

    document.getElementById('r-meta').textContent = JSON.stringify(result.metadata, null, 2);

    const aaSeqLocal = result.aaSeq || currentAA;
    const defaultCodons = [...aaSeqLocal].map(aa => CODON_TABLE[aa][0]);
    const changedCount = result.codons.filter((c,i) => bitsFor(aaSeqLocal[i]) > 0 && c !== defaultCodons[i]).length;
    document.getElementById('seq-summary').textContent =
      changedCount + ' / ' + aaSeqLocal.length + ' codons carry your message · ' + (result.rawBitLen) + ' bits hidden';
    currentSeqMode = 'dna';
    document.querySelectorAll('.seq-mode-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('mode-dna').classList.add('active');
    ['dna','protein'].forEach(m => {
      document.getElementById('mode-desc-' + m).style.display = m === 'dna' ? 'block' : 'none';
    });
    renderSeqDisplay(result, 'dna');

    document.getElementById('enc-capacity-bar').style.display = 'block';
    const pct = (result.rawBitLen / currentCapacity * 100);
    document.getElementById('enc-cap-bar').style.width = pct + '%';
    document.getElementById('enc-cap-label').textContent = result.rawBitLen + ' / ' + currentCapacity + ' bits';

    document.getElementById('enc-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.querySelectorAll('.card').forEach(c => c.classList.remove('glow'));
    document.getElementById('enc-result').querySelector('.card').classList.add('glow');
    renderPlasmidMap(result.cds);
    renderCodonMap(result);
  }, 100);
}

function decodeMessage() {
  const seq = document.getElementById('dec-seq').value.trim();
  const meta = document.getElementById('dec-meta').value.trim();
  if (!seq || !meta) return;
  document.getElementById('dec-spinner').style.display = 'inline-block';

  setTimeout(() => {
    const result = decode(seq, meta);
    document.getElementById('dec-spinner').style.display = 'none';
    document.getElementById('dec-result').style.display = 'block';

    if (result.error) {
      document.getElementById('dec-message').textContent = '';
      document.getElementById('dec-alerts').innerHTML = '<div class="alert error"><div class="alert-dot"></div>' + result.error + '</div>';
      document.getElementById('dec-stats').textContent = '';
      return;
    }

    document.getElementById('dec-message').textContent = result.message;
    document.getElementById('dec-alerts').innerHTML = '<div class="alert success"><div class="alert-dot"></div>Message successfully decoded from DNA sequence</div>';
    document.getElementById('dec-stats').textContent = `${result.bitsUsed} bits extracted from ${result.codonsRead} codons`;
    document.getElementById('dec-result-card').classList.add('glow');
    document.getElementById('dec-result').scrollIntoView({ behavior: 'smooth' });
  }, 100);
}

function loadDecodeExample() {
  const sample = encode("Hello from inside a bacterium!");
  if (sample.error) return;
  document.getElementById('dec-seq').value = sample.cds;
  document.getElementById('dec-meta').value = JSON.stringify(sample.metadata, null, 2);
}

function renderCodonMap(result) {
  const map = document.getElementById('r-codon-map');
  if (!map) return;
  map.innerHTML = '';
  const AA_NAMES = {M:'Methionine',S:'Serine',K:'Lysine',G:'Glycine',E:'Glutamate',L:'Leucine',F:'Phenylalanine',T:'Threonine',V:'Valine',I:'Isoleucine',D:'Aspartate',N:'Asparagine',H:'Histidine',Q:'Glutamine',R:'Arginine',P:'Proline',A:'Alanine',Y:'Tyrosine',C:'Cysteine',W:'Tryptophan'};
  const aaSeq = result.aaSeq || currentAA;
  let wobbleCount = 0, fixedCount = 0, realBitCount = 0;
  const codonIsReal = result.codonIsReal || [];

  const extractedBits = sequenceToBits(result.codons, aaSeq);
  let bitCursor = 0;
  const posBits = result.codons.map((_, i) => {
    const b = bitsFor(aaSeq[i]);
    if (b === 0) return null;
    const chunk = extractedBits ? extractedBits.slice(bitCursor, bitCursor + b) : null;
    bitCursor += b;
    return chunk;
  });

  result.codons.forEach((codon, i) => {
    const aa = aaSeq[i];
    const b = bitsFor(aa);
    const opts = CODON_TABLE[aa];
    const isReal = codonIsReal[i];
    const cell = document.createElement('div');

    let cls = 'codon-cell ';
    if (i === 0) cls += 'vector-provided';
    else if (b === 0) cls += 'no-wobble';
    else if (isReal) cls += (b === 2 ? 'bit2' : 'bit1');
    else cls += (b === 2 ? 'bit2 padding-bit' : 'bit1 padding-bit');
    cell.className = cls;
    if (i === 0) cell.title = 'Position 1 — start ATG, supplied by pET-28a(+) NdeI site (not in synthesized insert)';

    if (b > 0) { wobbleCount++; if (isReal) realBitCount++; } else fixedCount++;
    const bitsVal = posBits[i];
    cell.innerHTML = `<span class="aa">${aa}</span><span class="cod">${codon}</span><span class="bts">${bitsVal || (b > 0 ? '·'.repeat(b) : '')}</span>`;

    cell.addEventListener('mouseenter', () => {
      document.querySelectorAll('.codon-cell.active-cell').forEach(c => c.classList.remove('active-cell'));
      cell.classList.add('active-cell');
      const fullName = AA_NAMES[aa] || aa;
      const bitsHtml = bitsVal ? bitsVal.split('').map(bv => `<span class="cd-bit b${bv}">${bv}</span>`).join('') : '';
      const usableCount = b > 0 ? Math.pow(2, b) : 0;
      const detail = document.getElementById('codon-detail');
      if (!detail) return;

      let mappingHtml = '';
      if (b > 0) {
        mappingHtml = `<div style="margin-top:10px">
          <div style="font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:var(--muted);margin-bottom:6px">Codon → bit mapping</div>
          <div style="display:flex;flex-direction:column;gap:3px">`;
        opts.forEach((c, idx) => {
          const isChosen = c === codon;
          const inRange = idx < usableCount;
          const bits = inRange ? idx.toString(2).padStart(b, '0') : null;
          const bitsDisplay = bits ? bits.split('').map(bv => `<span style="width:14px;height:14px;border-radius:2px;display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:600;background:${bv==='1'?'rgba(45,122,79,0.15)':'rgba(26,82,118,0.1)'};color:${bv==='1'?'var(--green)':'#1a5276'}">${bv}</span>`).join('') : '';
          mappingHtml += `<div style="display:flex;align-items:center;gap:8px;padding:3px 6px;border-radius:4px;${isChosen?'background:rgba(45,122,79,0.08);border:1px solid rgba(45,122,79,0.15)':''}">
            <span style="font-family:var(--mono);font-size:11px;font-weight:${isChosen?'600':'400'};color:${isChosen?'var(--green)':inRange?'var(--text)':'var(--muted)'};min-width:32px">${c}</span>
            <span style="color:var(--muted);font-size:11px">→</span>
            ${inRange
              ? `<span style="display:inline-flex;gap:2px">${bitsDisplay}</span>`
              : `<span style="color:var(--muted);font-size:10px">synonym — encoder never picks this</span>`}
            ${isChosen ? '<span style="margin-left:auto;font-size:10px;color:var(--green)">← chosen</span>' : ''}
          </div>`;
        });
        mappingHtml += `</div>
          <div style="margin-top:8px;font-size:10px;color:var(--muted);border-top:1px solid var(--border);padding-top:6px">
            ${opts.length} synonymous codons → ⌊log₂(${opts.length})⌋ = <strong style="color:var(--text)">${b} bit${b>1?'s':''}</strong> hidden here · encoder uses first ${usableCount} codons as bit carriers, remaining ${opts.length - usableCount} are valid synonyms but never chosen
          </div>
        </div>`;
      }

      const isVectorM = i === 0;
      detail.innerHTML = `
        <div style="display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:6px;margin-bottom:10px">
          <div>
            <span style="font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted)">Position ${i+1} of ${aaSeq.length}${isVectorM ? ' — vector-provided' : ''}</span>
            <div style="font-family:var(--serif);font-size:18px;font-weight:300;color:var(--text);line-height:1.2;margin-top:2px">${fullName} <span style="font-family:var(--mono);font-size:12px;color:var(--muted)">(${aa})</span></div>
          </div>
          ${isVectorM
            ? `<span style="font-size:10px;color:#1e40af;background:rgba(96,165,250,0.12);border:1px dashed rgba(96,165,250,0.55);padding:3px 8px;border-radius:4px">supplied by NdeI site</span>`
            : b > 0
              ? `<div style="text-align:right">
                  <div style="font-size:10px;color:var(--muted);margin-bottom:3px">bits encoded here</div>
                  <div style="display:flex;gap:2px;justify-content:flex-end;margin-bottom:4px">${bitsHtml || '<span style="color:var(--muted);font-size:10px">padding</span>'}</div>
                  <span style="font-size:10px;padding:2px 8px;border-radius:4px;${isReal
                    ? 'background:rgba(45,122,79,0.12);color:var(--green);border:1px solid rgba(45,122,79,0.3)'
                    : 'background:var(--bg);color:var(--muted);border:1px solid var(--border)'}">${isReal ? '✦ message bit' : '○ padding zero'}</span>
                 </div>`
              : `<span style="font-size:10px;color:var(--muted);background:var(--bg);border:1px solid var(--border);padding:3px 8px;border-radius:4px">no bits — single codon</span>`}
        </div>
        ${isVectorM
          ? `<div style="font-size:11px;color:var(--muted);line-height:1.7;margin-top:4px">The ATG start codon is restored on ligation by the vector's NdeI site (CATATG). It is <strong style="color:var(--text)">not</strong> part of what you order from Twist — your synthesized insert begins at position 2 (${aaSeq[1]}).</div>`
          : mappingHtml}`;
    });
    map.appendChild(cell);
  });

  const statBits = document.getElementById('cm-stat-bits');
  const statWobble = document.getElementById('cm-stat-wobble');
  const statChanged = document.getElementById('cm-stat-changed');
  const statFixed = document.getElementById('cm-stat-fixed');
  const defaultCodons = [...aaSeq].map(aa => CODON_TABLE[aa][0]);
  const changedCount = result.codons.filter((c,i) => bitsFor(aaSeq[i]) > 0 && c !== defaultCodons[i]).length;
  if (statBits) statBits.textContent = result.rawBitLen;
  if (statWobble) statWobble.textContent = `${realBitCount} message · ${wobbleCount - realBitCount} padding`;
  if (statChanged) statChanged.textContent = changedCount + ' / ' + aaSeq.length;
  if (statFixed) statFixed.textContent = fixedCount;
}

function renderPlasmidMap(insertSeq) {
  const svg = document.getElementById('plasmid-svg');
  svg.innerHTML = '';
  const ns = 'http://www.w3.org/2000/svg';
  const cx = 150, cy = 150, R = 88;
  // The synthesized insert is N-1 codons + TAA. The full CDS on the plasmid is
  // 3 nt longer because the vector's NdeI site contributes the ATG.
  const insertBp = typeof insertSeq === 'string' ? insertSeq.length : insertSeq;
  const insertStr = typeof insertSeq === 'string' ? insertSeq : '';
  const cdsBp = insertBp + 3;
  const TOTAL = 5369 - 78 + cdsBp;

  function mk(tag, attrs) {
    const el = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([k,v]) => el.setAttribute(k, v));
    return el;
  }

  function bpAngle(bp) {
    return (bp / TOTAL) * 2 * Math.PI - Math.PI / 2;
  }

  function polar(r, a) {
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  }

  function arcPath(rIn, rOut, a1, a2) {
    const s1 = polar(rOut, a1), e1 = polar(rOut, a2);
    const s2 = polar(rIn, a2),  e2 = polar(rIn, a1);
    const lg = (a2 - a1 + Math.PI * 2) % (Math.PI * 2) > Math.PI ? 1 : 0;
    return `M${s1[0]},${s1[1]} A${rOut},${rOut},0,${lg},1,${e1[0]},${e1[1]} L${s2[0]},${s2[1]} A${rIn},${rIn},0,${lg},0,${e2[0]},${e2[1]} Z`;
  }

  function tickMark(bp, color, label) {
    const a = bpAngle(bp);
    const [ix, iy] = polar(R - 14, a);
    const [ox, oy] = polar(R + 14, a);
    const [lx, ly] = polar(R + 24, a);
    svg.appendChild(mk('line', { x1:ix, y1:iy, x2:ox, y2:oy, stroke:color, 'stroke-width':'1.5' }));
    const t = mk('text', { x:lx, y:ly, 'text-anchor': Math.cos(a) > 0.1 ? 'start' : Math.cos(a) < -0.1 ? 'end' : 'middle', 'dominant-baseline':'middle', 'font-size':'7.5', 'font-family':'DM Mono,monospace', fill:color, 'font-weight':'500' });
    t.textContent = label;
    svg.appendChild(t);
  }

  const defs = mk('defs', {});
  defs.innerHTML = `<filter id="sfglow" x="-60%" y="-60%" width="220%" height="220%">
    <feGaussianBlur stdDeviation="4" result="blur"/>
    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>`;
  svg.appendChild(defs);

  svg.appendChild(mk('circle', { cx, cy, r:R, fill:'none', stroke:'#e2ddd4', 'stroke-width':'14' }));

  const protName = (PROTEINS[activeKey] && PROTEINS[activeKey].name) || 'CDS';
  const protColor = (PROTEINS[activeKey] && PROTEINS[activeKey].color) || '#4aab72';
  const features = [
    ['T7 promoter',  0,        80,          '#93c5fd', R-6,  R+6  ],
    [protName,       80,       80+cdsBp,    protColor, R-13, R+13 ],
    ['T7 terminator',80+cdsBp+200, 80+cdsBp+320, '#c4b5fd', R-6, R+6],
    ['KanR',         1550,     2650,        '#fbbf24', R-8,  R+8  ],
    ['f1 ori',       2950,     3400,        '#cbd5e1', R-6,  R+6  ],
    ['pBR322 ori',   3800,     4700,        '#cbd5e1', R-6,  R+6  ],
  ];

  features.forEach(([name, s, e, color, rIn, rOut]) => {
    const isProt = name === protName;
    const a1 = bpAngle(s), a2 = bpAngle(e);
    const path = mk('path', { d: arcPath(rIn, rOut, a1, a2), fill: color, opacity: '0.88' });
    if (isProt) path.setAttribute('filter', 'url(#sfglow)');
    svg.appendChild(path);

    const mid = (a1 + a2) / 2;
    const labelR = isProt ? R + 28 : R + 22;
    const [lx, ly] = polar(labelR, mid);
    const anchor = Math.cos(mid) > 0.15 ? 'start' : Math.cos(mid) < -0.15 ? 'end' : 'middle';
    const t = mk('text', { x:lx, y:ly, 'text-anchor':anchor, 'dominant-baseline':'middle', 'font-size': isProt ? '9' : '7.5', 'font-family':'DM Mono,monospace', fill: isProt ? color : '#8a8778', 'font-weight': isProt ? '500' : '400' });
    t.textContent = name;
    svg.appendChild(t);
  });

  tickMark(80,         '#1a6b3c', 'NdeI');
  tickMark(80+cdsBp,   '#922b21', 'XhoI');

  // Internal restriction-site hits — drawn as red marks pointing inward.
  // Insert occupies plasmid bp 83..(80+cdsBp); a hit at insert position i
  // sits at plasmid bp 83 + i.
  function findAll(haystack, needle) {
    const hits = []; let i = -1;
    while ((i = haystack.indexOf(needle, i + 1)) !== -1) hits.push(i);
    return hits;
  }
  function internalTick(bp, color, label) {
    const a = bpAngle(bp);
    const [ix, iy] = polar(R - 18, a);
    const [ox, oy] = polar(R + 18, a);
    svg.appendChild(mk('line', { x1: ix, y1: iy, x2: ox, y2: oy, stroke: color, 'stroke-width': '2', 'stroke-dasharray': '2,2' }));
    const [lx, ly] = polar(R + 32, a);
    const t = mk('text', {
      x: lx, y: ly,
      'text-anchor': Math.cos(a) > 0.1 ? 'start' : Math.cos(a) < -0.1 ? 'end' : 'middle',
      'dominant-baseline': 'middle',
      'font-size': '7.5', 'font-family': 'DM Mono,monospace',
      fill: color, 'font-weight': '600',
    });
    t.textContent = label;
    svg.appendChild(t);
  }
  if (insertStr) {
    findAll(insertStr, 'CATATG').forEach(i => internalTick(83 + i, '#dc2626', '⚠ NdeI'));
    findAll(insertStr, 'CTCGAG').forEach(i => internalTick(83 + i, '#dc2626', '⚠ XhoI'));
  }

  const kb = (TOTAL / 1000).toFixed(1);
  const ct = mk('text', { x:cx, y:cy-10, 'text-anchor':'middle', 'dominant-baseline':'middle', 'font-size':'11', 'font-family':'Cormorant Garamond,serif', fill:'#1a1a14', 'font-weight':'400' });
  ct.textContent = 'pET-28a';
  svg.appendChild(ct);
  const cs = mk('text', { x:cx, y:cy+8, 'text-anchor':'middle', 'dominant-baseline':'middle', 'font-size':'9', 'font-family':'DM Mono,monospace', fill:'#8a8778' });
  cs.textContent = `+${protName}`;
  svg.appendChild(cs);
  const ck = mk('text', { x:cx, y:cy+22, 'text-anchor':'middle', 'dominant-baseline':'middle', 'font-size':'8.5', 'font-family':'DM Mono,monospace', fill:'#8a8778' });
  ck.textContent = `${kb} kb`;
  svg.appendChild(ck);
}

function copySeq() {
  if (!lastEncodeResult) return;
  navigator.clipboard.writeText(lastEncodeResult.cds).then(() => flashBtn('copy-seq-btn'));
}
function downloadMeta() {
  if (!lastEncodeResult) return;
  const blob = new Blob([JSON.stringify(lastEncodeResult.metadata, null, 2)], {type: 'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'metadata.json';
  a.click();
}

function copyMeta() {
  if (!lastEncodeResult) return;
  navigator.clipboard.writeText(JSON.stringify(lastEncodeResult.metadata, null, 2))
    .then(() => flashBtn('copy-meta-btn'));
}

function downloadFasta() {
  if (!lastEncodeResult) return;
  const r = lastEncodeResult;
  const protKey = r.proteinKey || activeKey;
  const protName = (PROTEINS[protKey] && PROTEINS[protKey].name) || 'protein';
  const aaLen = (r.aaSeq || currentAA).length;
  const seq = r.cds;
  const wrapped = [];
  for (let i = 0; i < seq.length; i += 60) wrapped.push(seq.slice(i, i + 60));
  const header = `>${protName}_steganography_insert | ${seq.length} nt | ${aaLen - 1} codons + TAA | bits=${r.rawBitLen} | rotation_offset=${r.offset} | gc=${(r.gc*100).toFixed(1)}% | hp=${r.hp} | order_into=pET-28a(+) NdeI/XhoI`;
  const fasta = header + '\n' + wrapped.join('\n') + '\n';
  const blob = new Blob([fasta], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${protName}-insert.fasta`;
  a.click();
  flashBtn('dl-fasta-btn');
}

function flashBtn(id) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.style.background = 'var(--green-light)';
  setTimeout(() => btn.style.background = 'var(--surface)', 1200);
}

function downloadGenBank() {
  if (!lastEncodeResult) return;
  const r = lastEncodeResult;
  const protKey = r.proteinKey || activeKey;
  const p = PROTEINS[protKey];
  const protName = p ? p.name : 'protein';
  const protAA = r.aaSeq || currentAA;

  // Reconstruct the full ORF as it sits on the cloned plasmid: vector ATG +
  // synthesized insert. This way SnapGene/Benchling translates the CDS
  // feature cleanly to the full protein.
  const fullORF = 'ATG' + r.cds;
  const len = fullORF.length;

  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const d = new Date();
  const dateStr = String(d.getDate()).padStart(2,'0') + '-' + months[d.getMonth()] + '-' + d.getFullYear();

  // GenBank ORIGIN block: 60 nt per line, grouped in 10s, prefixed with
  // 1-indexed nucleotide position right-aligned to 9 chars.
  const originLines = [];
  for (let i = 0; i < fullORF.length; i += 60) {
    const slice = fullORF.slice(i, i + 60).toLowerCase();
    const groups = [];
    for (let j = 0; j < slice.length; j += 10) groups.push(slice.slice(j, j + 10));
    originLines.push(String(i + 1).padStart(9, ' ') + ' ' + groups.join(' '));
  }

  // Translation block: GenBank wraps /translation at column 80.
  const translation = protAA;
  const translationLines = [];
  // First line carries the leading quote and key, gets less room.
  let first = translation.slice(0, 44);
  translationLines.push(`                     /translation="${first}`);
  for (let i = 44; i < translation.length; i += 58) {
    translationLines.push('                     ' + translation.slice(i, i + 58));
  }
  // Append closing quote to last line.
  translationLines[translationLines.length - 1] += '"';

  const gb = [
    `LOCUS       ${(protName + '_steg').padEnd(16, ' ')} ${String(len).padStart(11, ' ')} bp    DNA     linear   SYN ${dateStr}`,
    `DEFINITION  ${protName} steganography insert (full ORF: vector ATG + synthesized insert).`,
    `ACCESSION   .`,
    `VERSION     .`,
    `KEYWORDS    steganography; codon wobble; ${protName}; pET-28a(+).`,
    `SOURCE      synthetic construct`,
    `  ORGANISM  synthetic construct`,
    `            other sequences; artificial sequences.`,
    `COMMENT     Generated by HTGAA fluorescent-protein cipher.`,
    `            Bits hidden:    ${r.rawBitLen}`,
    `            Rotation offset:${String(r.offset).padStart(4,' ')}`,
    `            GC content:     ${(r.gc*100).toFixed(1)}%`,
    `            Max homopolymer:${String(r.hp).padStart(3,' ')} nt`,
    `            Insert (nt 4..${len}) is what to order from Twist.`,
    `            Leading ATG (nt 1..3) is restored on ligation by pET-28a(+) NdeI site (CATATG).`,
    `FEATURES             Location/Qualifiers`,
    `     source          1..${len}`,
    `                     /organism="synthetic construct"`,
    `                     /mol_type="other DNA"`,
    `     CDS             1..${len}`,
    `                     /gene="${protName}"`,
    `                     /product="${p ? p.fullName : protName}"`,
    `                     /codon_start=1`,
    `                     /transl_table=11`,
    ...translationLines,
    `     misc_feature    1..3`,
    `                     /note="ATG supplied by vector NdeI site (CATATG) — not synthesized"`,
    `     misc_feature    4..${len}`,
    `                     /note="synthesized insert: ${protAA.length - 1} codons + TAA stop"`,
    `ORIGIN`,
    ...originLines,
    `//`,
    ``,
  ].join('\n');

  const blob = new Blob([gb], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${protName}-insert.gb`;
  a.click();
  flashBtn('dl-gb-btn');
}

// ═══════════════════════════════════════════════════════════════
// EXPLAINER
// ═══════════════════════════════════════════════════════════════

function showStep(idx) {
  for (let i = 0; i < 4; i++) {
    const el = document.getElementById('step-' + i);
    const btn = document.getElementById('btn-s' + i);
    if (el) el.style.display = i === idx ? 'block' : 'none';
    if (btn) {
      btn.className = i === idx ? 'btn btn-primary' : 'btn btn-secondary';
      btn.style.fontSize = '11px'; btn.style.padding = '6px 14px';
    }
  }
}

const demoBits = [1,0,1,1,0,0,1,1];
function updateRotation(val) {
  document.getElementById('rot-val').textContent = val;
  const offset = parseInt(val);
  const display = document.getElementById('rot-bits-display');
  const colors = ['#fee2e2','#fee2e2','#fee2e2','#fef3c7','#fef3c7','#dcfce7','#dcfce7','#dbeafe'];
  const textColors = ['#991b1b','#991b1b','#991b1b','#92400e','#92400e','#166534','#166534','#1e40af'];
  display.innerHTML = '';
  for (let i = 0; i < 8; i++) {
    const srcIdx = (i + offset) % 8;
    const span = document.createElement('span');
    span.style.cssText = `padding:4px 8px;border-radius:4px;background:${colors[srcIdx]};color:${textColors[srcIdx]};font-family:var(--mono);font-size:10px`;
    span.textContent = demoBits[srcIdx];
    display.appendChild(span);
  }
  const dots = document.createElement('span');
  dots.style.cssText = 'padding:4px 8px;color:var(--muted);font-size:10px';
  dots.textContent = '…rotated';
  display.appendChild(dots);
}
updateRotation(0);

// ═══════════════════════════════════════════════════════════════
// PROTEIN UI WIRING
// ═══════════════════════════════════════════════════════════════

function chunk(str, n) {
  const out = [];
  for (let i = 0; i < str.length; i += n) out.push(str.slice(i, i + n));
  return out;
}

// Build the maximally E. coli K-12-optimized CDS for a protein by picking the
// most-frequent codon at every position. CODON_TABLE is sorted by Kazusa
// frequency (descending), so codon[0] = top-used in K-12. This is the literal
// template the encoder modifies to embed message bits.
function optimizedCDS(aaSeq) {
  let dna = '';
  for (const aa of aaSeq) dna += CODON_TABLE[aa][0];
  return dna + 'TAA';
}

function formatSeqBlock(seq, width) {
  // Display as groups of 10 separated by spaces, 60 chars per line.
  const lines = [];
  for (let i = 0; i < seq.length; i += 60) {
    const slice = seq.slice(i, i + 60);
    const grouped = chunk(slice, 10).join(' ');
    lines.push(grouped);
  }
  return lines.join('\n');
}

function refreshProteinUI() {
  const p = PROTEINS[activeKey];
  if (!p) return;

  // Capacity label / progress reset only the static label parts; the live
  // textarea-driven part is handled by updateCapacityPreview().
  const capLabel = document.getElementById('enc-cap-label');
  if (capLabel && !document.getElementById('enc-message').value) {
    capLabel.textContent = '0 / ' + currentCapacity + ' bits';
  }
  const capWarn = document.getElementById('enc-cap-warn');
  if (capWarn) capWarn.textContent = `Message too long — shorten it to fit within ${currentCapacity} bits.`;

  // Codon-detail placeholder (shown before any cell is hovered).
  const placeholder = document.getElementById('codon-detail-placeholder');
  if (placeholder) {
    placeholder.innerHTML = `Each cell is one amino acid in <strong style="color:var(--text)">${p.name}</strong> (${p.aa.length} total). <span style="color:var(--green)">Green cells</span> carry hidden bits — the codon chosen encodes both the amino acid <em>and</em> part of your secret message. Darker green = 2 bits hidden, lighter = 1 bit. Hover to see the full codon→bit mapping for any position.`;
  }

  // Step-0 explainer: list capacity for every registered protein.
  const stepLine = document.getElementById('step0-capacity-line');
  if (stepLine) {
    const perProtein = Object.values(PROTEINS).map(pp => {
      const wobble = [...pp.aa].filter(aa => bitsFor(aa) > 0).length;
      const cap = computeCapacity(pp.aa);
      return `<strong style="color:var(--text)">${pp.name}</strong>: ${pp.aa.length} aa · ${wobble} wobble positions · ${cap} bits ≈ ${(cap/8).toFixed(0)} bytes`;
    }).join(' &nbsp;·&nbsp; ');
    stepLine.innerHTML = `Formula: bits per position = ⌊log₂(number of codons)⌋. ${perProtein}.`;
  }

  // Update protein selector active state.
  document.querySelectorAll('.protein-pill').forEach(b => {
    b.classList.toggle('active', b.dataset.protein === activeKey);
  });

  // Insert info row (Encode result preview).
  const insertLen = (p.aa.length - 1) * 3 + 3; // (N-1) codons + TAA
  const infoLen = document.getElementById('hg-insert-len');
  if (infoLen) infoLen.textContent = insertLen + ' nt';
  const infoAa = document.getElementById('hg-insert-aa');
  if (infoAa) infoAa.textContent = p.aa.length + ' aa → glows ' + p.glow;
  const infoTitle = document.getElementById('hg-insert-title');
  if (infoTitle) infoTitle.textContent = p.name + ' CDS';

  // Dynamic labels in the Encode result cards.
  const plasmidTitle = document.getElementById('hg-plasmid-title');
  if (plasmidTitle) plasmidTitle.textContent = 'Plasmid map — pET-28a + ' + p.name + ' insert';
  const legendDot = document.getElementById('hg-legend-dot');
  if (legendDot) legendDot.style.background = p.color;
  const legendLabel = document.getElementById('hg-legend-label');
  if (legendLabel) legendLabel.textContent = p.name + ' (message)';
  const cdsBarLabel = document.getElementById('hg-cds-bar-label');
  if (cdsBarLabel) cdsBarLabel.textContent = p.name + ' CDS — message hidden here';
  const encodedTitle = document.getElementById('hg-encoded-title');
  if (encodedTitle) encodedTitle.textContent = 'Your encoded ' + p.name;
  const descDna = document.getElementById('mode-desc-dna');
  if (descDna) descDna.textContent = 'The ' + p.name + ' coding sequence with your message hidden in synonymous codon choices.';
  const descProtein = document.getElementById('mode-desc-protein');
  if (descProtein) descProtein.textContent = 'The translated protein — always identical to canonical ' + p.name + ' no matter what message you encoded.';

  // Host-gene card on "How it works" tab.
  const card = document.getElementById('host-gene-card');
  if (card) {
    const refsHtml = p.refs
      .map(r => `<a href="${r.url}" target="_blank">${r.label} ↗</a>`)
      .join(' &nbsp;·&nbsp; ');
    card.innerHTML = `
      <div class="protein-card-header" style="${p.glow === 'red' ? 'background:#fdecee;border-bottom:1px solid rgba(224,69,92,0.18)' : ''}">
        <div class="gfp-orb" style="${p.glow === 'red' ? 'background:radial-gradient(circle at 38% 38%, #ffb3bf 0%, #e0455c 40%, #8b1c2c 75%, #420c14 100%);box-shadow:0 0 18px rgba(224,69,92,0.55), 0 0 36px rgba(224,69,92,0.18)' : ''}"></div>
        <div>
          <div class="protein-name" style="${p.glow === 'red' ? 'color:#b8324a' : ''}">${p.fullName}</div>
          <div class="protein-sub">${p.organism}</div>
        </div>
      </div>
      <div class="protein-body">
        <div class="protein-grid">
          <div class="ps"><div class="ps-label">Length</div><div class="ps-val">${p.aa.length} amino acids</div></div>
          <div class="ps"><div class="ps-label">Insert</div><div class="ps-val">${(p.aa.length - 1) * 3 + 3} nt — start ATG from pET-28a(+) NdeI; stop included</div></div>
          <div class="ps"><div class="ps-label">Capacity</div><div class="ps-val">${computeCapacity(p.aa)} bits ≈ ${(computeCapacity(p.aa) / 8).toFixed(0)} bytes</div></div>
          <div class="ps"><div class="ps-label">Excitation</div><div class="ps-val">${p.excitation} nm</div></div>
          <div class="ps"><div class="ps-label">Emission</div><div class="ps-val">${p.emission} nm (${p.glow})</div></div>
          <div class="ps"><div class="ps-label">Reference</div><div class="ps-val">${p.paper}</div></div>
        </div>

        <div class="ps-label" style="margin-top:12px">Protein sequence — ${p.aa.length} aa &nbsp;·&nbsp; ${refsHtml}</div>
        <div class="seq-block" style="white-space:pre-wrap">${formatSeqBlock(p.aa, 60)}</div>

        ${(() => {
          const opt = optimizedCDS(p.aa);
          const gc = ([...opt].filter(c => c === 'G' || c === 'C').length / opt.length * 100).toFixed(1);
          return `
          <div class="ps-label" style="margin-top:14px">E. coli K-12 optimized CDS — ${opt.length} nt (incl. TAA) · GC ${gc}%</div>
          <div class="seq-source" style="margin-bottom:6px">Built from the protein by picking the highest-frequency E. coli K-12 codon at every position (Kazusa table). This is the encoder's baseline — message bits are embedded by swapping individual codons against this template. <a href="https://www.kazusa.or.jp/codon/cgi-bin/showcodon.cgi?species=83333" target="_blank">Kazusa K-12 ↗</a></div>
          <div class="seq-block dna-block" style="white-space:pre-wrap">${formatSeqBlock(opt, 60)}</div>
        `;
        })()}

        ${p.sourceNote ? `<div class="seq-source" style="margin-top:10px">${p.sourceNote}</div>` : ''}
      </div>
    `;
  }

  // Plasmid map and codon map auto-refresh next time encode runs; nothing to do here.
}

function initProteinPicker() {
  const wrap = document.getElementById('protein-picker');
  if (!wrap) return;
  wrap.innerHTML = '';
  Object.entries(PROTEINS).forEach(([key, p]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'protein-pill' + (key === activeKey ? ' active' : '');
    btn.dataset.protein = key;
    btn.innerHTML = `
      <span class="protein-pill-dot" style="background:${p.color}"></span>
      <span class="protein-pill-name">${p.name}</span>
      <span class="protein-pill-meta">${p.aa.length} aa · ${computeCapacity(p.aa)} bits</span>
    `;
    btn.onclick = () => setActiveProtein(key);
    wrap.appendChild(btn);
  });
}

(function initOnLoad() {
  const run = () => {
    initProteinPicker();
    refreshProteinUI();
    try {
      const saved = localStorage.getItem('htgaa_msg');
      if (saved) {
        const el = document.getElementById('enc-message');
        if (el) { el.value = saved; updateCapacityPreview(); }
      }
    } catch (e) {}
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();

// ═══════════════════════════════════════════════════════════════
// DNA RAIN
// ═══════════════════════════════════════════════════════════════

(function initDNARain() {
  const bg = document.getElementById('dna-bg');
  const bases = 'ATCGATCGATCG';
  for (let i = 0; i < 20; i++) {
    const col = document.createElement('div');
    col.className = 'dna-col';
    col.style.left = (Math.random() * 100) + '%';
    col.style.animationDuration = (12 + Math.random() * 20) + 's';
    col.style.animationDelay = (-Math.random() * 20) + 's';
    let text = '';
    for (let j = 0; j < 40; j++) text += bases[Math.floor(Math.random()*12)];
    col.textContent = text;
    bg.appendChild(col);
  }
})();
