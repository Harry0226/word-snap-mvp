import asyncio
import json
import os
import pathlib
import sys

import edge_tts


ROOT = pathlib.Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs/audio/sentences-en-gb-v1"
MANIFEST = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/word-snap-verification/listening-audio-manifest.json")
CONCURRENCY = 8


async def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    items = list(json.loads(MANIFEST.read_text()).items())
    semaphore = asyncio.Semaphore(CONCURRENCY)
    done = 0

    async def write_one(key, sentence):
        nonlocal done
        target = OUTPUT / f"{key}.mp3"
        if target.exists() and target.stat().st_size > 1000:
            done += 1
            return
        async with semaphore:
            for attempt in range(4):
                try:
                    temp = target.with_suffix(".tmp")
                    await edge_tts.Communicate(sentence, voice="en-GB-SoniaNeural", rate="-8%").save(str(temp))
                    if temp.stat().st_size <= 1000:
                        raise ValueError("Audio was empty")
                    os.replace(temp, target)
                    done += 1
                    if done % 50 == 0:
                        print(f"Generated {done}/{len(items)}", flush=True)
                    return
                except Exception as error:
                    if attempt == 3:
                        print(f"FAILED {key}: {error}", file=sys.stderr, flush=True)
                        return
                    await asyncio.sleep(2 * (attempt + 1))

    await asyncio.gather(*(write_one(key, sentence) for key, sentence in items))
    missing = [key for key, _ in items if not (OUTPUT / f"{key}.mp3").exists()]
    print(f"Complete: {len(items) - len(missing)}/{len(items)}", flush=True)
    if missing:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
