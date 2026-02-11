#!/usr/bin/env python3
"""
MIDI -> MusicXML helper used by ABCarus MIDI import pipeline.

This wrapper intentionally stays small so that upgrades are easy:
- Parser backend: music21
- Output format: MusicXML (score-partwise)
"""

from __future__ import annotations

import argparse
import os
import sys


VERSION = "0.1.0"


def parse_quarter_divisors(value: str) -> tuple[int, ...]:
    text = str(value or "").strip()
    if not text:
        return (4, 6)
    out = []
    for chunk in text.split(","):
        c = chunk.strip()
        if not c:
            continue
        n = int(c)
        if n <= 0:
            raise ValueError("quarter divisors must be positive integers")
        out.append(n)
    if not out:
        return (4, 6)
    return tuple(out)


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Convert MIDI to MusicXML using music21.")
    p.add_argument("input", nargs="?", help="Input MIDI file path (.mid/.midi)")
    p.add_argument("output", nargs="?", help="Output MusicXML path (.xml/.musicxml)")
    p.add_argument(
        "--quarter-divisors",
        default="4,6",
        help="Comma-separated quarterLengthDivisors for music21 converter.parse (default: 4,6).",
    )
    p.add_argument("--version", action="store_true", help="Print tool version and exit.")
    return p


def main(argv: list[str]) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.version:
        try:
            import music21  # type: ignore

            print(f"midi2xml {VERSION}; music21 {music21.__version__}")
            return 0
        except Exception:
            print(f"midi2xml {VERSION}; music21 unavailable", file=sys.stderr)
            return 3

    if not args.input or not args.output:
        parser.error("input and output paths are required")
        return 2

    input_path = os.path.abspath(args.input)
    output_path = os.path.abspath(args.output)

    if not os.path.exists(input_path):
        print(f"Input not found: {input_path}", file=sys.stderr)
        return 2

    try:
        quarter_divisors = parse_quarter_divisors(args.quarter_divisors)
    except Exception as exc:
        print(f"Invalid --quarter-divisors: {exc}", file=sys.stderr)
        return 2

    try:
        from music21 import converter  # type: ignore
    except Exception as exc:
        print(f"MUSIC21_IMPORT_ERROR: {exc}", file=sys.stderr)
        return 3

    try:
        score = converter.parse(input_path, quarterLengthDivisors=quarter_divisors)
        score.write("musicxml", fp=output_path)
    except Exception as exc:
        print(f"MIDI2XML_CONVERSION_ERROR: {exc}", file=sys.stderr)
        return 4

    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
