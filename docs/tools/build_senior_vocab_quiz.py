import json
import re
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile


ROOT = Path(__file__).resolve().parents[1]
DRAG = Path("/Users/luqing/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/wxid_4ag2v73ezhe722_a4b9/temp/drag")

VOCAB_FILES = {
    "高一": DRAG / "高一词汇更新去年期末版.md",
    "高二": DRAG / "高二词汇更新去年期末版.md",
}

QUIZ_FILES = {
    "高一": DRAG / "高一英语词汇语法填空答案.docx",
    "高二": DRAG / "高二英语词汇语法填空答案.docx",
}

QUIZ_GLOBALS = {
    "高一": "WORD_SNAP_GRADE10_QUIZ_SENTENCES",
    "高二": "WORD_SNAP_GRADE11_QUIZ_SENTENCES",
}

QUIZ_OUTPUTS = {
    "高一": ROOT / "word-data/quiz-grade10-sentences.js",
    "高二": ROOT / "word-data/quiz-grade11-sentences.js",
}

SOURCE_NAMES = {
    "高一": "高一内置词库",
    "高二": "高二内置词库",
}


def parse_markdown_vocab(path):
    rows = []
    seen = set()
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line:
            continue
        if re.match(r"^(#|\*|---|Date|Turns|Source|Turn |###|🤖)", line):
            continue
        if re.match(r"^(为了|根据|你可以|以下内容|由于|1\. |2\. |精准|拓展)", line):
            continue
        match = re.match(r"^(.+?)\s+([\u3400-\u9fff（].*)$", line)
        if not match:
            continue
        en = re.sub(r"\s+", " ", match.group(1)).strip()
        zh = re.sub(r"\s+", " ", match.group(2)).strip()
        key = en.lower()
        if key in seen:
            continue
        seen.add(key)
        rows.append({"en": en, "zh": zh, "pos": "", "notes": "", "frequency": 0})
    return rows


def read_docx_paragraphs(path):
    ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    with ZipFile(path) as zf:
        root = ET.fromstring(zf.read("word/document.xml"))
    paragraphs = []
    for paragraph in root.findall(".//w:p", ns):
        text = "".join(node.text or "" for node in paragraph.findall(".//w:t", ns)).strip()
        if text:
            paragraphs.append(re.sub(r"\s+", " ", text))
    return paragraphs


def strip_chinese_parentheses(text):
    text = re.sub(r"\s*[（(][^A-Za-z)]*[\)）]", "", text)
    return re.sub(r"\s+", " ", text).strip()


def clean_answer(text):
    text = text.strip()
    text = re.sub(r"^(单数形式|表达了|提示|答案)\s*[:：]\s*", "", text)
    text = strip_chinese_parentheses(text)
    text = re.sub(r"^[\"“]|[\"”。.]+$", "", text).strip()
    return text


def answer_from_sentence(text):
    matches = list(re.finditer(r"([A-Za-z][A-Za-z'’./-]*(?:\s+[A-Za-z][A-Za-z'’./-]*){0,4})\s*[（(][^A-Za-z)]*[\)）]", text))
    if not matches:
        return ""
    best = max(matches, key=lambda item: len(item.group(1)))
    return clean_answer(best.group(1).replace("’", "'"))


def blank_sentence(text, answer):
    if not answer:
        return text
    escaped = re.escape(answer)
    sentence = re.sub(escaped + r"\s*([（(][^)]*[\)）])?", "______", text, count=1)
    sentence = re.sub(r"\s*[（(][^A-Za-z)]*[\)）]", "", sentence)
    return re.sub(r"\s+", " ", sentence).strip()


def stem_variants(answer):
    base = answer.strip()
    if not re.fullmatch(r"[A-Za-z][A-Za-z'-]*", base):
        return []
    lower = base.lower()
    variants = []
    if lower.endswith("y") and len(lower) > 2:
        variants.extend([lower[:-1] + "ies", lower[:-1] + "ied", lower[:-1] + "ier"])
    if lower.endswith("e"):
        variants.extend([lower + "s", lower[:-1] + "ing", lower + "d"])
    else:
        variants.extend([lower + "s", lower + "ed", lower + "ing"])
    if lower.endswith("s"):
        variants.append(lower[:-1])
    if lower.endswith("ing"):
        variants.append(lower[:-3])
    if lower.endswith("ed"):
        variants.append(lower[:-2])
    return [item for item in variants if item and item != lower]


def make_options(answer, vocab):
    options = [answer]
    used = {answer.lower()}
    first = answer[:1].lower()

    for candidate in stem_variants(answer):
        if candidate.lower() not in used and len(options) < 5:
            options.append(candidate)
            used.add(candidate.lower())

    same_first = [row["en"] for row in vocab if row["en"][:1].lower() == first and row["en"].lower() not in used]
    for candidate in same_first:
        if len(options) >= 5:
            break
        options.append(candidate)
        used.add(candidate.lower())

    for row in vocab:
        candidate = row["en"]
        if len(options) >= 5:
            break
        if candidate.lower() in used:
            continue
        options.append(candidate)
        used.add(candidate.lower())

    return options[:5]


def parse_numbered_question(line, grade, index, vocab):
    body = re.sub(r"^\(\d+\)\s*", "", line).strip()
    if "→" in body:
        left, right = [part.strip() for part in body.split("→", 1)]
        answer = clean_answer(right)
        if "：" in right or ":" in right:
            sentence = f"{left} → ______"
        else:
            sentence = f"{strip_chinese_parentheses(left)} → ______"
        qtype = "transform-choice"
    else:
        answer = answer_from_sentence(body)
        sentence = blank_sentence(body, answer)
        qtype = "sentence-blank"

    if not answer:
        answer = clean_answer(body)
        sentence = "______"

    return {
        "id": f"{'g10' if grade == '高一' else 'g11'}-{index:03d}",
        "grade": grade,
        "sentence": sentence,
        "answer": answer,
        "options": make_options(answer, vocab),
        "type": qtype,
        "source": f"{grade}英语词汇语法填空答案",
    }


def build_quiz(grade, docx_path, vocab):
    questions = []
    for paragraph in read_docx_paragraphs(docx_path):
        if not re.match(r"^\(\d+\)", paragraph):
            continue
        questions.append(parse_numbered_question(paragraph, grade, len(questions) + 1, vocab))
    return questions


def load_builtin_lists():
    source = (ROOT / "word-data/builtin-word-lists.js").read_text(encoding="utf-8")
    payload = source.split("=", 1)[1].strip().rstrip(";")
    return json.loads(payload)


def write_js_global(path, global_name, data):
    path.write_text(
        f"window.{global_name} = {json.dumps(data, ensure_ascii=False, indent=2)};\n",
        encoding="utf-8",
    )


def main():
    vocab_by_grade = {grade: parse_markdown_vocab(path) for grade, path in VOCAB_FILES.items()}
    lists = load_builtin_lists()
    for grade, words in vocab_by_grade.items():
        entry = next(item for item in lists if item["grade"] == grade)
        entry["source"] = SOURCE_NAMES[grade]
        entry["goals"] = [grade]
        entry["words"] = words

    (ROOT / "word-data/builtin-word-lists.js").write_text(
        f"window.WORD_SNAP_BUILTIN_LISTS = {json.dumps(lists, ensure_ascii=False, indent=4)};\n",
        encoding="utf-8",
    )

    for grade, docx_path in QUIZ_FILES.items():
        questions = build_quiz(grade, docx_path, vocab_by_grade[grade])
        write_js_global(QUIZ_OUTPUTS[grade], QUIZ_GLOBALS[grade], questions)
        print(f"{grade}: {len(vocab_by_grade[grade])} words, {len(questions)} quiz questions")


if __name__ == "__main__":
    main()
