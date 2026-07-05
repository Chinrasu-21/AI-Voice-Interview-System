import sounddevice as sd
import soundfile as sf
import numpy as np

from app.audio.config import *

def record_until_silence():
    # Calculate pre-buffer size (approx 0.6 seconds of history)
    max_pre_buffer_chunks = int(0.6 * SAMPLE_RATE / CHUNK_SIZE)
    if max_pre_buffer_chunks < 2:
        max_pre_buffer_chunks = 2

    # Open the input stream
    with sd.InputStream(
        samplerate=SAMPLE_RATE,
        channels=CHANNELS,
        dtype="float32",
        blocksize=CHUNK_SIZE
    ) as stream:
        print("[Mic] Calibrating background noise floor...")
        # Read 15 chunks (approx 1 second) to allow the driver and gain control to stabilize
        calibration_chunks = []
        for _ in range(15):
            chunk, _ = stream.read(CHUNK_SIZE)
            calibration_chunks.append(chunk)

        # Discard first 8 chunks of driver warmup/transition noise
        stable_chunks = calibration_chunks[8:]
        noise_floor = np.mean([np.max(np.abs(c)) for c in stable_chunks])
        # fallback to avoid zero division/issues
        noise_floor = max(noise_floor, 0.001)

        # Calculate dynamic thresholds based on the stable noise floor
        dynamic_start = max(START_THRESHOLD, noise_floor + 0.01)
        dynamic_stop = max(STOP_THRESHOLD, noise_floor + 0.003)

        print(f"[Mic] Noise floor: {noise_floor:.4f} | Dynamic Thresholds: Start={dynamic_start:.4f}, Stop={dynamic_stop:.4f}")
        print("[Mic] Waiting for your voice...")

        recording = []
        pre_buffer = []
        started = False
        silence_duration = 0.0

        while True:
            # Read block synchronously
            audio_chunk, overflowed = stream.read(CHUNK_SIZE)
            
            # Check maximum amplitude in this chunk
            volume = np.max(np.abs(audio_chunk))

            if not started:
                # Store pre-buffer chunks to prevent cutting off the start of the audio
                pre_buffer.append(audio_chunk)
                if len(pre_buffer) > max_pre_buffer_chunks:
                    pre_buffer.pop(0)

                # Check if volume exceeds start threshold
                if volume > dynamic_start:
                    print("[Record] Voice detected. Recording...")
                    started = True
                    # Initialize recording with the pre-buffered chunks
                    recording.extend(pre_buffer)
                continue

            # If started, save the chunk
            recording.append(audio_chunk)

            # Detect silence
            if volume < dynamic_stop:
                silence_duration += CHUNK_SIZE / SAMPLE_RATE
            else:
                silence_duration = 0.0

            # Stop after specified silence duration
            if silence_duration >= SILENCE_DURATION:
                break

    if recording:
        audio_data = np.concatenate(recording, axis=0)
        # Normalize peak amplitude to 0.5 to optimize audio level for STT models
        peak = np.max(np.abs(audio_data))
        if peak > 0:
            audio_data = (audio_data / peak) * 0.5
    else:
        # Fallback to prevent crash if no audio was captured
        audio_data = np.zeros((0, CHANNELS), dtype="float32")

    sf.write(
        OUTPUT_FILE,
        audio_data,
        SAMPLE_RATE
    )

    print("[Record] Recording Finished")
    return OUTPUT_FILE


if __name__ == "__main__":
    record_until_silence()