#!/usr/bin/env python3
"""Reformat existing JS vocab files to the correct format."""

import os
import re
import json

STAGES_DIR = "/Users/luqing/Documents/vocabulary/word-snap-mvp/word-data/stages"

# File mapping: (filename, stage_name)
FILE_MAP = [
    ("grade7-inclass.js", "初一课内词汇"),
    ("grade7-exam.js", "初一考试词汇"),
    ("grade8-inclass.js", "初二课内词汇"),
    ("grade8-exam.js", "初二考试词汇"),
    ("grade9-inclass.js", "初三课内词汇"),
    ("grade10-inclass.js", "高一课内词汇"),
    ("grade10-exam.js", "高一考试词汇"),
    ("grade11-inclass.js", "高二课内词汇"),
    ("grade11-exam.js", "高二考试词汇"),
    ("grade12-inclass.js", "高三课内词汇"),
]

def parse_js_words(filepath):
    """Parse words from existing JS file."""
    words = []
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        # Find all { en: "...", zh: "..." } patterns
        pattern = r'\{\s*en:\s*"([^"]*)",\s*zh:\s*"([^"]*)"\s*\}'
        matches = re.findall(pattern, content)
        for en, zh in matches:
            words.append((en, zh))
    return words

def generate_js(stage_name, words):
    """Generate JS file content in the correct format."""
    words_json = []
    for en, zh in words:
        en_escaped = en.replace('"', '\\"')
        zh_escaped = zh.replace('"', '\\"')
        words_json.append(f'    {{"en":"{en_escaped}","zh":"{zh_escaped}","pos":"","notes":"","frequency":0}}')

    words_str = ',\n'.join(words_json)
    return f'''window.WORD_SNAP_STAGE_LISTS = window.WORD_SNAP_STAGE_LISTS || {{}};
window.WORD_SNAP_STAGE_LISTS["{stage_name}"] = {{"grade":"{stage_name}","goals":["{stage_name}"],"source":"{stage_name}","words":[
{words_str}
]}};
'''

def main():
    manifest_stages = {}

    for filename, stage_name in FILE_MAP:
        filepath = os.path.join(STAGES_DIR, filename)
        if not os.path.exists(filepath):
            print(f"Warning: {filename} not found, skipping")
            continue

        print(f"Processing {filename}...")
        words = parse_js_words(filepath)
        print(f"  Found {len(words)} words")

        # Generate JS file with correct format
        js_content = generate_js(stage_name, words)

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(js_content)
        print(f"  Reformatted {filename}")

        # Add to manifest
        manifest_stages[stage_name] = {
            "src": f"./word-data/stages/{filename}",
            "version": "20260702",
            "count": len(words),
            "source": stage_name
        }

    # Generate manifest
    manifest_content = f"""window.WORD_SNAP_BUILTIN_MANIFEST = {{
  "version": "20260702",
  "stages": {json.dumps(manifest_stages, ensure_ascii=False, indent=4)}
}};
"""
    manifest_path = os.path.join(os.path.dirname(STAGES_DIR), "builtin-manifest.js")
    with open(manifest_path, 'w', encoding='utf-8') as f:
        f.write(manifest_content)
    print(f"\nGenerated builtin-manifest.js")

if __name__ == "__main__":
    main()
