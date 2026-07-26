#!/usr/bin/env python3
"""Build the 高中3500刷词专栏 stage from the 48 supplied PDF lists."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import pdfplumber


STAGE = "高中3500刷词专栏"
POS_MARKERS = {
    "n.",
    "v.",
    "adj.",
    "adv.",
    "prep.",
    "conj.",
    "pron.",
    "num.",
    "art.",
    "int.",
    "det.",
    "aux.",
    "modal",
}
POS_TOKEN = re.compile(
    r"^(?:n|v|adj|adv|prep|conj|pron|num|art|int|det|aux|modal)"
    r"(?:[./ ]+(?:n|v|adj|adv|prep|conj|pron|num|art|int|det|aux|modal))*\.?$",
    re.IGNORECASE,
)


def numeric_suffix(path: Path) -> int:
    match = re.search(r"(\d+)$", path.stem)
    if not match:
        raise ValueError(f"无法识别 List 编号: {path.name}")
    return int(match.group(1))


def join_tokens(tokens: list[dict]) -> str:
    ordered = tokens_in_reading_order(tokens)
    result = ""
    for token in ordered:
        text = token["text"].strip()
        if not text:
            continue
        if (
            result
            and re.search(r"[A-Za-z0-9)]$", result)
            and re.match(r"^[A-Za-z0-9(/]", text)
        ):
            result += " "
        result += text
    return re.sub(r"\s+", " ", result).strip()


def tokens_in_reading_order(tokens: list[dict]) -> list[dict]:
    # PDF table cells on the same visual line can differ vertically by 1-2 px.
    lines: list[list[dict]] = []
    line_tops: list[float] = []
    for token in sorted(tokens, key=lambda item: (item["top"], item["x0"])):
        if not lines or token["top"] - line_tops[-1] > 4:
            lines.append([token])
            line_tops.append(token["top"])
        else:
            lines[-1].append(token)
    return [
        token
        for line in lines
        for token in sorted(line, key=lambda item: item["x0"])
    ]


def clean_translation(tokens: list[dict]) -> str:
    result = ""
    pending_separator = False
    for token in tokens_in_reading_order(tokens):
        text = token["text"].strip()
        if POS_TOKEN.fullmatch(text):
            pending_separator = bool(result)
            continue
        if not re.search(r"[\u3400-\u9fff]", text):
            continue
        if pending_separator and result and not result.endswith(("；", "，", "。", "、")):
            result += "；"
        result += text
        pending_separator = False
    result = re.sub(r"[A-Za-z]+", "", result)
    result = re.sub(r"[（(]\s*[）)]", "", result)
    return result.strip(" ；")


def clean_pos(tokens: list[dict]) -> str:
    parts: list[str] = []
    for token in tokens_in_reading_order(tokens):
        text = token["text"].strip().lower()
        found = re.findall(
            r"(?:modal|adj|adv|prep|conj|pron|num|art|int|det|aux|n|v)\.",
            text,
        )
        for part in found:
            if part not in parts:
                parts.append(part)
    return "/".join(parts)


def detect_columns(page) -> tuple[float, float, float]:
    tokens = page.extract_words(x_tolerance=2, y_tolerance=3)
    phonetic_header = next(token for token in tokens if token["text"] == "音标")
    pos_header = next(token for token in tokens if token["text"] == "词性")
    translation_header = next(token for token in tokens if token["text"] == "翻译")
    pos_left = (phonetic_header["x0"] + pos_header["x0"]) / 2
    pos_right = (pos_header["x0"] + translation_header["x0"]) / 2
    return phonetic_header["x0"], pos_left, pos_right


def parse_page(
    page,
    list_number: int,
    phonetic_x: float,
    pos_left: float,
    pos_right: float,
    is_first_page: bool,
) -> list[dict]:
    tokens = page.extract_words(
        x_tolerance=2,
        y_tolerance=3,
        keep_blank_chars=False,
        use_text_flow=False,
    )
    anchors = sorted(
        (
            token
            for token in tokens
            if token["text"].isdigit()
            and token["x0"] < phonetic_x
            and (140 if is_first_page else 25) < token["top"] < page.height - 30
            and any(
                token["x0"] + 5 < candidate["x0"] < phonetic_x
                and abs(candidate["top"] - token["top"]) < 4
                and re.search(r"[A-Za-z]", candidate["text"])
                and "/" not in candidate["text"]
                for candidate in tokens
            )
        ),
        key=lambda item: item["top"],
    )
    rows: list[dict] = []
    for index, anchor in enumerate(anchors):
        top = anchor["top"] - 2
        bottom = (
            anchors[index + 1]["top"] - 2
            if index + 1 < len(anchors)
            else page.height - 30
        )
        row_tokens = [
            token
            for token in tokens
            if top <= token["top"] < bottom and token["x0"] < 550
        ]
        word_tokens = [
            token
            for token in row_tokens
            if anchor["x0"] + 5 < token["x0"] < phonetic_x
            and re.search(r"[A-Za-z]", token["text"])
            and "/" not in token["text"]
        ]
        phonetic_tokens = [
            token
            for token in row_tokens
            if token["text"].strip().startswith("/")
            and token["text"].strip().endswith("/")
            and len(token["text"].strip()) > 2
        ]
        pos_tokens = [
            token
            for token in row_tokens
            if pos_left <= token["x0"] < pos_right
            and re.search(
                r"(?:modal|adj|adv|prep|conj|pron|num|art|int|det|aux|n|v)\.",
                token["text"],
                re.IGNORECASE,
            )
        ]

        english = join_tokens(word_tokens)
        translation = clean_translation(row_tokens)
        if not english or not translation:
            raise ValueError(
                f"List {list_number} 第 {anchor['text']} 词解析失败: "
                f"en={english!r}, zh={translation!r}"
            )

        phonetic = " ".join(
            token["text"].strip()
            for token in tokens_in_reading_order(phonetic_tokens)
        )
        rows.append(
            {
                "number": int(anchor["text"]),
                "en": english,
                "zh": translation,
                "pos": clean_pos(pos_tokens),
                "notes": f"List {list_number}" + (f" · {phonetic}" if phonetic else ""),
                "frequency": 0,
            }
        )
    return rows


def parse_pdf(path: Path) -> list[dict]:
    list_number = numeric_suffix(path)
    words: list[dict] = []
    with pdfplumber.open(path) as pdf:
        phonetic_x, pos_left, pos_right = detect_columns(pdf.pages[0])
        for page_index, page in enumerate(pdf.pages):
            words.extend(
                parse_page(
                    page,
                    list_number,
                    phonetic_x,
                    pos_left,
                    pos_right,
                    is_first_page=page_index == 0,
                )
            )
    numbers = [word.pop("number") for word in words]
    expected = list(range(1, len(words) + 1))
    if numbers != expected:
        missing = sorted(set(range(1, max(numbers, default=0) + 1)) - set(numbers))
        raise ValueError(
            f"{path.name} 序号不连续: "
            f"缺少 {missing}，实际 {numbers[:5]}...{numbers[-5:] if numbers else []}"
        )
    return words


def build_stage(pdf_dir: Path) -> dict:
    pdfs = sorted(pdf_dir.glob("List *.pdf"), key=numeric_suffix)
    if [numeric_suffix(path) for path in pdfs] != list(range(1, 49)):
        raise ValueError("必须完整提供 List 1.pdf 至 List 48.pdf")

    words: list[dict] = []
    counts: list[int] = []
    for path in pdfs:
        parsed = parse_pdf(path)
        words.extend(parsed)
        counts.append(len(parsed))

    # “高中3500”是资料专栏名；48 份原表实际共有 3515 条，全部保留。
    if len(words) != 3515:
        raise ValueError(f"48 份原表应解析到 3515 条，实际为 {len(words)}")

    return {
        "grade": STAGE,
        "goals": [STAGE],
        "source": "Wing English Summer Bootcamp 高中3500词（List 1-48，原表3515条）",
        "listCounts": counts,
        "words": words,
    }


def write_stage(stage: dict, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(stage, ensure_ascii=False, indent=2)
    target.write_text(
        "window.WORD_SNAP_STAGE_LISTS = window.WORD_SNAP_STAGE_LISTS || {};\n"
        f"window.WORD_SNAP_STAGE_LISTS[{json.dumps(STAGE, ensure_ascii=False)}] = "
        f"{payload};\n",
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf_dir", type=Path)
    parser.add_argument("targets", nargs="+", type=Path)
    args = parser.parse_args()

    stage = build_stage(args.pdf_dir)
    for target in args.targets:
        write_stage(stage, target)

    unique = len({word["en"].casefold() for word in stage["words"]})
    print(
        f"已生成 {len(stage['words'])} 条词汇，"
        f"{unique} 个不重复英文词，写入 {len(args.targets)} 个目标文件。"
    )


if __name__ == "__main__":
    main()
