import os
import base64
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from google import genai

# Load environment variables from .env
dotenv_path = os.path.join(os.path.dirname(__file__), "..", ".env")
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path=dotenv_path)
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
MURF_API_KEY = os.getenv("MURF_API_KEY", "")

app = Flask(__name__)
CORS(app)  # Allow cross-origin requests from the frontend

# Gemini client is initialised lazily on first request so the server can
# start without a key and return a clean error message instead of crashing.
_gemini_client = None

GEMINI_MODEL = "gemini-3.1-flash-lite"
MURF_STREAM_URL = "https://global.api.murf.ai/v1/speech/stream"


def get_gemini_client():
    """Return (or lazily create) the Gemini client. Returns None if no key set."""
    global _gemini_client
    if _gemini_client is None:
        if not GEMINI_API_KEY:
            return None
        _gemini_client = genai.Client(api_key=GEMINI_API_KEY)
    return _gemini_client


def build_prompt(place, answer_type, language):
    """Return a tailored prompt based on the requested detail level."""
    if answer_type == "Summary":
        return (
            "Act as a professional tourist guide. "
            "Give a high-level overview of " + place + " in the " + language + " language, "
            "covering its historical significance, why it is famous, and key "
            "architectural or cultural highlights. "
            "Keep it concise and engaging, approximately 200 words, "
            "with no excessive dates. "
            "Respond ONLY in " + language + "."
        )
    else:
        return (
            "Act as a professional tourist guide. "
            "Give an immersive, storytelling explanation of " + place + " in the " + language + " language, "
            "covering: historical background and timeline, "
            "architectural design and unique features, "
            "cultural importance and notable events, "
            "and interesting facts and visitor insights. "
            "Aim for approximately 400 words. "
            "Respond ONLY in " + language + "."
        )


@app.route("/generate-audio-guide", methods=["POST"])
def generate_audio_guide():
    data = request.get_json(silent=True)

    # --- Validate required fields ---
    if not data:
        return jsonify({"error": "Request body must be valid JSON."}), 400

    required_fields = ["place", "answerType", "language", "voiceId", "locale"]
    missing = [f for f in required_fields if not data.get(f)]
    if missing:
        return jsonify({"error": "Missing required fields: " + ", ".join(missing)}), 400

    place = data["place"].strip()
    answer_type = data["answerType"]
    language = data["language"]
    voice_id = data.get("voiceId") or "Matthew"
    locale = data.get("locale") or "en-US"

    if answer_type not in ("Summary", "Detailed"):
        return jsonify({"error": "answerType must be 'Summary' or 'Detailed'."}), 400

    # --- Step 1: Build prompt ---
    prompt = build_prompt(place, answer_type, language)

    # --- Step 2: Call Gemini for text generation ---
    gemini_client = get_gemini_client()
    if not gemini_client:
        return jsonify({"error": "Gemini API error: GEMINI_API_KEY is not set in .env"}), 500
    try:
        gemini_response = gemini_client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
        )
        description = gemini_response.text.strip()
    except Exception as exc:
        return jsonify({"error": "Gemini API error: " + str(exc)}), 500

    # --- Step 3: Send text to Murf Falcon for TTS ---
    if not MURF_API_KEY:
        return jsonify({"error": "Murf API error: MURF_API_KEY is not set in .env"}), 500
    try:
        murf_payload = {
            "voice_id": voice_id,
            "text": description,
            "locale": locale,
            "model": "FALCON",
            "format": "MP3",
            "sampleRate": 24000,
            "channelType": "MONO",
        }
        murf_headers = {
            "api-key": MURF_API_KEY,
            "Content-Type": "application/json",
        }
        murf_response = requests.post(
            MURF_STREAM_URL,
            json=murf_payload,
            headers=murf_headers,
            timeout=60,
        )
        murf_response.raise_for_status()
        audio_bytes = murf_response.content
    except requests.exceptions.HTTPError as http_err:
        return jsonify({"error": "Murf API HTTP error: " + str(http_err)}), 500
    except Exception as exc:
        return jsonify({"error": "Murf API error: " + str(exc)}), 500

    # --- Step 4: Base64-encode the MP3 and respond ---
    audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")

    return jsonify({
        "description": description,
        "audio": audio_base64,
        "audioBase64": audio_base64,
    })


if __name__ == "__main__":
    app.run(debug=True)