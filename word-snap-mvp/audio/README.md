# Pronunciation audio

The built-in vocabulary uses pre-generated, same-origin MP3 files so playback does
not depend on each device's `speechSynthesis` implementation.

- Model: Kokoro-82M v1.0
- Voice: `af_heart` (American English, female)
- Model license: Apache-2.0
- Runtime: `kokoro-onnx` (MIT)
- Output: mono MP3, 24 kHz source, 48 kbps

The model weights are build-time dependencies and are not shipped to students.
Only the generated pronunciation clips are deployed.
