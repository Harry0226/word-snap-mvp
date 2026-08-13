# Pronunciation audio

The built-in vocabulary uses pre-generated, same-origin MP3 files so playback does
not depend on each device's `speechSynthesis` implementation.

- Service: Microsoft Edge neural text-to-speech (build time only)
- Voice: `en-GB-SoniaNeural` (British English, female)
- Pronunciation language: `en-gb`, matching the British-English standard used by
  the Oxford Yilin school materials
- Generator: `edge-tts` (LGPL-3.0)
- Output: static mono MP3

Only the generated pronunciation clips are deployed. Terms are synthesized without
sentence punctuation so short-word audio does not gain a stray sentence-start sound.
