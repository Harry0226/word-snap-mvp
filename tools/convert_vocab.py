#!/usr/bin/env python3
"""Convert vocabulary txt/docx files to JS format."""

import os
import re
import docx

STAGES_DIR = "/Users/luqing/Documents/vocabulary/word-snap-mvp/word-data/stages"
OUTPUT_DIR = "/Users/luqing/Documents/vocabulary/word-snap-mvp/word-data/stages"

# File mapping: (filename, stage_name, js_var_name)
FILE_MAP = [
    ("七上课内词库.txt", "初一课内词汇", "GRADE7_INCLASS"),
    ("七上考试词库.txt", "初一考试词汇", "GRADE7_EXAM"),
    ("八上课内词汇.txt", "初二课内词汇", "GRADE8_INCLASS"),
    ("八上考试词汇.txt", "初二考试词汇", "GRADE8_EXAM"),
    ("九上课内词库.txt", "初三课内词汇", "GRADE9_INCLASS"),
    ("高一上课内词汇.txt", "高一课内词汇", "GRADE10_INCLASS"),
    ("高一考试词汇.txt", "高一考试词汇", "GRADE10_EXAM"),
    ("高二上课内词汇.txt", "高二课内词汇", "GRADE11_INCLASS"),
    ("高二上考试词汇.txt", "高二考试词汇", "GRADE11_EXAM"),
    ("高三暑期刷词词库.docx", "高三课内词汇", "GRADE12_INCLASS"),
]

def is_header_line(line):
    """Check if line is a header (Unit X, grade info, etc.)"""
    line = line.strip()
    if not line:
        return True
    # Match "Unit X" or "Unit X (N entries)"
    if re.match(r'^Unit\s+\d+', line, re.IGNORECASE):
        return True
    # Match grade headers like "七年级上册 Unit 1-6 单词和词组表"
    if re.match(r'^[一二三四五六七八九十]+年级', line):
        return True
    # Match "前N词整理"
    if re.match(r'^前\d+词整理', line):
        return True
    return False

def parse_txt_file(filepath):
    """Parse a txt file and return list of (en, zh) tuples."""
    words = []
    with open(filepath, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or is_header_line(line):
                continue
            # Find the first Chinese character or Chinese punctuation to split English and Chinese
            # This handles phrases like "each other 互相" and "full （有）大量的"
            match = re.search(r'[一-鿿（）]', line)
            if match:
                en = line[:match.start()].strip()
                zh = line[match.start():].strip()
                if en and zh:
                    words.append((en, zh))
    return words

def parse_docx_file(filepath):
    """Parse a docx file and return list of (en, zh) tuples."""
    words = []
    doc = docx.Document(filepath)
    for para in doc.paragraphs:
        line = para.text.strip()
        if not line or is_header_line(line):
            continue
        # Find the first Chinese character or Chinese punctuation to split English and Chinese
        match = re.search(r'[一-鿿（）]', line)
        if match:
            en = line[:match.start()].strip()
            zh = line[match.start():].strip()
            if en and zh:
                words.append((en, zh))
    return words

def generate_js(stage_name, var_name, words):
    """Generate JS file content in the format expected by the app."""
    # Generate WORD_SNAP_STAGE_LISTS format
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

    for filename, stage_name, var_name in FILE_MAP:
        filepath = os.path.join(STAGES_DIR, filename)
        if not os.path.exists(filepath):
            print(f"Warning: {filename} not found, skipping")
            continue

        print(f"Processing {filename}...")
        if filename.endswith('.docx'):
            words = parse_docx_file(filepath)
        else:
            words = parse_txt_file(filepath)

        print(f"  Found {len(words)} words")

        # Generate JS file
        js_content = generate_js(stage_name, var_name, words)
        js_filename = f"{var_name.lower().replace('_', '-')}.js"
        js_path = os.path.join(OUTPUT_DIR, js_filename)

        with open(js_path, 'w', encoding='utf-8') as f:
            f.write(js_content)
        print(f"  Generated {js_filename}")

        # Add to manifest
        manifest_stages[stage_name] = {
            "src": f"./word-data/stages/{js_filename}",
            "version": "20260702",
            "count": len(words),
            "source": stage_name
        }

    # Generate manifest
    manifest_content = f"""window.WORD_SNAP_BUILTIN_MANIFEST = {{
  "version": "20260702",
  "stages": {manifest_stages}
}};
"""
    manifest_path = os.path.join(os.path.dirname(OUTPUT_DIR), "builtin-manifest.js")
    with open(manifest_path, 'w', encoding='utf-8') as f:
        f.write(manifest_content)
    print(f"\nGenerated builtin-manifest.js")

if __name__ == "__main__":
    main()
