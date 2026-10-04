// ============================================================
// VOICE CONFIG
// Map language + gender → { voiceId, locale }
// Edit voiceId values from the Murf Falcon playground.
// ============================================================
const VOICE_CONFIG = {
  English: {
    Female: { voiceId: "Alicia", locale: "en-US" },
    Male:   { voiceId: "Matthew", locale: "en-US" },
  },
  Hindi: {
    Female: { voiceId: "Namrita", locale: "hi-IN" },
    Male:   { voiceId: "Aman", locale: "hi-IN" },
  },
  Tamil: {
    Female: { voiceId: "Iniya", locale: "ta-IN" },
    Male:   { voiceId: "Murali", locale: "ta-IN" },
  },
  Telugu: {
    Female: { voiceId: "Josie", locale: "te-IN" },
    Male:   { voiceId: "Zion", locale: "te-IN" },
  },
};

// Backend API endpoint
const GENERATE_AUDIO_GUIDE_API_URL = "http://127.0.0.1:5000/generate-audio-guide";

// ============================================================
// STATE
// ============================================================
const state = {
  place: "",
  image: "",
  length: "Summary",
  voice: "Male",
};

// ============================================================
// DOM ELEMENTS
// ============================================================
const cardsContainer      = document.querySelector(".cards");
const experiencePanel     = document.getElementById("experience");
const previewTitle        = document.getElementById("previewTitle");
const audioSection        = document.getElementById("audioSection");
const audioPlayer         = document.getElementById("audioPlayer");
const transcriptText      = document.getElementById("scriptText");
const generateButton      = document.getElementById("generateBtn");
const languageSelect      = document.getElementById("selectLanguage");
const closeButton         = document.getElementById("closeExperience");
const searchPreviewCard   = document.getElementById("searchPreviewCard");
const searchPreviewImage  = document.getElementById("searchPreviewImage");
const searchPreviewTitle  = document.getElementById("searchPreviewTitle");
const transcriptToggle    = document.getElementById("transcriptToggle");
const transcriptContent   = document.getElementById("transcriptContent");
const transcriptArrow     = document.getElementById("transcriptArrow");
const searchInput         = document.getElementById("searchInput");
const searchBtn           = document.getElementById("searchBtn");
const errorBanner         = document.getElementById("errorBanner");
const errorMessage        = document.getElementById("errorMessage");
const loadingOverlay      = document.getElementById("loadingOverlay");

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function showError(msg) {
  errorMessage.textContent = msg;
  errorBanner.classList.remove("hidden");
  setTimeout(() => errorBanner.classList.add("hidden"), 6000);
}

function hideError() {
  errorBanner.classList.add("hidden");
}

function setLoading(isLoading) {
  if (isLoading) {
    loadingOverlay.classList.remove("hidden");
    generateButton.disabled = true;
    generateButton.innerHTML = `
      <span class="btn-spinner"></span>
      Generating...
    `;
  } else {
    loadingOverlay.classList.add("hidden");
    generateButton.disabled = false;
    generateButton.textContent = "Generate Audio Guide";
  }
}

function selectDestination(place, image, clickedCard = null) {
  state.place = place;
  state.image = image;

  previewTitle.textContent = place;
  cardsContainer.classList.add("faded");

  document.querySelectorAll(".place-card").forEach((c) => c.classList.remove("active"));
  searchPreviewCard.classList.add("hidden");

  if (clickedCard) {
    clickedCard.classList.add("active");
  } else {
    searchPreviewImage.src = image;
    searchPreviewTitle.textContent = place;
    searchPreviewCard.classList.remove("hidden");
    searchPreviewCard.classList.add("active");
  }

  // Reset audio panel
  audioSection.classList.add("hidden");
  audioPlayer.src = "";
  transcriptText.textContent = "";
  transcriptContent.classList.add("hidden");
  generateButton.textContent = "Generate Audio Guide";
  generateButton.disabled = false;
  hideError();

  experiencePanel.classList.remove("hidden");
  setTimeout(() => experiencePanel.classList.add("visible"), 10);
}

function deselectDestination() {
  experiencePanel.classList.remove("visible");
  setTimeout(() => {
    experiencePanel.classList.add("hidden");
    cardsContainer.classList.remove("faded");
    searchPreviewCard.classList.add("hidden");
    document.querySelectorAll(".place-card").forEach((c) => c.classList.remove("active"));
  }, 300);
}

// ============================================================
// EVENT LISTENERS
// ============================================================

// Close panel
closeButton.addEventListener("click", deselectDestination);

// Place card clicks
document.querySelectorAll(".place-card:not(.search-preview-card)").forEach((card) => {
  card.addEventListener("click", () => {
    selectDestination(card.dataset.place, card.dataset.image, card);
  });
});

// Length toggle (Summary / Detailed)
const lengthButtons = document.querySelectorAll('[data-group="length"] button');
lengthButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    lengthButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.length = btn.dataset.value;
  });
});

// Voice gender toggle
const voiceButtons = document.querySelectorAll('[data-group="voice"] button');
voiceButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    voiceButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.voice = btn.dataset.value;
  });
});

// Search
function doSearch() {
  const query = searchInput.value.trim();
  if (!query) return;
  const unsplashFallback = `https://source.unsplash.com/600x400/?${encodeURIComponent(query)},landmark`;
  selectDestination(query, unsplashFallback, null);
}
searchBtn && searchBtn.addEventListener("click", doSearch);
searchInput && searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") doSearch();
});

// Transcript toggle
transcriptToggle.addEventListener("click", () => {
  transcriptContent.classList.toggle("hidden");
  transcriptArrow.classList.toggle("rotate-180");
});

// ============================================================
// GENERATE AUDIO GUIDE
// ============================================================
generateButton.addEventListener("click", async () => {
  if (!state.place) {
    showError("Please select a destination first.");
    return;
  }

  hideError();
  setLoading(true);

  const selectedLanguage = languageSelect.value;
  const selectedGender   = state.voice;                          // "Male" | "Female"
  const voiceCfg         = VOICE_CONFIG[selectedLanguage]?.[selectedGender];

  if (!voiceCfg) {
    showError("Voice configuration not found for the selected language and gender.");
    setLoading(false);
    return;
  }

  try {
    const response = await fetch(GENERATE_AUDIO_GUIDE_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        place:      state.place,
        answerType: state.length,
        language:   selectedLanguage,
        voiceId:    voiceCfg.voiceId,
        locale:     voiceCfg.locale,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `Server error ${response.status}`);
    }

    // Show transcript
    transcriptText.textContent = data.description;
    audioSection.classList.remove("hidden");

    // Show audio player
    if (data.audio) {
      audioPlayer.src = `data:audio/mp3;base64,${data.audio}`;
      audioPlayer.load();
      audioPlayer.play().catch(() => {}); // autoplay (may be blocked by browser)
      generateButton.textContent = "✓ Playing Audio";
    } else {
      audioPlayer.classList.add("hidden");
      generateButton.textContent = "Audio Not Available";
    }

  } catch (err) {
    console.error(err);
    showError(`Generation failed: ${err.message}`);
    generateButton.textContent = "Generate Audio Guide";
    generateButton.disabled = false;
  } finally {
    loadingOverlay.classList.add("hidden");
  }
});
