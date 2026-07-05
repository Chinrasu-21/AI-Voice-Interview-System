from faster_whisper import WhisperModel

model = WhisperModel(
    "small",
    device="cpu",
    compute_type="int8"
)

segments, info = model.transcribe(
    "test.wav",
    language="en",
    beam_size=5
)

for segment in segments:
    print(segment.text)