#!/usr/bin/env python3
"""Build consistent, static MP3 pronunciations for every active built-in term."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import time
from pathlib import Path

import numpy as np

from build_context_sentences import load_manifest_files, load_stage_rows


AUDIO_VERSION = "20260729-kokoro-af-heart-v1"
VOICE = "af_heart"
SAMPLE_RATE = 24_000
MP3_BITRATE_KBPS = 48
LEADING_SILENCE_MS = 80
TRAILING_SILENCE_MS = 140

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
    if term in SPEECH_OVERRIDES:
        return SPEECH_OVERRIDES[term]
    expanded = re.sub(r"\bsb\b", "somebody", term)
    expanded = re.sub(r"\bsth\b", "something", expanded)
    expanded = expanded.replace(" oneself", " yourself")
    return expanded.strip().capitalize() + "."


def encode_mp3(samples: np.ndarray, sample_rate: int) -> bytes:
    import lameenc

    audio = np.asarray(samples, dtype=np.float32).reshape(-1)
    if audio.size == 0:
        raise ValueError("TTS returned no audio samples")

    peak = float(np.max(np.abs(audio)))
    if peak > 0:
        target_peak = 10 ** (-3 / 20)
        audio = audio * min(1.0, target_peak / peak)

    leading = np.zeros(round(sample_rate * LEADING_SILENCE_MS / 1000), dtype=np.float32)
    trailing = np.zeros(round(sample_rate * TRAILING_SILENCE_MS / 1000), dtype=np.float32)
    audio = np.concatenate((leading, audio, trailing))

    fade_samples = min(round(sample_rate * 0.008), audio.size // 2)
    if fade_samples:
        fade = np.linspace(0, 1, fade_samples, dtype=np.float32)
        audio[:fade_samples] *= fade
        audio[-fade_samples:] *= fade[::-1]

    pcm = np.clip(audio * 32767, -32768, 32767).astype("<i2").tobytes()
    encoder = lameenc.Encoder()
    encoder.set_bit_rate(MP3_BITRATE_KBPS)
    encoder.set_in_sample_rate(sample_rate)
    encoder.set_channels(1)
    encoder.set_quality(2)
    return encoder.encode(pcm) + encoder.flush()


def write_unlock_audio(path: Path) -> None:
    if path.exists():
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    samples = np.zeros(round(SAMPLE_RATE * 0.18), dtype=np.float32)
    path.write_bytes(encode_mp3(samples, SAMPLE_RATE))


def write_config(path: Path, term_count: int, base_url: str) -> None:
    payload = {
        "version": AUDIO_VERSION,
        "voice": VOICE,
        "voiceLabel": "统一美式女声",
        "format": "audio/mpeg",
        "termCount": term_count,
        "baseUrl": base_url,
        "unlockSrc": "./audio/unlock.mp3",
    }
    content = "window.WORD_SNAP_AUDIO_CONFIG = " + json.dumps(
        payload, ensure_ascii=False, indent=2, separators=(",", ": ")
    ) + ";\n"
    path.write_text(content, encoding="utf-8", newline="\n")


def prepare_voices_file(raw_voice: Path, output: Path) -> None:
    if output.exists() and output.stat().st_mtime >= raw_voice.stat().st_mtime:
        return
    values = np.fromfile(raw_voice, dtype=np.float32)
    if values.size % 256:
        raise ValueError(f"Unexpected voice vector size: {values.size}")
    voice = values.reshape(-1, 1, 256)
    with output.open("wb") as handle:
        np.savez(handle, **{VOICE: voice})


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


def main() -> None:
    model_root = Path(os.environ.get("TEMP", ".")) / "word-snap-kokoro"
    parser = argparse.ArgumentParser()
    parser.add_argument("--stage-root", type=Path, default=Path("docs/word-data/stages"))
    parser.add_argument("--manifest", type=Path, default=Path("docs/word-data/builtin-manifest.js"))
    parser.add_argument("--output-root", type=Path, default=Path("docs/audio/en-v1"))
    parser.add_argument("--config", type=Path, default=Path("docs/pronunciation-audio-config.js"))
    parser.add_argument("--model", type=Path, default=model_root / "kokoro-quantized-v1.onnx")
    parser.add_argument("--voice", type=Path, default=model_root / "af_heart.bin")
    parser.add_argument("--provider", choices=("cpu", "cuda", "dml"), default="cpu")
    parser.add_argument("--intra-threads", type=int, default=2)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--shard-count", type=int, default=1)
    parser.add_argument("--shard-index", type=int, default=0)
    parser.add_argument("--manifest-only", action="store_true")
    parser.add_argument("--prune", action="store_true")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    if args.shard_count < 1 or not 0 <= args.shard_index < args.shard_count:
        parser.error("--shard-index must be within --shard-count")

    terms = load_terms(args.stage_root, args.manifest)
    args.output_root.mkdir(parents=True, exist_ok=True)
    if args.prune:
        expected = {audio_filename(term) for term in terms}
        for path in args.output_root.glob("*.mp3"):
            if path.name not in expected:
                path.unlink()
    write_unlock_audio(args.output_root.parent / "unlock.mp3")
    write_config(args.config, len(terms), f"./audio/{args.output_root.name}/")

    if args.manifest_only:
        print(json.dumps({"terms": len(terms), "config": str(args.config), "generated": 0}, ensure_ascii=False))
        return

    if not args.model.exists() or args.model.stat().st_size < 50_000_000:
        raise FileNotFoundError(f"Kokoro ONNX model is missing or incomplete: {args.model}")
    if not args.voice.exists() or args.voice.stat().st_size < 500_000:
        raise FileNotFoundError(f"Kokoro voice file is missing or incomplete: {args.voice}")

    from kokoro_onnx import Kokoro

    class FloatSpeedKokoro(Kokoro):
        """Accept the standard float `speed` input used by the HF ONNX export."""

        def _create_audio(self, phonemes, voice, speed):  # noqa: ANN001
            phonemes = phonemes[:510]
            tokens = np.array(self.tokenizer.tokenize(phonemes), dtype=np.int64)
            style = np.array(voice[len(tokens)], dtype=np.float32)
            inputs = {
                "input_ids": np.array([[0, *tokens, 0]], dtype=np.int64),
                "style": style,
                "speed": np.array([speed], dtype=np.float32),
            }
            return self.sess.run(None, inputs)[0], SAMPLE_RATE

    voices_npz = model_root / "word-snap-voices.npz"
    prepare_voices_file(args.voice, voices_npz)
    import onnxruntime as ort

    if args.provider == "cuda":
        if hasattr(ort, "preload_dlls"):
            ort.preload_dlls()
        if "CUDAExecutionProvider" not in ort.get_available_providers():
            raise RuntimeError("CUDAExecutionProvider is not available")
        session = ort.InferenceSession(
            str(args.model),
            providers=["CUDAExecutionProvider", "CPUExecutionProvider"],
        )
        engine = FloatSpeedKokoro.from_session(session, str(voices_npz))
        provider = "CUDAExecutionProvider"
    elif args.provider == "dml" and "DmlExecutionProvider" in ort.get_available_providers():
        session_options = ort.SessionOptions()
        session_options.enable_mem_pattern = False
        session_options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
        session = ort.InferenceSession(
            str(args.model),
            sess_options=session_options,
            providers=["DmlExecutionProvider", "CPUExecutionProvider"],
        )
        engine = FloatSpeedKokoro.from_session(session, str(voices_npz))
        provider = "DmlExecutionProvider"
    else:
        session_options = ort.SessionOptions()
        session_options.intra_op_num_threads = max(1, args.intra_threads)
        session_options.inter_op_num_threads = 1
        session_options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
        session = ort.InferenceSession(
            str(args.model),
            sess_options=session_options,
            providers=["CPUExecutionProvider"],
        )
        engine = FloatSpeedKokoro.from_session(session, str(voices_npz))
        provider = "CPUExecutionProvider"

    selected_terms = terms[args.shard_index :: args.shard_count]
    if args.limit:
        selected_terms = selected_terms[: args.limit]
    generated = 0
    skipped = 0
    failures = []
    started_at = time.perf_counter()

    for index, term in enumerate(selected_terms, start=1):
        output = args.output_root / audio_filename(term)
        if output.exists() and output.stat().st_size > 900 and not args.force:
            skipped += 1
            continue
        try:
            samples, sample_rate = engine.create(
                spoken_text(term),
                voice=VOICE,
                speed=0.92,
                lang="en-us",
            )
            output.write_bytes(encode_mp3(samples, sample_rate))
            generated += 1
        except Exception as error:  # keep a complete report instead of losing a long batch
            failures.append({"term": term, "error": str(error)})
        if index % 50 == 0 or index == len(selected_terms):
            elapsed = max(0.001, time.perf_counter() - started_at)
            print(
                f"{index}/{len(selected_terms)} generated={generated} skipped={skipped} "
                f"failed={len(failures)} rate={index / elapsed:.1f}/s",
                flush=True,
            )

    failure_report = args.output_root.parent / f"generation-errors-{args.shard_index}.json"
    if failures:
        failure_report.write_text(json.dumps(failures, ensure_ascii=False, indent=2), encoding="utf-8")
        raise RuntimeError(f"{len(failures)} pronunciations failed; see {failure_report}")
    if failure_report.exists():
        failure_report.unlink()

    missing = [term for term in terms if not (args.output_root / audio_filename(term)).exists()]
    print(
        json.dumps(
            {
                "terms": len(terms),
                "generated": generated,
                "skipped": skipped,
                "missing": len(missing),
                "outputBytes": sum(path.stat().st_size for path in args.output_root.glob("*.mp3")),
                "voice": VOICE,
                "provider": provider,
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
