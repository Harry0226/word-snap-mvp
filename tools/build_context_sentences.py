"""Build short, student-friendly context sentences into every stage word row.

Sources are local build-time copies of the Tatoeba English export and the
OPUS Tatoeba Mandarin-English parallel export. The corpus files are never
shipped to the website. See docs/word-data/CONTEXT_SENTENCES_LICENSE.md.
"""

from __future__ import annotations

import argparse
import bz2
import heapq
import json
import os
import re
import zipfile
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path


WORD_RE = re.compile(r"[A-Za-z]+(?:['’-][A-Za-z]+)*|\d+")
CHINESE_RE = re.compile(r"[\u3400-\u9fff]")
SENSE_SPLIT_RE = re.compile(r"[,，;；/、]|\s{2,}")
UNSAFE_RE = re.compile(
    r"\b(?:suicide|murder|rape|porn|naked|nude|sex|sexy|cocaine|heroin|"
    r"meth|drunk|gun|rifle|pistol|stabbed|killed|kill|dead|death|whore|"
    r"prostitute|slut|fuck|fucking|shit|condom|penis|vagina)\b",
    re.IGNORECASE,
)
META_RE = re.compile(r"\b(?:used to mean|means? the same as|the word)\b", re.IGNORECASE)
COMMON_NAMES_RE = re.compile(r"\b(?:Tom|Mary|John|Bob|Mike|Susan|Linda|Muiriel)\b")
COMMON_WORDS = set(
    """
    a about after again all also always am an and any are around as at away
    back be because been before being between both but by can cannot could
    day did do does doing down each even every few first for from get gets
    give go goes good got had has have he her here him his how i if in into
    is it its just know last like little long look made make many may me
    might more most much must my need never new next no not now of off often
    old on once one only or other our out over people please really right
    said same say see she should since so some still such take than that the
    their them then there these they thing think this those through time to
    too two under up us use very want was way we well were what when where
    which while who why will with work would year yes you your
    """.split()
)

CHINESE_CUES = {
    "品牌": {"brand", "product", "company", "store", "shop", "popular", "buy"},
    "商标": {"brand", "product", "company", "mark", "logo"},
    "乐队": {"music", "song", "concert", "band", "play"},
    "饲料": {"animal", "farm", "chicken", "cow", "horse", "feed"},
    "喂": {"animal", "dog", "cat", "baby", "feed", "food"},
    "银行": {"bank", "money", "account", "cash", "loan"},
    "河岸": {"river", "water", "bank", "boat"},
    "学校": {"school", "class", "teacher", "student", "lesson"},
    "老师": {"teacher", "class", "student", "lesson"},
    "学生": {"student", "school", "class", "learn"},
    "考试": {"exam", "test", "answer", "question", "study"},
    "学习": {"learn", "study", "class", "lesson", "school"},
    "食物": {"food", "eat", "meal", "cook", "kitchen"},
    "水果": {"fruit", "eat", "fresh", "market"},
    "动物": {"animal", "zoo", "farm", "wild"},
    "植物": {"plant", "grow", "garden", "green"},
    "疾病": {"doctor", "hospital", "sick", "health"},
    "健康": {"health", "healthy", "exercise", "doctor"},
    "高兴": {"happy", "smile", "glad", "joy"},
    "悲伤": {"sad", "cry", "unhappy"},
    "生气": {"angry", "mad", "calm"},
    "害怕": {"afraid", "fear", "scared", "danger"},
    "交通": {"road", "bus", "train", "car", "travel"},
    "汽车": {"car", "drive", "road", "vehicle"},
    "火车": {"train", "station", "rail"},
    "飞机": {"plane", "airport", "fly"},
    "电脑": {"computer", "screen", "file", "online"},
    "网络": {"internet", "online", "website", "computer"},
    "手机": {"phone", "call", "message", "mobile"},
    "工作": {"work", "job", "office", "team"},
    "商业": {"business", "company", "market", "customer"},
    "公司": {"company", "office", "business", "staff"},
    "自然": {"nature", "forest", "river", "mountain"},
    "天气": {"weather", "rain", "sunny", "wind"},
    "时间": {"time", "hour", "minute", "late", "early"},
    "家庭": {"family", "home", "parent", "child"},
    "朋友": {"friend", "together", "help", "meet"},
    "运动": {"sport", "game", "team", "play", "exercise"},
    "音乐": {"music", "song", "listen", "play"},
    "电影": {"film", "movie", "watch", "cinema"},
    "书": {"book", "read", "page", "story"},
    "写": {"write", "paper", "letter", "answer"},
    "读": {"read", "book", "story", "text"},
    "说": {"say", "speak", "talk", "tell"},
}

CONTEXT_OVERRIDES = {
    "adj": "Words such as “kind” and “helpful” are adjectives.",
    "as as": "My sister is as tall as my mother.",
    "as as possible": "Please finish the work as soon as possible.",
    "ashame": "His rude joke seemed to ashame everyone at the table.",
    "audiology": "She studies audiology to help people with hearing problems.",
    "be connected with": "Good sleep is closely connected with better learning.",
    "be diagnosed with": "He was diagnosed with the flu and stayed home.",
    "be down to": "The team's success may be down to careful practice.",
    "be in low spirits": "She was in low spirits after losing the match.",
    "be meant to do": "This button is meant to open the main menu.",
    "brainpower": "Solving puzzles can improve your brainpower.",
    "break with something": "The artist chose to break with tradition.",
    "brushwork": "The painter's light brushwork makes the clouds look soft.",
    "catch eye": "Bright colors often catch my eye.",
    "chinese chess": "My grandfather taught me to play Chinese chess.",
    "close-fitting": "He wore a close-fitting shirt under his jacket.",
    "come as no surprise": "Her excellent result came as no surprise to us.",
    "come between and": "A small argument should not come between good friends.",
    "confucianism": "Confucianism has influenced Chinese culture for centuries.",
    "corgi": "The short-legged corgi waited beside the door.",
    "cry out for": "The old classroom is crying out for new desks.",
    "dead": "The battery is dead, so the clock has stopped.",
    "death": "The story follows a family dealing with the death of a loved one.",
    "divide into": "Please divide the cake into eight equal pieces.",
    "dur": "The musician played a bright melody in C dur.",
    "enjoy oneself": "Everyone can enjoy oneself through music and games.",
    "expect something of": "Good teachers expect careful work of every student.",
    "frights": "The strange noises gave the children a few frights.",
    "get down to doing something": "After lunch, we got down to doing our homework.",
    "get down to something": "After lunch, we got down to our homework.",
    "go about something": "She showed us how to go about solving the problem.",
    "gramme": "The baby bird weighs less than one hundred grammes.",
    "hang over": "Dark clouds hung over the town all afternoon.",
    "in full measure": "The team deserved its success in full measure.",
    "in own right": "She is a respected scientist in her own right.",
    "in the short long term": "The plan may cost more in the short term.",
    "keep in good order": "We keep our books in good order on the shelf.",
    "keep in order": "We keep our books in order on the shelf.",
    "kill": "Too much heat can kill young plants.",
    "let something loose": "Do not let the dog loose near the busy road.",
    "murder": "The detective novel begins with a mysterious murder.",
    "neither nor": "Neither Jack nor Amy was late for class.",
    "not only but also": "She is not only clever but also very patient.",
    "paper-cutting": "We made red paper-cutting decorations for the festival.",
    "pass on to": "Please pass this message on to your teacher.",
    "pass something on to": "Please pass this message on to your teacher.",
    "practic": "The practic part of the course takes place in a workshop.",
    "rob of": "The injury robbed him of the chance to compete.",
    "rob of something": "The injury robbed him of a chance to compete.",
    "rocketed": "Food prices rocketed after the storm.",
    "round-the-clock": "The hospital provides round-the-clock care.",
    "scissor": "Use the scissor carefully when cutting the paper.",
    "see eye to eye with on": "I do not always see eye to eye with my brother.",
    "set something aside": "She sets some money aside for books each month.",
    "sex": "The form asks for your age and sex.",
    "shoot up": "The young bamboo began to shoot up after the rain.",
    "speak volumes about": "Her calm reply speaks volumes about her confidence.",
    "stand in s way": "Do not let fear stand in your way.",
    "take apart": "We took the old clock apart to see how it worked.",
    "throw oneself into": "She threw herself into the new school project.",
    "tie-dye": "We learned to make a tie-dye T-shirt in art class.",
    "whiteboards": "The teacher wrote the new words on two whiteboards.",
    "yuan": "The notebook costs twenty yuan.",
    "yours sincerely": "She ended the formal letter with “Yours sincerely.”",
}

CONTEXT_SENSE_OVERRIDES = {
    ("feed", "饲料"): "The farmer bought fresh feed for the chickens.",
    ("run", "跑"): "The children run around the playground after class.",
    ("feel", "感觉"): "I feel nervous before an important exam.",
    ("harder", "困难"): "The second question was harder than the first.",
    ("pleasant", "愉快"): "We had a pleasant walk in the park.",
    ("multiple", "多"): "The project offers multiple ways to solve the problem.",
    ("outstanding", "杰出"): "She won an award for her outstanding schoolwork.",
    ("experiencing", "经历"): "Many students are experiencing the same problem.",
    ("than", "比"): "This book is easier to read than that one.",
    ("vote", "投票"): "Every student can vote for the class monitor.",
    ("environment", "环境"): "We should protect the environment by using less plastic.",
    ("consequence", "后果"): "Missing the bus was a consequence of leaving home late.",
    ("future", "未来"): "We need to prepare for the future.",
    ("aggressive", "好斗"): "The dog became aggressive when a stranger came near.",
    ("invention", "发明"): "The new invention helps people save water.",
}


@dataclass(frozen=True)
class WordRow:
    file: Path
    index: int
    en: str
    zh: str
    pos: str
    grade: str
    notes: str

    @property
    def key(self) -> tuple[str, str]:
        return normalize_term(self.en), normalize_zh(self.zh)

    @property
    def context_term(self) -> str:
        return clean_context_term(self.en)


@dataclass(frozen=True)
class Candidate:
    sentence: str
    tokens: tuple[str, ...]
    base_score: float
    translation: str = ""
    sentence_id: str = ""


def normalize_term(value: str) -> str:
    return " ".join(token.lower().replace("’", "'") for token in WORD_RE.findall(value))


def clean_context_term(value: str) -> str:
    original = normalize_term(value)
    if original in {"something", "somebody", "oneself"}:
        return original
    cleaned = re.sub(
        r"\s+(?:(?:n|v|adj|adv|prep|conj|pron|num|int)\.)?All Rights Reserved\..*$",
        "",
        value,
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(r"\s+copyright.*$", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(
        r"\s+(?:n|v|adj|adv|prep|conj|pron|num|int)\.$",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(r"\s*\([^)]*\)", "", cleaned, flags=re.IGNORECASE)
    cleaned = cleaned.replace("...", " ")
    cleaned = re.sub(r"\bsome thing\b", "something", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\bone's\b", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\bsb's\b", "s", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\b(?:sth|sb|somebody)\b", "", cleaned, flags=re.IGNORECASE)
    cleaned = cleaned.replace("/", " ")
    return normalize_term(cleaned)


def normalize_zh(value: str) -> str:
    return "".join(CHINESE_RE.findall(value))


def sentence_tokens(value: str) -> tuple[str, ...]:
    return tuple(token.lower().replace("’", "'") for token in WORD_RE.findall(value))


def contains_tokens(tokens: tuple[str, ...], target: tuple[str, ...]) -> bool:
    if not target or len(target) > len(tokens):
        return False
    width = len(target)
    return any(tokens[index : index + width] == target for index in range(len(tokens) - width + 1))


def load_manifest_files(manifest_file: Path) -> set[str]:
    text = manifest_file.read_text(encoding="utf-8")
    payload = json.loads(text[text.find("{") :].rstrip().removesuffix(";"))
    return {
        Path(str(entry["src"])).name
        for entry in (payload.get("stages") or {}).values()
        if entry.get("src")
    }


def load_stage_rows(stage_root: Path, included_files: set[str]) -> tuple[list[WordRow], dict[Path, dict]]:
    rows: list[WordRow] = []
    payloads: dict[Path, dict] = {}
    for file in sorted(stage_root.glob("*.js")):
        if file.name not in included_files:
            continue
        text = file.read_text(encoding="utf-8")
        start = text.find("{", text.find("\n"))
        payload = json.loads(text[start:].rstrip().removesuffix(";"))
        payloads[file] = payload
        grade = str(payload.get("grade") or "")
        for index, word in enumerate(payload.get("words") or []):
            en = str(word.get("en") or "").strip()
            zh = str(word.get("zh") or "").strip()
            if not en or not zh:
                continue
            rows.append(
                WordRow(
                    file=file,
                    index=index,
                    en=en,
                    zh=zh,
                    pos=str(word.get("pos") or ""),
                    grade=grade,
                    notes=str(word.get("notes") or ""),
                )
            )
    return rows, payloads


def base_sentence_score(sentence: str, tokens: tuple[str, ...]) -> float:
    length = len(tokens)
    score = 100 - abs(length - 8) * 4
    if 6 <= length <= 11:
        score += 8
    if sentence.endswith((".", "!", "?")):
        score += 3
    if COMMON_NAMES_RE.search(sentence):
        score -= 18
    if any(char.isdigit() for char in sentence):
        score -= 8
    if sentence.count('"') + sentence.count("“") + sentence.count("”") > 2:
        score -= 5
    if sentence.endswith("?"):
        score -= 2
    return score


def valid_sentence(sentence: str) -> tuple[str, tuple[str, ...]] | None:
    cleaned = re.sub(r"\s+", " ", sentence).strip()
    tokens = sentence_tokens(cleaned)
    if not 4 <= len(tokens) <= 16:
        return None
    if not 14 <= len(cleaned) <= 112:
        return None
    if UNSAFE_RE.search(cleaned) or META_RE.search(cleaned):
        return None
    if "..." in cleaned or ".." in cleaned or "http" in cleaned.lower():
        return None
    if not re.search(r"[.!?]$", cleaned):
        cleaned += "."
    return cleaned, tokens


def target_index(terms: set[str]) -> dict[str, list[tuple[tuple[str, ...], str]]]:
    by_first: dict[str, list[tuple[tuple[str, ...], str]]] = defaultdict(list)
    for term in terms:
        tokens = tuple(term.split())
        if tokens:
            by_first[tokens[0]].append((tokens, term))
    for entries in by_first.values():
        entries.sort(key=lambda item: len(item[0]), reverse=True)
    return by_first


def matched_terms(tokens: tuple[str, ...], by_first: dict[str, list[tuple[tuple[str, ...], str]]]):
    found: set[str] = set()
    for index, token in enumerate(tokens):
        for target_tokens, term in by_first.get(token, ()):
            if term not in found and tokens[index : index + len(target_tokens)] == target_tokens:
                found.add(term)
                yield term


def push_candidate(
    heaps: dict[str, list[tuple[float, int, Candidate]]],
    term: str,
    candidate: Candidate,
    serial: int,
    limit: int = 24,
) -> None:
    heap = heaps[term]
    item = (candidate.base_score, serial, candidate)
    if len(heap) < limit:
        heapq.heappush(heap, item)
    elif item[:2] > heap[0][:2]:
        heapq.heapreplace(heap, item)


def collect_parallel_candidates(
    opus_zip: Path,
    by_first: dict[str, list[tuple[tuple[str, ...], str]]],
    heaps: dict[str, list[tuple[float, int, Candidate]]],
    serial: int,
) -> int:
    with zipfile.ZipFile(opus_zip) as archive:
        english_name = next(name for name in archive.namelist() if name.endswith(".en"))
        chinese_name = next(name for name in archive.namelist() if name.endswith(".cmn"))
        with archive.open(english_name) as english, archive.open(chinese_name) as chinese:
            for english_line, chinese_line in zip(english, chinese):
                valid = valid_sentence(english_line.decode("utf-8"))
                if not valid:
                    continue
                sentence, tokens = valid
                translation = chinese_line.decode("utf-8").strip()
                base = base_sentence_score(sentence, tokens) + 6
                for term in matched_terms(tokens, by_first):
                    serial += 1
                    push_candidate(
                        heaps,
                        term,
                        Candidate(sentence, tokens, base, translation=translation),
                        serial,
                    )
    return serial


def collect_english_candidates(
    english_bz2: Path,
    by_first: dict[str, list[tuple[tuple[str, ...], str]]],
    heaps: dict[str, list[tuple[float, int, Candidate]]],
    serial: int,
) -> int:
    with bz2.open(english_bz2, "rt", encoding="utf-8") as corpus:
        for line in corpus:
            parts = line.rstrip("\n").split("\t", 2)
            if len(parts) != 3:
                continue
            sentence_id, language, raw_sentence = parts
            if language != "eng":
                continue
            valid = valid_sentence(raw_sentence)
            if not valid:
                continue
            sentence, tokens = valid
            base = base_sentence_score(sentence, tokens)
            for term in matched_terms(tokens, by_first):
                serial += 1
                push_candidate(
                    heaps,
                    term,
                    Candidate(sentence, tokens, base, sentence_id=sentence_id),
                    serial,
                )
    return serial


def chinese_senses(value: str) -> list[str]:
    senses = []
    for part in SENSE_SPLIT_RE.split(value):
        cleaned = re.sub(r"[（(][^）)]*[）)]", "", part)
        cleaned = normalize_zh(cleaned)
        if len(cleaned) >= 2:
            senses.append(cleaned)
    return senses


def translation_score(row: WordRow, candidate: Candidate) -> float:
    if not candidate.translation:
        return 0
    translation = normalize_zh(candidate.translation)
    score = 0.0
    for sense in chinese_senses(row.zh):
        if sense in translation:
            score = max(score, 90 + min(20, len(sense) * 3))
        chars = set(sense)
        if chars:
            score = max(score, len(chars & set(translation)) / len(chars) * 34)
        bigrams = {sense[index : index + 2] for index in range(len(sense) - 1)}
        if bigrams:
            overlap = sum(1 for bigram in bigrams if bigram in translation)
            score = max(score, overlap / len(bigrams) * 48)
    return score


def cue_score(row: WordRow, candidate: Candidate) -> float:
    sentence_words = set(candidate.tokens)
    best = 0
    for chinese, cues in CHINESE_CUES.items():
        if chinese in row.zh:
            best = max(best, len(sentence_words & cues) * 11)
    return best


def build_known_words(rows: list[WordRow]) -> tuple[set[str], set[str]]:
    junior = set(COMMON_WORDS)
    senior = set(COMMON_WORDS)
    for row in rows:
        tokens = set(row.context_term.split())
        senior.update(tokens)
        if "初" in row.grade:
            junior.update(tokens)
    senior.update(junior)
    return junior, senior


def readability_score(
    row: WordRow,
    candidate: Candidate,
    junior_words: set[str],
    senior_words: set[str],
) -> float:
    known = junior_words if "初" in row.grade else senior_words
    target_words = set(row.context_term.split())
    unknown = []
    for token in candidate.tokens:
        plain = token.strip("'")
        if plain in target_words or plain in known or len(plain) <= 3:
            continue
        if plain.endswith("s") and plain[:-1] in known:
            continue
        if plain.endswith("ed") and plain[:-2] in known:
            continue
        if plain.endswith("ing") and plain[:-3] in known:
            continue
        unknown.append(plain)
    penalty = len(set(unknown)) * (5 if "初" in row.grade else 2.5)
    long_word_penalty = sum(max(0, len(token) - 10) for token in candidate.tokens) * 0.8
    return -(penalty + long_word_penalty)


def position_score(row: WordRow, candidate: Candidate) -> float:
    term_tokens = tuple(row.context_term.split())
    tokens = candidate.tokens
    starts = [
        index
        for index in range(len(tokens) - len(term_tokens) + 1)
        if tokens[index : index + len(term_tokens)] == term_tokens
    ]
    if not starts:
        return -1000
    start = starts[0]
    before = tokens[start - 1] if start > 0 else ""
    pos = row.pos.lower()
    score = 0.0
    if "n." in pos and before in {"a", "an", "the", "this", "that", "my", "your", "our", "their"}:
        score += 10
    if "v." in pos and before in {"to", "can", "could", "will", "would", "should", "must", "may"}:
        score += 10
    if "adj." in pos and before in {"is", "are", "was", "were", "be", "very", "so", "too"}:
        score += 8
    if "adv." in pos and start > 0:
        score += 4
    return score


def notes_sentence(row: WordRow) -> str:
    for match in re.findall(r"[A-Z][^.!?]{8,100}[.!?]", row.notes):
        valid = valid_sentence(match)
        if not valid:
            continue
        sentence, tokens = valid
        if contains_tokens(tokens, tuple(row.context_term.split())):
            return sentence
    return ""


def fallback_sentence(row: WordRow) -> str:
    term = row.en.strip()
    normalized = row.context_term
    term = normalized or term
    pos = row.pos.lower()
    if " " in normalized:
        if normalized.startswith(("look ", "listen ", "wait ", "ask ", "search ")):
            return f"Please {term} before you answer the question."
        if normalized.startswith(("make ", "take ", "have ", "give ", "keep ", "set ")):
            return f"We learned when to {term} during the class activity."
        if normalized.startswith(("go ", "come ", "get ", "turn ", "put ")):
            return f"They decided to {term} after the lesson."
        if normalized.startswith("be "):
            return f"It is not always easy to {term} in a new situation."
        return f"Our group tried to {term} during the class project."
    if "adv." in pos or normalized.endswith("ly"):
        return f"She completed the classroom task {term}."
    if "adj." in pos:
        return f"The students found the new idea {term}."
    if "v." in pos:
        return f"They decided to {term} before the lesson ended."
    if "n." in pos:
        return f"The {term} became part of our classroom discussion."
    if normalized.endswith("ing"):
        return f"They are {term} together after school."
    return f"We noticed the {term} during our class project."


def choose_contexts(
    rows: list[WordRow],
    heaps: dict[str, list[tuple[float, int, Candidate]]],
) -> tuple[dict[tuple[str, str], str], dict[str, int], list[tuple[WordRow, str]]]:
    unique_rows: dict[tuple[str, str], WordRow] = {}
    for row in rows:
        unique_rows.setdefault(row.key, row)
    candidates = {
        term: [item[2] for item in sorted(heap, reverse=True)]
        for term, heap in heaps.items()
    }
    usage: dict[str, int] = defaultdict(int)
    contexts: dict[tuple[str, str], str] = {}
    sources = defaultdict(int)
    fallbacks: list[tuple[WordRow, str]] = []
    junior_words, senior_words = build_known_words(rows)

    ordered_rows = sorted(
        unique_rows.values(),
        key=lambda row: (len(candidates.get(row.context_term, ())), row.context_term),
    )
    for row in ordered_rows:
        sense_override = next(
            (
                sentence
                for (term, chinese), sentence in CONTEXT_SENSE_OVERRIDES.items()
                if term == row.context_term and chinese in row.zh
            ),
            "",
        )
        if sense_override:
            contexts[row.key] = sense_override
            usage[sense_override] += 1
            sources["curated-sense"] += 1
            continue
        override = CONTEXT_OVERRIDES.get(row.context_term)
        if override:
            contexts[row.key] = override
            usage[override] += 1
            sources["curated"] += 1
            continue
        note = notes_sentence(row)
        if note:
            contexts[row.key] = note
            usage[note] += 1
            sources["notes"] += 1
            continue
        ranked = []
        for candidate in candidates.get(row.context_term, ()):
            score = (
                candidate.base_score
                + translation_score(row, candidate)
                + cue_score(row, candidate)
                + position_score(row, candidate)
                + readability_score(row, candidate, junior_words, senior_words)
                - usage[candidate.sentence] * 26
            )
            ranked.append((score, candidate))
        ranked.sort(key=lambda item: item[0], reverse=True)
        selected = next(
            (candidate for _, candidate in ranked if usage[candidate.sentence] < 3),
            ranked[0][1] if ranked else None,
        )
        if selected:
            contexts[row.key] = selected.sentence
            usage[selected.sentence] += 1
            sources["parallel" if selected.translation else "english"] += 1
        else:
            fallback = fallback_sentence(row)
            contexts[row.key] = fallback
            usage[fallback] += 1
            sources["fallback"] += 1
            fallbacks.append((row, fallback))
    return contexts, dict(sources), fallbacks


def write_stages(payloads: dict[Path, dict], rows: list[WordRow], contexts: dict[tuple[str, str], str]) -> None:
    rows_by_file: dict[Path, list[WordRow]] = defaultdict(list)
    for row in rows:
        rows_by_file[row.file].append(row)
    for file, payload in payloads.items():
        for row in rows_by_file[file]:
            payload["words"][row.index]["contextSentence"] = contexts[row.key]
        assignment = f'window.WORD_SNAP_STAGE_LISTS[{json.dumps(payload["grade"], ensure_ascii=False)}] = '
        content = (
            "window.WORD_SNAP_STAGE_LISTS = window.WORD_SNAP_STAGE_LISTS || {};\n"
            + assignment
            + json.dumps(payload, ensure_ascii=False, indent=2, separators=(",", ": "))
            + ";\n"
        )
        file.write_text(content, encoding="utf-8", newline="\n")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--stage-root", type=Path, default=Path("docs/word-data/stages"))
    parser.add_argument("--manifest", type=Path, default=Path("docs/word-data/builtin-manifest.js"))
    parser.add_argument(
        "--english-corpus",
        type=Path,
        default=Path(os.environ.get("TEMP", ".")) / "word-snap-context-corpus" / "eng_sentences.tsv.bz2",
    )
    parser.add_argument(
        "--parallel-corpus",
        type=Path,
        default=Path(os.environ.get("TEMP", ".")) / "word-snap-context-corpus" / "cmn-en.txt.zip",
    )
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--fallback-report", type=Path)
    args = parser.parse_args()

    rows, payloads = load_stage_rows(args.stage_root, load_manifest_files(args.manifest))
    terms = {row.context_term for row in rows if row.context_term}
    by_first = target_index(terms)
    heaps: dict[str, list[tuple[float, int, Candidate]]] = defaultdict(list)
    serial = collect_parallel_candidates(args.parallel_corpus, by_first, heaps, 0)
    collect_english_candidates(args.english_corpus, by_first, heaps, serial)
    contexts, sources, fallbacks = choose_contexts(rows, heaps)

    if args.fallback_report:
        report = [
            {
                "en": row.en,
                "zh": row.zh,
                "pos": row.pos,
                "grade": row.grade,
                "sentence": sentence,
            }
            for row, sentence in fallbacks
        ]
        args.fallback_report.write_text(
            json.dumps(report, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    if args.write:
        write_stages(payloads, rows, contexts)

    print(
        json.dumps(
            {
                "stageFiles": len(payloads),
                "rows": len(rows),
                "uniqueContexts": len(contexts),
                "termsWithCandidates": sum(1 for term in terms if heaps.get(term)),
                "uniqueTerms": len(terms),
                "sources": sources,
                "fallbacks": len(fallbacks),
                "wroteFiles": bool(args.write),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
