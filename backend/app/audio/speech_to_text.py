from faster_whisper import WhisperModel
from app.audio.voice_recorder import record_until_silence

# Load Whisper model (downloads only the first time)
model = WhisperModel(
    "small",
    device="cpu",
    compute_type="int8"
)

def listen():

    # Record audio until user stops speaking
    audio_file = record_until_silence()

    print("[STT] Converting speech to text...")

    segments, info = model.transcribe(
    audio_file,
    language="en",
    beam_size=5,
    vad_filter=True,
    vad_parameters=dict(min_silence_duration_ms=500)
)

    text = ""

    for segment in segments:
        text += segment.text

    text = text.strip()
    text = text.replace(".", "")
    text = text.replace("?", "")
    text = text.replace(",", "")

    print("You said:", text)

    return text


if __name__ == "__main__":
    listen()