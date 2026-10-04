# PROJECT_SPEC.md — AI Travel Guide

> **Spec-Driven Development Document**
> Status: Draft | Version: 1.0 | Date: 2026-10-04

---

## Table of Contents

1. [Overview](#1-overview)
2. [Tech Stack](#2-tech-stack)
3. [Functional Requirements](#3-functional-requirements)
4. [Application Flow](#4-application-flow)
5. [API Contract](#5-api-contract)
6. [External Integrations](#6-external-integrations)
7. [Voice and Language Config](#7-voice-and-language-config)
8. [Folder Structure](#8-folder-structure)
9. [Non-Functional Requirements](#9-non-functional-requirements)
10. [Out of Scope](#10-out-of-scope)
11. [Optional Enhancements](#11-optional-enhancements)
12. [Implementation Plan](#12-implementation-plan)
13. [Acceptance Criteria](#13-acceptance-criteria)

---

## 1. Overview

### Goal

Build an AI-powered web application that acts as a personal audio tour guide.
Users select a tourist destination, their preferred language, and a voice, and the
app generates a narrated audio guide on demand — no human guide required.

### Problem Solved

| Problem | How This App Solves It |
|---|---|
| Professional guides are expensive | Free, on-demand AI generation |
| Guides not always available at every site | Works anywhere with internet |
| Language barriers | Supports multiple regional languages |
| Reading a travel blog while sightseeing is tiring | Hands-free audio narration |
| Static guidebooks go out of date | AI-generated content is fresh each time |

### Target Users

- **Domestic and international tourists** visiting popular landmarks
- **Solo travellers** who cannot afford or access a human guide
- **Language learners** who want destination info in their native tongue
- **Accessibility users** who prefer audio over reading

---

## 2. Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Backend runtime | Python 3.10+ | Server-side logic |
| Web framework | Flask + flask-cors | REST API + CORS support |
| Text generation | Google Gemini via `google-genai` | AI destination descriptions |
| Text-to-speech | Murf AI Falcon API (REST) | Convert text to MP3 audio |
| Secret management | python-dotenv (`.env` file) | Load API keys safely |
| Frontend | Plain HTML + Vanilla CSS + JavaScript | UI (no frameworks) |

> **Key constraint:** API keys (`GEMINI_API_KEY`, `MURF_API_KEY`) must **never**
> be hardcoded. They are loaded exclusively from a `.env` file via `python-dotenv`.

---

## 3. Functional Requirements

### 3.1 User Controls

| # | Requirement | Priority |
|---|---|---|
| FR-01 | User MUST be able to select a destination from a dropdown of ≥ 8 famous places | MUST |
| FR-02 | User MUST be able to enter a custom destination via a free-text input | MUST |
| FR-03 | User MUST be able to select a language: **English, Hindi, Tamil, Telugu** | MUST |
| FR-04 | User MUST be able to choose guide length: **Summary (~1 min)** or **Detailed (~3 min)** | MUST |
| FR-05 | User MUST be able to choose a voice gender: **Male** or **Female** | MUST |
| FR-06 | User MUST see a loading indicator while audio is being generated | MUST |
| FR-07 | User SHOULD see a friendly, human-readable error message on any failure | SHOULD |

### 3.2 Text Generation (Gemini)

| # | Requirement | Priority |
|---|---|---|
| FR-08 | The backend MUST call Gemini with a prompt tailored to the selected `answerType` | MUST |
| FR-09 | **Summary** prompt MUST instruct Gemini to write ~200 words, high-level overview, no excessive dates | MUST |
| FR-10 | **Detailed** prompt MUST instruct Gemini to write ~400 words, immersive storytelling covering history, architecture, culture, visitor tips | MUST |
| FR-11 | Both prompts MUST instruct Gemini to respond **only in the selected language** | MUST |

#### Summary Prompt Template

> *"Act as a professional tourist guide. Give a high-level overview of `{place}` in
> the `{language}` language, covering its historical significance, why it is famous,
> and key architectural or cultural highlights. Keep it concise and engaging,
> approximately 200 words, with no excessive dates. Respond ONLY in `{language}`."*

#### Detailed Prompt Template

> *"Act as a professional tourist guide. Give an immersive, storytelling explanation
> of `{place}` in the `{language}` language, covering: historical background and
> timeline, architectural design and unique features, cultural importance and notable
> events, and interesting facts and visitor insights. Aim for approximately 400
> words. Respond ONLY in `{language}`."*

### 3.3 Audio Generation (Murf Falcon)

| # | Requirement | Priority |
|---|---|---|
| FR-12 | The backend MUST send the Gemini text to the Murf Falcon TTS endpoint | MUST |
| FR-13 | The request MUST include the correct `voiceId` and `locale` for the selected language + gender | MUST |
| FR-14 | The audio format MUST be `"MP3"` | MUST |
| FR-15 | The backend MUST base64-encode the raw MP3 bytes before returning them to the frontend | MUST |

### 3.4 Frontend Display

| # | Requirement | Priority |
|---|---|---|
| FR-16 | The frontend MUST display the generated text as a collapsible transcript | MUST |
| FR-17 | The frontend MUST render an HTML `<audio>` player and autoplay the decoded base64 MP3 | MUST |
| FR-18 | The UI MUST be responsive and usable on mobile screens | MUST |
| FR-19 | Error messages MUST be shown inline (not `alert()` popups) | SHOULD |

---

## 4. Application Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
│                                                                 │
│  1. User selects: place, language, length (Summary/Detailed),  │
│     and voice gender                                            │
│                         │                                       │
│  2. Click "Generate Audio Guide"                                │
│     → Show loading spinner                                      │
│     → POST /generate-audio-guide  ─────────────────────────►  │
└─────────────────────────────────────────────────────────────────┘
                                                    │
                               ┌────────────────────▼────────────────────┐
                               │              BACKEND (Flask)            │
                               │                                         │
                               │  3. Validate request fields             │
                               │     → 400 if missing/invalid            │
                               │                                         │
                               │  4. Build prompt from answerType        │
                               │                                         │
                               │  5. Call Google Gemini API              │
                               │     → Returns description text          │
                               │                                         │
                               │  6. Call Murf Falcon TTS API            │
                               │     POST /v1/speech/stream              │
                               │     → Returns raw MP3 bytes             │
                               │                                         │
                               │  7. Base64-encode MP3                   │
                               │                                         │
                               │  8. Return JSON:                        │
                               │     { description, audio: base64 }      │
                               └──────────────────┬──────────────────────┘
                                                  │
┌─────────────────────────────────────────────────▼───────────────┐
│                         FRONTEND                                │
│                                                                 │
│  9. Hide spinner                                                │
│ 10. Populate transcript with `description`                      │
│ 11. Decode base64 → data URI → set as `<audio>` src            │
│ 12. Autoplay audio                                              │
│                                                                 │
│     On error: display friendly error banner                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. API Contract

### Endpoint

```
POST http://127.0.0.1:5000/generate-audio-guide
Content-Type: application/json
```

### Request Body

```json
{
  "place":      "Taj Mahal",
  "answerType": "Summary",
  "language":   "English",
  "voiceId":    "en-US-natalie",
  "locale":     "en-US"
}
```

| Field | Type | Allowed Values | Required |
|---|---|---|---|
| `place` | string | Any non-empty destination name | ✅ |
| `answerType` | string | `"Summary"` \| `"Detailed"` | ✅ |
| `language` | string | `"English"` \| `"Hindi"` \| `"Tamil"` \| `"Telugu"` | ✅ |
| `voiceId` | string | Valid Murf Falcon voice ID | ✅ |
| `locale` | string | BCP-47 locale tag (e.g. `"en-US"`) | ✅ |

### Success Response — `200 OK`

```json
{
  "description": "Standing at the banks of the Yamuna river...",
  "audio": "<base64-encoded MP3 string>"
}
```

### Error Responses

| Status | When | Example Body |
|---|---|---|
| `400 Bad Request` | Missing or invalid request fields | `{"error": "Missing required fields: voiceId, locale"}` |
| `400 Bad Request` | `answerType` not `Summary` or `Detailed` | `{"error": "answerType must be 'Summary' or 'Detailed'."}` |
| `500 Internal Server Error` | Gemini API call fails | `{"error": "Gemini API error: <detail>"}` |
| `500 Internal Server Error` | Murf API call fails | `{"error": "Murf API HTTP error: 401 Unauthorized"}` |

---

## 6. External Integrations

### 6.1 Google Gemini (Text Generation)

| Property | Value |
|---|---|
| Package | `google-genai` |
| Model | `gemini-2.0-flash-lite` |
| Client init | `genai.Client(api_key=GEMINI_API_KEY)` |
| Method | `client.models.generate_content(model=..., contents=prompt)` |
| Response field | `response.text` |
| Error handling | Wrap in `try/except Exception` → return 500 |

### 6.2 Murf AI Falcon (Text-to-Speech)

| Property | Value |
|---|---|
| Endpoint | `POST https://global.api.murf.ai/v1/speech/stream` |
| Auth header | `api-key: <MURF_API_KEY>` |
| Content-Type | `application/json` |
| Timeout | 60 seconds |
| Error handling | `raise_for_status()` → catch `HTTPError` → return 500 |

#### Request Body to Murf

```json
{
  "text":    "<Gemini-generated description>",
  "voiceId": "en-US-natalie",
  "locale":  "en-US",
  "format":  "MP3"
}
```

#### Response from Murf

Raw MP3 binary (`response.content`). Base64-encode before sending to frontend.

---

## 7. Voice and Language Config

This config is maintained as a single JavaScript object in `frontend/script.js`
so it is easy to edit without touching any other file.

| Language | Gender | voiceId | locale |
|---|---|---|---|
| English | Female | `en-US-natalie` | `en-US` |
| English | Male | **TODO** | `en-US` |
| Hindi | Female | **TODO** | `hi-IN` |
| Hindi | Male | **TODO** | `hi-IN` |
| Tamil | Female | **TODO** | `ta-IN` |
| Tamil | Male | **TODO** | `ta-IN` |
| Telugu | Female | **TODO** | `te-IN` |
| Telugu | Male | **TODO** | `te-IN` |

> **How to fill in TODOs:** Visit the Murf Falcon playground at
> https://murf.ai/voice-api, preview voices per language, and copy the voice ID
> into the `VOICE_CONFIG` object in `script.js`.

---

## 8. Folder Structure

```
LevelX Project/                 ← workspace root
├── backend/
│   ├── app.py                  ← Flask application + /generate-audio-guide endpoint
│   └── requirements.txt        ← Python dependencies
├── frontend/
│   ├── index.html              ← Main page (semantic HTML5)
│   ├── style.css               ← Vanilla CSS (no frameworks)
│   └── script.js               ← VOICE_CONFIG + API fetch logic
├── .env                        ← Real keys (git-ignored)
├── .env.example                ← Template (committed to git)
├── .gitignore                  ← Excludes .env, __pycache__, venv/
└── README.md                   ← Setup and run instructions
```

### `.env.example` contents

```
GEMINI_API_KEY=your_gemini_api_key_here
MURF_API_KEY=your_murf_api_key_here
```

---

## 9. Non-Functional Requirements

| # | Requirement | Detail |
|---|---|---|
| NFR-01 | **Security** | API keys loaded only from `.env` via `python-dotenv`. Never hardcoded or exposed to the frontend. |
| NFR-02 | **CORS** | `flask-cors` enables cross-origin requests so the frontend can call the backend from `file://` or a local dev server. |
| NFR-03 | **Responsive UI** | The frontend must be usable on screens from 360 px (mobile) to 1440 px (desktop). |
| NFR-04 | **Response Time** | Summary guide (Gemini + Murf) should complete in ≤ 15 seconds on a normal connection. Detailed in ≤ 30 seconds. |
| NFR-05 | **Error Visibility** | All API errors must surface a human-readable message in the UI — never a raw stack trace. |
| NFR-06 | **No framework lock-in** | Frontend uses only native HTML, CSS, and JavaScript. No React, Vue, Angular, or Tailwind. |
| NFR-07 | **Version pinning** | `requirements.txt` pins or constrains all Python dependencies to ensure reproducible installs. |

---

## 10. Out of Scope

The following features are explicitly **not** part of this version:

- ❌ Voice cloning or custom voice training
- ❌ Audio dubbing over video
- ❌ User accounts, authentication, or profiles
- ❌ Saving or browsing past audio guides (no history/database)
- ❌ Real-time streaming of audio (full MP3 returned in one response)
- ❌ Offline mode / Progressive Web App capabilities
- ❌ Multi-language UI chrome (menus, labels are English-only)
- ❌ Backend deployment / hosting (local dev only in v1)

---

## 11. Optional Enhancements

These are nice-to-have features for future iterations:

| Enhancement | Description |
|---|---|
| 📥 Download audio | Add a "Download MP3" button beneath the audio player |
| 🎚️ Pitch & speed controls | Allow users to adjust Murf voice speed/pitch in the request |
| 🔍 Place suggestions | Autocomplete destination names via a public places API |
| 🗺️ Map embed | Show a small interactive map for the selected destination |
| 📋 Copy transcript | One-click copy of the generated text description |
| 🌐 More languages | Expand to Kannada, Malayalam, Bengali, French, Spanish |
| ⭐ Favourites | Let users bookmark destinations locally (localStorage) |
| 🔊 Voice preview | Play a 5-second sample before generating the full guide |

---

## 12. Implementation Plan

Tasks are ordered; each depends on the one above it.

- [ ] **Task 1 — Project Setup**
  - [ ] Create folder structure: `backend/`, `frontend/`
  - [ ] Create `.env.example` with placeholder keys
  - [ ] Create `.gitignore` (exclude `.env`, `__pycache__/`, `venv/`)
  - [ ] Initialise `backend/requirements.txt`

- [ ] **Task 2 — Backend: Flask Skeleton**
  - [ ] Install dependencies: `flask`, `flask-cors`, `python-dotenv`, `google-genai`, `requests`
  - [ ] Create `backend/app.py` with Flask app, CORS enabled, and `load_dotenv()`
  - [ ] Add health-check route or confirm Flask starts cleanly

- [ ] **Task 3 — Backend: Gemini Text Generation**
  - [ ] Initialise `genai.Client` with `GEMINI_API_KEY`
  - [ ] Implement `build_prompt(place, answer_type, language)` function
  - [ ] Call `client.models.generate_content()` inside the endpoint
  - [ ] Handle exceptions and return 500 with error message

- [ ] **Task 4 — Backend: Murf TTS Integration**
  - [ ] POST Gemini text to `https://global.api.murf.ai/v1/speech/stream`
  - [ ] Set `api-key` header and MP3 format in request body
  - [ ] Handle `HTTPError` and general exceptions → 500
  - [ ] Base64-encode response bytes

- [ ] **Task 5 — Backend: Endpoint & Validation**
  - [ ] Implement `POST /generate-audio-guide`
  - [ ] Validate all required fields → 400 on failure
  - [ ] Validate `answerType` is `"Summary"` or `"Detailed"` → 400
  - [ ] Return `{ description, audio }` on success

- [ ] **Task 6 — Frontend: HTML Structure**
  - [ ] Create `frontend/index.html` with semantic HTML5
  - [ ] Add SEO meta tags (title, description)
  - [ ] Build destination card grid (≥ 8 preloaded places)
  - [ ] Add experience panel: length toggle, language select, voice toggle, generate button
  - [ ] Add transcript accordion and `<audio>` player
  - [ ] Add loading overlay and error banner elements

- [ ] **Task 7 — Frontend: CSS Styling**
  - [ ] Create `frontend/style.css` using CSS custom properties (design tokens)
  - [ ] Style header, cards, experience panel, controls, audio section
  - [ ] Add hover/active micro-animations
  - [ ] Ensure responsive layout (mobile-first, breakpoints at 480 px, 768 px, 900 px)

- [ ] **Task 8 — Frontend: JavaScript Logic**
  - [ ] Define `VOICE_CONFIG` object (language → gender → `{ voiceId, locale }`)
  - [ ] Wire card click → `selectDestination()` function
  - [ ] Wire length toggle and voice gender toggle buttons
  - [ ] Wire search input → custom destination flow
  - [ ] Implement `generateBtn` click → `fetch()` POST → handle response
  - [ ] Decode base64 → `data:audio/mp3;base64,...` → set on `<audio>` src
  - [ ] Show transcript, autoplay audio, display errors via banner

- [ ] **Task 9 — Integration Testing**
  - [ ] Run backend; confirm all 400 validations work via cURL
  - [ ] Test with real Gemini key: confirm description text is generated
  - [ ] Test with real Murf key: confirm MP3 is returned and plays
  - [ ] Test all 4 languages with available voice IDs
  - [ ] Test on mobile viewport (Chrome DevTools)

- [ ] **Task 10 — Documentation**
  - [ ] Write `README.md` with: prerequisites, setup, run steps, cURL example, voice config guide

---

## 13. Acceptance Criteria

The app is considered complete and releasable when **all** of the following pass:

### Backend

- [ ] `POST /generate-audio-guide` returns `200` with `description` (non-empty string) and `audio` (non-empty base64 string) for a valid request
- [ ] Returns `400` with `{"error": "..."}` when any required field is missing
- [ ] Returns `400` with `{"error": "..."}` when `answerType` is not `"Summary"` or `"Detailed"`
- [ ] Returns `500` with `{"error": "Gemini API error: ..."}` when Gemini fails (e.g. bad key)
- [ ] Returns `500` with `{"error": "Murf API ..."}` when Murf fails (e.g. bad key or invalid voiceId)
- [ ] `.env` file is listed in `.gitignore` and is not committed
- [ ] No API key appears anywhere in `app.py` or any committed file

### Frontend

- [ ] All 8 preloaded destination cards are displayed in a responsive grid
- [ ] Clicking a card opens the experience panel with the correct destination name
- [ ] "Back to Places" button closes the panel and restores the grid
- [ ] Language selector shows English, Hindi, Tamil, Telugu
- [ ] Summary / Detailed toggle visually reflects the active selection
- [ ] Male / Female toggle visually reflects the active selection
- [ ] Clicking "Generate Audio Guide" shows a loading spinner
- [ ] After success: transcript text is displayed in the accordion
- [ ] After success: `<audio>` player is visible and autoplays the MP3
- [ ] After failure: a red error banner with a human-readable message is displayed
- [ ] Custom destination via search box generates an audio guide correctly
- [ ] Layout is usable on a 375 px wide mobile viewport

### End-to-End

- [ ] Full flow works (card click → generate → audio plays) in < 30 seconds on a normal connection
- [ ] Full flow works for at least one non-English language (when Murf voice ID is configured)
- [ ] README contains accurate setup and run instructions