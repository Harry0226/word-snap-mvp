#!/usr/bin/env python3
"""Build clean, consistent British-English MP3 pronunciations for active terms."""

from __future__ import annotations

import argparse
import asyncio
from datetime import datetime
import json
import re
import sys
import time
from pathlib import Path

from build_context_sentences import load_manifest_files, load_stage_rows


AUDIO_VERSION = "20260731-edge-sonia-en-gb-v2"
VOICE = "en-GB-SoniaNeural"
VOICE_LABEL = "微软 Sonia 标准英式女声"
RATE = "-8%"
MIN_AUDIO_BYTES = 900
MAX_ATTEMPTS = 4

SPEECH_OVERRIDES = {
    "a m": "A. M.",
    "p m": "P. M.",
    "u k": "U. K.",
    "u s": "U. S.",
    "u s a": "U. S. A.",
    "tv": "T. V.",
    "cd": "C. D.",
    "dvd": "D. V. D.",
    "id": "I. D.",
    "iq": "I. Q.",
    "pe": "P. E.",
}
AUDIO_WORD_RE = re.compile(r"[A-Za-z]+(?:[-'][A-Za-z]+)*")


def fnv1a32(value: str) -> int:
    result = 0x811C9DC5
    for byte in value.encode("utf-8"):
        result ^= byte
        result = (result * 0x01000193) & 0xFFFFFFFF
    return result


def djb2xor32(value: str) -> int:
    result = 5381
    for byte in value.encode("utf-8"):
        result = (((result << 5) + result) ^ byte) & 0xFFFFFFFF
    return result


def audio_filename(term: str) -> str:
    return f"{fnv1a32(term):08x}{djb2xor32(term):08x}.mp3"


def normalize_audio_term(value: str) -> str:
    cleaned = re.sub(
        r"\s+(?:(?:n|v|adj|adv|prep|conj|pron|num|int)\.)?All Rights Reserved\..*$",
        "",
        str(value or ""),
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(r"\s+copyright.*$", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(
        r"\s+(?:n|v|adj|adv|prep|conj|pron|num|int)\.$",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(r"\s*\([^)]*\)", " ", cleaned)
    cleaned = re.sub(r"\.{3,}", " ", cleaned).replace("’", "'")
    return " ".join(token.lower() for token in AUDIO_WORD_RE.findall(cleaned))


def spoken_text(term: str) -> str:
    """Keep short terms bare so the synthesizer does not add sentence-start sounds."""
    if term in SPEECH_OVERRIDES:
        return SPEECH_OVERRIDES[term]
    expanded = re.sub(r"\bsb\b", "somebody", term)
    expanded = re.sub(r"\bsth\b", "something", expanded)
    expanded = expanded.replace(" oneself", " yourself")
    return expanded.strip()


def write_config(path: Path, term_count: int, base_url: str) -> None:
    payload = {
        "version": AUDIO_VERSION,
        "voice": VOICE,
        "voiceLabel": VOICE_LABEL,
        "format": "audio/mpeg",
        "termCount": term_count,
        "baseUrl": base_url,
        "unlockSrc": "./audio/unlock.mp3",
    }
    content = "window.WORD_SNAP_AUDIO_CONFIG = " + json.dumps(
        payload, ensure_ascii=False, indent=2, separators=(",", ": ")
    ) + ";\n"
    path.write_text(content, encoding="utf-8", newline="\n")


def load_terms(stage_root: Path, manifest: Path) -> list[str]:
    rows, _ = load_stage_rows(stage_root, load_manifest_files(manifest))
    terms = sorted({normalize_audio_term(row.en) for row in rows if normalize_audio_term(row.en)})
    collisions: dict[str, str] = {}
    for term in terms:
        filename = audio_filename(term)
        previous = collisions.setdefault(filename, term)
        if previous != term:
            raise ValueError(f"Audio filename collision: {previous!r} and {term!r}")
    return terms


def is_valid_mp3(path: Path) -> bool:
    if not path.exists() or path.stat().st_size <= MIN_AUDIO_BYTES:
        return False
    header = path.read_bytes()[:3]
    return header == b"ID3" or (len(header) >= 2 and header[0] == 0xFF and header[1] & 0xE0 == 0xE0)


async def generate_term(term: str, output: Path, force: bool, replace_before: float | None) -> str:
    if is_valid_mp3(output) and not force:
        if replace_before is None or output.stat().st_mtime >= replace_before:
            return "skipped"

    import edge_tts

    partial = output.with_suffix(".mp3.part")
    last_error: Exception | None = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            if partial.exists():
                partial.unlink()
            communicate = edge_tts.Communicate(
                spoken_text(term),
                VOICE,
                rate=RATE,
                volume="+0%",
                pitch="+0Hz",
            )
            await communicate.save(str(partial))
            if not is_valid_mp3(partial):
                raise ValueError("synthesizer returned an empty or invalid MP3")
            partial.replace(output)
            return "generated"
        except Exception as error:  # retry transient service and network failures
            last_error = error
            if partial.exists():
                partial.unlink()
            if attempt < MAX_ATTEMPTS:
                await asyncio.sleep(0.5 * (2 ** (attempt - 1)))
    raise RuntimeError(str(last_error or "pronunciation generation failed"))


async def build_audio(
    terms: list[str], output_root: Path, force: bool, replace_before: float | None, concurrency: int
) -> tuple[int, int, list[dict[str, str]]]:
    semaphore = asyncio.Semaphore(max(1, concurrency))
    generated = 0
    skipped = 0
    failures: list[dict[str, str]] = []
    completed = 0
    started_at = time.perf_counter()

    async def worker(term: str) -> None:
        nonlocal completed, generated, skipped
        output = output_root / audio_filename(term)
        try:
            async with semaphore:
                status = await generate_term(term, output, force, replace_before)
            if status == "generated":
                generated += 1
            else:
                skipped += 1
        except Exception as error:
            failures.append({"term": term, "error": str(error)})
        finally:
            completed += 1
            if completed % 50 == 0 or completed == len(terms):
                elapsed = max(0.001, time.perf_counter() - started_at)
                print(
                    f"{completed}/{len(terms)} generated={generated} skipped={skipped} "
                    f"failed={len(failures)} rate={completed / elapsed:.1f}/s",
                    flush=True,
                )

    await asyncio.gather(*(worker(term) for term in terms))
    return generated, skipped, failures


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--stage-root", type=Path, default=Path("docs/word-data/stages"))
    parser.add_argument("--manifest", type=Path, default=Path("docs/word-data/builtin-manifest.js"))
    parser.add_argument("--output-root", type=Path, default=Path("docs/audio/en-gb-v1"))
    parser.add_argument("--config", type=Path, default=Path("docs/pronunciation-audio-config.js"))
    parser.add_argument("--concurrency", type=int, default=8)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--shard-count", type=int, default=1)
    parser.add_argument("--shard-index", type=int, default=0)
    parser.add_argument("--manifest-only", action="store_true")
    parser.add_argument("--prune", action="store_true")
    parser.add_argument("--force", action="store_true")
    parser.add_argument(
        "--replace-before",
        help="Regenerate valid clips whose modification time is before this ISO timestamp",
    )
    args = parser.parse_args()
    if args.shard_count < 1 or not 0 <= args.shard_index < args.shard_count:
        parser.error("--shard-index must be within --shard-count")

    terms = load_terms(args.stage_root, args.manifest)
    args.output_root.mkdir(parents=True, exist_ok=True)
    for partial in args.output_root.glob("*.part"):
        partial.unlink()
    if args.prune:
        expected = {audio_filename(term) for term in terms}
        for path in args.output_root.glob("*.mp3"):
            if path.name not in expected:
                path.unlink()
    unlock = args.output_root.parent / "unlock.mp3"
    if not is_valid_mp3(unlock):
        raise FileNotFoundError(f"Audio unlock MP3 is missing or invalid: {unlock}")
    write_config(args.config, len(terms), f"./audio/{args.output_root.name}/")

    if args.manifest_only:
        print(json.dumps({"terms": len(terms), "config": str(args.config), "generated": 0}, ensure_ascii=False))
        return

    selected_terms = terms[args.shard_index :: args.shard_count]
    if args.limit:
        selected_terms = selected_terms[: args.limit]
    replace_before = datetime.fromisoformat(args.replace_before).timestamp() if args.replace_before else None
    generated, skipped, failures = asyncio.run(
        build_audio(selected_terms, args.output_root, args.force, replace_before, args.concurrency)
    )

    failure_report = args.output_root.parent / f"generation-errors-{args.shard_index}.json"
    if failures:
        failure_report.write_text(json.dumps(failures, ensure_ascii=False, indent=2), encoding="utf-8")
        raise RuntimeError(f"{len(failures)} pronunciations failed; see {failure_report}")
    if failure_report.exists():
        failure_report.unlink()

    missing = [term for term in terms if not is_valid_mp3(args.output_root / audio_filename(term))]
    print(
        json.dumps(
            {
                "terms": len(terms),
                "generated": generated,
                "skipped": skipped,
                "missing": len(missing),
                "outputBytes": sum(path.stat().st_size for path in args.output_root.glob("*.mp3")),
                "voice": VOICE,
                "provider": "Microsoft Edge neural TTS",
                "version": AUDIO_VERSION,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    if args.shard_count == 1 and not args.limit and missing:
        raise RuntimeError(f"{len(missing)} built-in terms are missing audio")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
