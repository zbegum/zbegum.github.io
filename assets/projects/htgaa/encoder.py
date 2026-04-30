#!/usr/bin/env python3
"""Pre-compute and validate fluorescent-protein steganography inserts.

A Biopython-backed sibling of htgaa-cipher.js. Produces the same DNA inserts
the browser UI does, then validates them with Biopython before you paste into
the UI or order from Twist.

Install:
    pip install biopython python-codon-tables

Run:
    python encoder.py --protein mScarlet3 --message "Hello"
    python encoder.py --protein sfGFP --message "Hi" \\
        --fa out.fasta --gb out.gb --meta out.json

The CODON_TABLE below is hardcoded to match htgaa-cipher.js exactly (Kazusa
E. coli K-12 ordering). If you change one side, change the other — otherwise
sequences encoded here will not decode in the browser.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from datetime import date
from heapq import heapify, heappop, heappush

from Bio.Data import CodonTable
from Bio.Restriction import NdeI, RestrictionBatch, XhoI
from Bio.Seq import Seq
from Bio.SeqFeature import FeatureLocation, SeqFeature
from Bio.SeqIO import write as seqio_write
from Bio.SeqRecord import SeqRecord
from Bio.SeqUtils import gc_fraction


# ──────────────────────────────────────────────────────────────────────
# PROTEIN REGISTRY — mirrors PROTEINS in htgaa-cipher.js
# ──────────────────────────────────────────────────────────────────────

PROTEINS: dict[str, str] = {
    "mScarlet3": (
        "MDSTEAVIKEFMRFKVHMEGSMNGHEFEIEGEGEGRPYEGTQTAKLRVTKGGPLPFSWDIL"
        "SPQFMYGSRAFTKHPADIPDYWKQSFPEGFKWERVMNFEDGGAVSVAQDTSLEDGTLIYKV"
        "KLRGTNFPPDGPVMQKKTMGWEASTERLYPEDVVLKGDIKMALRLKDGGRYLADFKTTYRA"
        "KKPVQMPGAFNIDRKLDITSHNEDYTVVEQYERSVARHSTGGSGGS"
    ),
    "sfGFP": (
        "MSKGEELFTGVVPILVELDGDVNGHKFSVRGEGEGDATNGKLTLKFICTTGKLPVPWPTLV"
        "TTLTYGVQCFSRYPDHMKRHDFFKSAMPEGYVQERTISFKDDGTYKTRAEVKFEGDTLVNR"
        "IELKGIDFKEDGNILGHKLEYNFNSHNVYITADKQKNGIKANFKIRHNVEDGSVQLADHYQ"
        "QNTPIGDGPVLLPDNHYLSTQSVLSKDPNEKRDHMVLLEFVTAAGITHGMDELYK"
    ),
}


# ──────────────────────────────────────────────────────────────────────
# CODON TABLE — must match htgaa-cipher.js exactly (Kazusa K-12 sorted)
# ──────────────────────────────────────────────────────────────────────

CODON_TABLE: dict[str, list[str]] = {
    "F": ["TTC", "TTT"],
    "L": ["CTG", "TTA", "TTG", "CTT", "CTC", "CTA"],
    "I": ["ATT", "ATC", "ATA"],
    "M": ["ATG"],
    "V": ["GTG", "GTT", "GTC", "GTA"],
    "S": ["AGC", "TCT", "AGT", "TCC", "TCA", "TCG"],
    "P": ["CCG", "CCA", "CCT", "CCC"],
    "T": ["ACC", "ACG", "ACT", "ACA"],
    "A": ["GCG", "GCC", "GCA", "GCT"],
    "Y": ["TAT", "TAC"],
    "*": ["TAA", "TGA", "TAG"],
    "H": ["CAT", "CAC"],
    "Q": ["CAG", "CAA"],
    "N": ["AAC", "AAT"],
    "K": ["AAA", "AAG"],
    "D": ["GAT", "GAC"],
    "E": ["GAA", "GAG"],
    "C": ["TGC", "TGT"],
    "W": ["TGG"],
    "R": ["CGC", "CGT", "CGG", "CGA", "AGA", "AGG"],
    "G": ["GGC", "GGT", "GGG", "GGA"],
}


def _self_check_codon_table() -> None:
    """At import, verify every codon in CODON_TABLE translates to the right AA
    per Biopython's standard genetic code (NCBI table 1)."""
    forward = CodonTable.unambiguous_dna_by_id[1].forward_table
    stops = set(CodonTable.unambiguous_dna_by_id[1].stop_codons)
    for aa, codons in CODON_TABLE.items():
        for c in codons:
            if aa == "*":
                if c not in stops:
                    raise RuntimeError(f"CODON_TABLE: {c} listed as stop but Biopython says it isn't")
            elif forward.get(c) != aa:
                raise RuntimeError(
                    f"CODON_TABLE: {c} listed under {aa!r} but Biopython says {forward.get(c)!r}"
                )


_self_check_codon_table()


def bits_for(aa: str) -> int:
    n = len(CODON_TABLE[aa])
    return 0 if n <= 1 else (n.bit_length() - 1)  # floor(log2(n))


def capacity_for(protein_aa: str) -> int:
    return sum(bits_for(aa) for aa in protein_aa)


# ──────────────────────────────────────────────────────────────────────
# HUFFMAN — port of the JS algorithm (same codes for same input)
# ──────────────────────────────────────────────────────────────────────

def _build_huffman_codes(byte_seq: list[int]) -> dict[int, str]:
    if not byte_seq:
        return {}
    freq = Counter(byte_seq)
    if len(freq) == 1:
        only = next(iter(freq))
        # JS adds a sibling with freq=0 so the lone symbol still gets a 1-bit code.
        sibling = 1 if only == 0 else 0
        nodes = [
            (freq[only], only, ("leaf", only)),
            (0, sibling, ("leaf", sibling)),
        ]
    else:
        nodes = [(f, b, ("leaf", b)) for b, f in freq.items()]

    heapify(nodes)
    counter = 256  # JS internal-node tiebreaker
    while len(nodes) > 1:
        f1, _, n1 = heappop(nodes)
        f2, _, n2 = heappop(nodes)
        heappush(nodes, (f1 + f2, counter, ("inner", n1, n2)))
        counter += 1
    root = nodes[0][2]

    codes: dict[int, str] = {}

    def walk(node, prefix: str) -> None:
        if node[0] == "leaf":
            codes[node[1]] = prefix or "0"
            return
        walk(node[1], prefix + "0")
        walk(node[2], prefix + "1")

    walk(root, "")
    return codes


def huff_encode(byte_seq: list[int]) -> tuple[str, dict[int, str]]:
    codes = _build_huffman_codes(byte_seq)
    return "".join(codes[b] for b in byte_seq), codes


def huff_decode(bits: str, codes: dict[int, str]) -> bytes:
    rev = {v: k for k, v in codes.items()}
    out = bytearray()
    buf = ""
    for bit in bits:
        buf += bit
        if buf in rev:
            out.append(rev[buf])
            buf = ""
    return bytes(out)


# ──────────────────────────────────────────────────────────────────────
# CORE ENCODER (matches encode() in htgaa-cipher.js)
# ──────────────────────────────────────────────────────────────────────

def _rotate_bits(bits: str, off: int) -> str:
    if not bits or off == 0:
        return bits
    o = off % len(bits)
    return bits[o:] + bits[:o]


def _bits_to_codons(bit_stream: str, protein_aa: str) -> list[str]:
    pos = 0
    codons: list[str] = []
    for aa in protein_aa:
        opts = CODON_TABLE[aa]
        b = bits_for(aa)
        if b == 0:
            codons.append(opts[0])
            continue
        idx = 0
        for _ in range(b):
            bit = int(bit_stream[pos]) if pos < len(bit_stream) else 0
            idx = (idx << 1) | bit
            pos += 1
        codons.append(opts[idx % len(opts)])
    return codons


def _codons_to_bits(codons: list[str], protein_aa: str) -> str:
    out = []
    for i, codon in enumerate(codons):
        aa = protein_aa[i]
        b = bits_for(aa)
        if b == 0:
            continue
        idx = CODON_TABLE[aa].index(codon)
        out.append(format(idx, f"0{b}b"))
    return "".join(out)


def _max_homopolymer(seq: str) -> int:
    if not seq:
        return 0
    best = cur = 1
    for i in range(1, len(seq)):
        if seq[i] == seq[i - 1]:
            cur += 1
            if cur > best:
                best = cur
        else:
            cur = 1
    return best


def encode(message: str, protein_key: str) -> dict:
    if protein_key not in PROTEINS:
        raise ValueError(f"unknown protein {protein_key!r}; choose from {list(PROTEINS)}")
    aa_seq = PROTEINS[protein_key]
    cap = capacity_for(aa_seq)
    raw_bytes = list(message.encode("utf-8"))
    raw_bits, codes = huff_encode(raw_bytes)
    if len(raw_bits) > cap:
        raise ValueError(
            f"message needs {len(raw_bits)} bits but {protein_key} capacity is {cap}"
        )
    # Score offsets lexicographically: (internal cut count, max homopolymer).
    # A single internal NdeI/XhoI site breaks cloning, so cuts dominate hp.
    def _count_cuts(seq: str) -> int:
        return seq.count("CATATG") + seq.count("CTCGAG")

    import random  # local import — only used here
    pad_len = cap - len(raw_bits)
    PAD_ATTEMPTS = 6  # 1 deterministic + 5 random retries
    best: dict | None = None
    for attempt in range(PAD_ATTEMPTS):
        # Deterministic all-zero padding first; random-bit padding on retry.
        # The decoder only reads the first len(raw_bits) bits, so padding
        # values don't affect round-trip.
        padding = "0" * pad_len if attempt == 0 else "".join(random.choice("01") for _ in range(pad_len))
        padded = raw_bits + padding
        for off in range(cap):
            rotated = _rotate_bits(padded, off)
            codons = _bits_to_codons(rotated, aa_seq)
            # Synthesized insert = codons[1..end] + TAA. Vector NdeI supplies ATG.
            insert = "".join(codons[1:]) + "TAA"
            cuts = _count_cuts(insert)
            hp = _max_homopolymer(insert)
            if best is None or cuts < best["cuts"] or (cuts == best["cuts"] and hp < best["hp"]):
                best = {"off": off, "cuts": cuts, "hp": hp, "codons": codons, "seq": insert}
            if best["cuts"] == 0 and best["hp"] <= 4:
                break
        if best["cuts"] == 0 and best["hp"] <= 4:
            break
    assert best is not None
    best_off, best_hp, best_codons, best_seq = best["off"], best["hp"], best["codons"], best["seq"]

    # Round-trip verify — this catches any divergence between encoder/decoder.
    extracted = _codons_to_bits(best_codons, aa_seq)
    unrotated = _rotate_bits(extracted, len(extracted) - best_off)
    decoded = huff_decode(unrotated[: len(raw_bits)], codes)
    if decoded != message.encode("utf-8"):
        raise RuntimeError("round-trip verification failed — encoder bug")

    return {
        "insert": best_seq,
        "full_orf": "ATG" + best_seq,
        "protein": protein_key,
        "aa_seq": aa_seq,
        "rotation_offset": best_off,
        "huffman_codes": codes,
        "bit_length": len(raw_bits),
        "max_homopolymer": best_hp,
        "gc": float(gc_fraction(best_seq)),
        "capacity": cap,
    }


# ──────────────────────────────────────────────────────────────────────
# VALIDATION (Biopython)
# ──────────────────────────────────────────────────────────────────────

def validate(insert_dna: str, protein_aa: str, *,
             gc_min: float = 0.40, gc_max: float = 0.65, hp_max: int = 6
             ) -> tuple[list[str], dict]:
    """Run Biopython-backed sanity checks on the encoded insert."""
    issues: list[str] = []

    # 1. Translation — Biopython translates the full ORF (ATG + insert) and
    # we check it matches the target protein + stop.
    full_orf = "ATG" + insert_dna
    translated = str(Seq(full_orf).translate(table=1, to_stop=False))
    expected = protein_aa + "*"
    if translated != expected:
        # Find first divergent residue for a clearer error.
        for i, (a, b) in enumerate(zip(translated, expected)):
            if a != b:
                issues.append(f"translation diverges at residue {i+1}: got {a!r}, expected {b!r}")
                break
        else:
            issues.append(f"translation length mismatch: got {len(translated)}, expected {len(expected)}")

    # 2. Internal restriction-site scan — Bio.Restriction.
    rb = RestrictionBatch([NdeI, XhoI])
    sites = rb.search(Seq(insert_dna))
    for enzyme, hits in sites.items():
        if hits:
            # Bio.Restriction returns 1-indexed cut positions.
            issues.append(
                f"internal {enzyme} site(s) at insert pos {hits} — vector enzyme will cut the insert"
            )

    # 3. GC bounds.
    gc = float(gc_fraction(insert_dna))
    if not (gc_min <= gc <= gc_max):
        issues.append(f"GC {gc*100:.1f}% outside Twist range {gc_min*100:.0f}–{gc_max*100:.0f}%")

    # 4. Homopolymer.
    hp = _max_homopolymer(insert_dna)
    if hp > hp_max:
        issues.append(f"max homopolymer run {hp} nt exceeds Twist limit {hp_max}")

    return issues, {
        "translation_ok": translated == expected,
        "gc": gc,
        "max_homopolymer": hp,
        "ndei_sites": len(sites.get(NdeI, [])),
        "xhoi_sites": len(sites.get(XhoI, [])),
    }


# ──────────────────────────────────────────────────────────────────────
# OUTPUT (Biopython SeqIO)
# ──────────────────────────────────────────────────────────────────────

def write_fasta(result: dict, path: str) -> None:
    record = SeqRecord(
        Seq(result["insert"]),
        id=f"{result['protein']}_steg_insert",
        description=(
            f"{len(result['insert'])} nt | bits={result['bit_length']} "
            f"| offset={result['rotation_offset']} | gc={result['gc']*100:.1f}% "
            f"| hp={result['max_homopolymer']} | order_into=pET-28a(+) NdeI/XhoI"
        ),
    )
    seqio_write([record], path, "fasta")


def write_genbank(result: dict, path: str) -> None:
    full_orf = result["full_orf"]
    record = SeqRecord(
        Seq(full_orf),
        id=f"{result['protein']}_steg",
        name=f"{result['protein']}_steg",
        description=(
            f"{result['protein']} steganography insert (full ORF: vector ATG + synthesized insert)."
        ),
        annotations={
            "molecule_type": "DNA",
            "topology": "linear",
            "data_file_division": "SYN",
            "date": date.today().strftime("%d-%b-%Y").upper(),
            "keywords": ["steganography", "codon wobble", result["protein"], "pET-28a(+)"],
            "source": "synthetic construct",
            "organism": "synthetic construct",
            "comment": (
                f"Generated by htgaa encoder.py.\n"
                f"Bits hidden: {result['bit_length']} | rotation offset: {result['rotation_offset']} "
                f"| GC: {result['gc']*100:.1f}% | max homopolymer: {result['max_homopolymer']} nt.\n"
                f"Insert (nt 4..{len(full_orf)}) is what to order from Twist.\n"
                f"Leading ATG (nt 1..3) is restored on ligation by pET-28a(+) NdeI site (CATATG)."
            ),
        },
    )
    record.features = [
        SeqFeature(FeatureLocation(0, len(full_orf)), type="source",
                   qualifiers={"organism": ["synthetic construct"], "mol_type": ["other DNA"]}),
        SeqFeature(FeatureLocation(0, len(full_orf)), type="CDS",
                   qualifiers={
                       "gene": [result["protein"]],
                       "product": [result["protein"]],
                       "codon_start": ["1"],
                       "transl_table": ["11"],
                       "translation": [result["aa_seq"]],
                   }),
        SeqFeature(FeatureLocation(0, 3), type="misc_feature",
                   qualifiers={"note": ["ATG supplied by vector NdeI site (CATATG) — not synthesized"]}),
        SeqFeature(FeatureLocation(3, len(full_orf)), type="misc_feature",
                   qualifiers={"note": [f"synthesized insert: {len(result['aa_seq'])-1} codons + TAA stop"]}),
    ]
    seqio_write([record], path, "genbank")


def write_metadata_json(result: dict, path: str) -> None:
    """Emit metadata.json the browser Decode tab can read directly."""
    meta = {
        "config": {
            "protein": result["protein"],
            "aa_sequence": result["aa_seq"],
            "version": 2,
            "vector": "pET-28a(+)",
            "cloning": "NdeI/XhoI",
        },
        "encoding": {
            "huffman_codes": {str(k): v for k, v in result["huffman_codes"].items()},
            "bit_length": result["bit_length"],
            "rotation_offset": result["rotation_offset"],
        },
    }
    with open(path, "w") as f:
        json.dump(meta, f, indent=2)


# ──────────────────────────────────────────────────────────────────────
# CLI
# ──────────────────────────────────────────────────────────────────────

def main() -> int:
    p = argparse.ArgumentParser(
        description="Pre-compute and validate FP-steganography inserts (Biopython sibling of htgaa-cipher.js).",
    )
    p.add_argument("--protein", choices=list(PROTEINS), default="mScarlet3",
                   help="Host protein scaffold (default: mScarlet3).")
    p.add_argument("--message", required=True, help="Message to hide.")
    p.add_argument("--fa", help="Write FASTA to this path.")
    p.add_argument("--gb", help="Write GenBank (.gb) to this path.")
    p.add_argument("--meta", help="Write metadata.json (for the browser Decode tab) to this path.")
    p.add_argument("--json", action="store_true",
                   help="Emit machine-readable JSON only (suppresses human report).")
    args = p.parse_args()

    try:
        result = encode(args.message, args.protein)
    except (ValueError, RuntimeError) as e:
        print(f"ENCODE ERROR: {e}", file=sys.stderr)
        return 2

    issues, stats = validate(result["insert"], PROTEINS[args.protein])

    if args.json:
        print(json.dumps({
            "protein": args.protein,
            "insert": result["insert"],
            "full_orf": result["full_orf"],
            "bit_length": result["bit_length"],
            "rotation_offset": result["rotation_offset"],
            "capacity": result["capacity"],
            "gc": stats["gc"],
            "max_homopolymer": stats["max_homopolymer"],
            "translation_ok": stats["translation_ok"],
            "ndei_sites": stats["ndei_sites"],
            "xhoi_sites": stats["xhoi_sites"],
            "issues": issues,
        }, indent=2))
    else:
        protein_aa = PROTEINS[args.protein]
        used_pct = result["bit_length"] / result["capacity"] * 100
        print(f"Protein:         {args.protein} ({len(protein_aa)} aa)")
        print(f"Insert length:   {len(result['insert'])} nt  (= {len(protein_aa)-1} codons + TAA)")
        print(f"Bits hidden:     {result['bit_length']} / {result['capacity']} ({used_pct:.1f}%)")
        print(f"Rotation offset: {result['rotation_offset']}")
        print(f"GC content:      {stats['gc']*100:.2f}%")
        print(f"Max homopolymer: {stats['max_homopolymer']} nt")
        print(f"Translation:     {'OK (Biopython table 1)' if stats['translation_ok'] else 'FAIL'}")
        print(f"NdeI internal:   {stats['ndei_sites']}")
        print(f"XhoI internal:   {stats['xhoi_sites']}")
        print()
        if issues:
            print("VALIDATION ISSUES:")
            for i in issues:
                print(f"  - {i}")
        else:
            print("All Biopython validation checks passed — safe to order.")
        print()
        print("Insert DNA (paste into Encode tab's Decode-with-metadata flow, or order from Twist):")
        for i in range(0, len(result["insert"]), 60):
            print(f"  {result['insert'][i:i+60]}")

    if args.fa:
        write_fasta(result, args.fa)
        print(f"\nWrote FASTA → {args.fa}", file=sys.stderr)
    if args.gb:
        write_genbank(result, args.gb)
        print(f"Wrote GenBank → {args.gb}", file=sys.stderr)
    if args.meta:
        write_metadata_json(result, args.meta)
        print(f"Wrote metadata → {args.meta}", file=sys.stderr)

    return 1 if issues else 0


if __name__ == "__main__":
    sys.exit(main())
