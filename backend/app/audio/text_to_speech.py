import pyttsx3

def speak(text):
    engine = pyttsx3.init()

    engine.setProperty("rate", 170)

    engine.say(text)

    engine.runAndWait()

    engine.stop()

if __name__ == "__main__":
    speak("Hello! Welcome to AI Interview.")