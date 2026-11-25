import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))

from grade7_quiz_builder import (
    build_options,
    clean_sentence_for_single_blank,
    extract_answer_tokens,
    find_target_numbers,
    load_reference_vocab,
    looks_like_answer_line,
)


class Grade7QuizBuilderTests(unittest.TestCase):
    def test_extract_answer_tokens_handles_compact_numbered_line(self):
        text = "1.fur 2.fight 3.sticks 4.alone 5.sound6.goldfish/goldfishes 7.mice"
        self.assertEqual(
            extract_answer_tokens(text),
            [
                "fur",
                "fight",
                "sticks",
                "alone",
                "sound",
                "goldfish/goldfishes",
                "mice",
            ],
        )

    def test_clean_sentence_for_single_blank_replaces_one_numbered_prompt(self):
        text = "Winter is a good time for 1 (滑冰). Liu becomes famous because of her great 2 (技巧)."
        self.assertEqual(
            clean_sentence_for_single_blank(text, target_number=2, answers={1: "skating", 2: "skills"}),
            "Liu becomes famous because of her great ________.",
        )

    def test_clean_sentence_for_single_blank_replaces_independent_parentheses(self):
        text = "1.Polar bears have (软毛) to keep them warm in winter."
        self.assertEqual(
            clean_sentence_for_single_blank(text, target_number=1, answers={1: "fur"}),
            "Polar bears have ________ to keep them warm in winter.",
        )

    def test_build_options_returns_five_unique_choices_with_answer_first_letter_pool(self):
        options = build_options(
            "practises",
            answer_pool=["practice", "practised", "practising", "produces", "protects", "fur"],
            word_bank=[],
            seed="g7-test",
        )
        self.assertEqual(len(options), 5)
        self.assertEqual(len(set(option.lower() for option in options)), 5)
        self.assertIn("practises", options)
        self.assertGreaterEqual(len([option for option in options if option[0].lower() == "p"]), 4)

    def test_answer_line_can_contain_are(self):
        self.assertTrue(
            looks_like_answer_line(
                "1.owners 2.writers 3.really 4.cleverest 5.going6.useful 7.named "
                "8.noisy 9.are bubbling10.weight 11.paths 12.cloudy 13.natural 14.to go 15.are"
            )
        )

    def test_standalone_blank_numbers_ignore_comma_numbers(self):
        text = "There are more than 2,000 people. After school, I 4 go out to run. I will keep 5 ."
        self.assertEqual(find_target_numbers(text, "方框选词"), [4, 5])

    def test_load_reference_vocab_reads_english_entries(self):
        fixture = ROOT / "tests" / "_tmp_grade7_vocab.txt"
        fixture.write_text("Unit 1\nfirework 烟火，烟花\nmobile home 活动住房\n", encoding="utf-8")
        try:
            self.assertEqual(load_reference_vocab([fixture]), ["firework", "mobile home"])
        finally:
            fixture.unlink(missing_ok=True)


if __name__ == "__main__":
    unittest.main()
