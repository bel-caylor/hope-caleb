const EVENT = {
  date: "Saturday, May 23, 2026",
  time: "Open House from 3-7pm",
  location: "Casa Caylor",
  food: "BBQ, drinks, and cupcakes.",
  saveViewFood: "BBQ, drinks, and cupcakes. Bring a side or appetizer to share.",
  googleScriptUrl: "https://script.google.com/macros/s/AKfycbysJEGlQau-zVUi0vW3pKBtwG32lD6UBKu3X3Cx267R6tOKHsEDRha5B3mY25q7OKgU/exec"
};

const form = document.querySelector("#rsvpForm");
const statusEl = document.querySelector("#formStatus");
const noteForm = document.querySelector("#noteForm");
const noteStatusEl = document.querySelector("#noteStatus");
const heroSlides = Array.from(document.querySelectorAll(".hero__image"));
const floatingActions = document.querySelector(".floating-actions");
const hero = document.querySelector(".hero");
const galleryImages = Array.from(document.querySelectorAll(".gallery img"));
const lightbox = document.querySelector("#photoLightbox");
const lightboxImage = document.querySelector(".lightbox__image");
const lightboxClose = document.querySelector(".lightbox__close");
const responsesList = document.querySelector("#responsesList");
const notesList = document.querySelector("#notesList");
const noteMediaInput = document.querySelector("#noteMedia");
const noteMediaNameInput = document.querySelector("#noteMediaName");
const noteMediaTypeInput = document.querySelector("#noteMediaType");
const noteMediaDataInput = document.querySelector("#noteMediaData");
const viewMode = new URLSearchParams(window.location.search).get("view");
const isSaveView = viewMode === "save";
const isPartyView = viewMode === "party" || isSaveView;

document.body.classList.toggle("is-save-view", isSaveView);
document.body.classList.toggle("is-party-view", isPartyView);

if (!isPartyView) {
  document.querySelector("[data-story-copy]").textContent = "Hope and Caleb are engaged, newly graduated, and grateful for the people who have encouraged them along the way. Share a note, send congratulations, and celebrate this season with them from wherever you are.";
}

document.querySelector("[data-event-date]").textContent = EVENT.date;
document.querySelector("[data-event-time]").textContent = EVENT.time;
document.querySelector("[data-event-location]").textContent = EVENT.location;
document.querySelector("[data-event-food]").textContent = isSaveView ? EVENT.saveViewFood : EVENT.food;

if (heroSlides.length > 1) {
  let activeSlide = 0;

  setInterval(() => {
    heroSlides[activeSlide].classList.remove("is-active");
    activeSlide = (activeSlide + 1) % heroSlides.length;
    heroSlides[activeSlide].classList.add("is-active");
  }, 2600);
}

setupSlider({
  container: document.querySelector(".photo-slideshow"),
  slides: Array.from(document.querySelectorAll(".photo-slideshow__image")),
  dots: Array.from(document.querySelectorAll('[data-slider-dot="graduation"]')),
  intervalMs: 1800
});

setupSlider({
  container: document.querySelector(".save-date-slideshow"),
  slides: Array.from(document.querySelectorAll(".save-date-slideshow__image")),
  dots: Array.from(document.querySelectorAll('[data-slider-dot="engagement"]')),
  intervalMs: 2400
});

setupSlider({
  container: document.querySelector(".portrait-slideshow"),
  slides: Array.from(document.querySelectorAll(".portrait-slideshow__image")),
  dots: Array.from(document.querySelectorAll('[data-slider-dot="portrait"]')),
  intervalMs: 2200
});

setupSlider({
  container: document.querySelector(".gallery-slideshow"),
  slides: Array.from(document.querySelectorAll(".gallery-slideshow__image")),
  dots: Array.from(document.querySelectorAll('[data-slider-dot="gallery"]')),
  intervalMs: 2200
});

if (floatingActions && hero) {
  const toggleFloatingActions = () => {
    floatingActions.classList.toggle("is-visible", window.scrollY > hero.offsetHeight - 80);
  };

  toggleFloatingActions();
  window.addEventListener("scroll", toggleFloatingActions, { passive: true });
  window.addEventListener("resize", toggleFloatingActions);
}

if (lightbox && lightboxImage && lightboxClose) {
  const isDesktop = () => window.matchMedia("(min-width: 861px)").matches;

  const closeLightbox = () => {
    lightbox.classList.remove("is-open");
    lightbox.hidden = true;
    lightboxImage.src = "";
    lightboxImage.alt = "";
  };

  galleryImages.forEach((image) => {
    image.addEventListener("click", () => {
      if (!isDesktop()) {
        return;
      }

      lightboxImage.src = image.currentSrc || image.src;
      lightboxImage.alt = image.alt;
      lightbox.hidden = false;
      lightbox.classList.add("is-open");
      lightboxClose.focus();
    });
  });

  lightboxClose.addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) {
      closeLightbox();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !lightbox.hidden) {
      closeLightbox();
    }
  });

  window.addEventListener("resize", () => {
    if (!isDesktop() && !lightbox.hidden) {
      closeLightbox();
    }
  });
}

function setupSlider({ container, slides, dots, intervalMs }) {
  if (!container || slides.length <= 1) {
    return;
  }

  let activeSlide = slides.findIndex((slide) => slide.classList.contains("is-active"));
  let isPaused = false;
  let touchStartX = 0;
  let touchStartY = 0;

  if (activeSlide < 0) {
    activeSlide = 0;
    slides[activeSlide].classList.add("is-active");
  }

  const showSlide = (index) => {
    const nextIndex = (index + slides.length) % slides.length;

    slides[activeSlide].classList.remove("is-active");
    dots[activeSlide]?.classList.remove("is-active");
    activeSlide = nextIndex;
    slides[activeSlide].classList.add("is-active");
    dots[activeSlide]?.classList.add("is-active");
  };

  const nextSlide = () => showSlide(activeSlide + 1);
  const previousSlide = () => showSlide(activeSlide - 1);

  dots.forEach((dot) => {
    dot.addEventListener("click", () => {
      showSlide(Number(dot.dataset.slideIndex));
    });
  });

  container.addEventListener("mouseenter", () => {
    isPaused = true;
  });

  container.addEventListener("mouseleave", () => {
    isPaused = false;
  });

  container.addEventListener("focusin", () => {
    isPaused = true;
  });

  container.addEventListener("focusout", () => {
    isPaused = false;
  });

  container.addEventListener("touchstart", (event) => {
    touchStartX = event.changedTouches[0].clientX;
    touchStartY = event.changedTouches[0].clientY;
    isPaused = true;
  }, { passive: true });

  container.addEventListener("touchend", (event) => {
    const touchEndX = event.changedTouches[0].clientX;
    const touchEndY = event.changedTouches[0].clientY;
    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;

    if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX < 0) {
        nextSlide();
      } else {
        previousSlide();
      }
    }

    isPaused = false;
  }, { passive: true });

  setInterval(() => {
    if (!isPaused) {
      nextSlide();
    }
  }, intervalMs);
}

function setStatus(message, tone = "success") {
  statusEl.textContent = message;
  statusEl.dataset.tone = tone;
}

function setNoteStatus(message, tone = "success") {
  noteStatusEl.textContent = message;
  noteStatusEl.dataset.tone = tone;
}

function renderResponses(responses) {
  if (!responsesList) {
    return;
  }

  const visibleResponses = responses.filter((response) => {
    return response.name || response.attending;
  });

  if (!visibleResponses.length) {
    responsesList.innerHTML = '<p class="responses__empty">No RSVPs yet.</p>';
    return;
  }

  responsesList.innerHTML = visibleResponses.map((response) => {
    const name = escapeHtml(response.name || "Guest");
    const attending = escapeHtml(response.attending || "RSVP");

    return `
      <article class="response-card">
        <div class="response-card__top">
          <p class="response-card__name">${name}</p>
          <span class="response-card__attending">${attending}</span>
        </div>
      </article>
    `;
  }).join("");
}

function renderNotes(notes) {
  if (!notesList) {
    return;
  }

  const visibleNotes = notes.filter((note) => {
    return note.name || note.comment;
  });

  if (!visibleNotes.length) {
    notesList.innerHTML = '<p class="responses__empty">No notes yet.</p>';
    return;
  }

  notesList.innerHTML = visibleNotes.map((note) => {
    const name = escapeHtml(note.name || "Guest");
    const comment = escapeHtml(note.comment || "");
    const media = renderNoteMedia(note);

    return `
      <article class="response-card">
        <p class="response-card__name">${name}</p>
        <p class="response-card__comment">${comment}</p>
        ${media}
      </article>
    `;
  }).join("");
}

function renderNoteMedia(note) {
  if (!note.mediaUrl) {
    return "";
  }

  const url = escapeHtml(note.mediaUrl);
  const name = escapeHtml(note.mediaName || "Shared media");

  if (note.mediaType && note.mediaType.startsWith("image/")) {
    const imageUrl = escapeHtml(getDrivePreviewUrl(note.mediaUrl));
    return `<a class="response-card__media" href="${url}" target="_blank" rel="noopener"><img src="${imageUrl}" alt="${name}" loading="lazy"></a>`;
  }

  if (note.mediaType && note.mediaType.startsWith("video/")) {
    return `<a class="response-card__media-link" href="${url}" target="_blank" rel="noopener">Watch shared video</a>`;
  }

  return `<a class="response-card__media-link" href="${url}" target="_blank" rel="noopener">Open shared file</a>`;
}

function getDrivePreviewUrl(url) {
  const idMatch = String(url).match(/\/d\/([^/]+)/);

  if (!idMatch) {
    return url;
  }

  return `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w1200`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function loadResponses() {
  if (!EVENT.googleScriptUrl || (!responsesList && !notesList)) {
    return;
  }

  const callbackName = `handleRsvps${Date.now()}`;
  const script = document.createElement("script");
  const separator = EVENT.googleScriptUrl.includes("?") ? "&" : "?";

  window[callbackName] = (data) => {
    renderResponses(data.responses || []);
    renderNotes(data.notes || []);
    delete window[callbackName];
    script.remove();
  };

  script.onerror = () => {
    if (responsesList) {
      responsesList.innerHTML = '<p class="responses__empty">Unable to load RSVPs right now.</p>';
    }
    if (notesList) {
      notesList.innerHTML = '<p class="responses__empty">Unable to load notes right now.</p>';
    }
    delete window[callbackName];
    script.remove();
  };

  script.src = `${EVENT.googleScriptUrl}${separator}callback=${callbackName}`;
  document.body.appendChild(script);
}

loadResponses();

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!EVENT.googleScriptUrl) {
    setStatus("RSVP form is ready. Add your Google Apps Script URL in script.js before publishing.", "error");
    return;
  }

  document.querySelector("#submittedAt").value = new Date().toISOString();
  const submitButton = form.querySelector("button[type='submit']");
  const payload = new FormData(form);
  const submittedResponse = {
    name: payload.get("name"),
    attending: payload.get("attending")
  };

  submitButton.disabled = true;
  submitButton.textContent = "Sending...";
  setStatus("");

  try {
    await fetch(EVENT.googleScriptUrl, {
      method: "POST",
      mode: "no-cors",
      body: payload
    });

    form.reset();
    setStatus("Thank you. Your RSVP has been sent.");
    loadResponses();
  } catch (error) {
    renderResponses([submittedResponse]);
    setStatus("Something went wrong sending the RSVP. Please try again.", "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Send RSVP";
  }
});

noteForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!EVENT.googleScriptUrl) {
    setNoteStatus("Note form is ready. Add your Google Apps Script URL in script.js before publishing.", "error");
    return;
  }

  document.querySelector("#noteSubmittedAt").value = new Date().toISOString();
  const submitButton = noteForm.querySelector("button[type='submit']");
  const mediaFile = noteMediaInput.files[0];

  if (mediaFile && mediaFile.size > 10 * 1024 * 1024) {
    setNoteStatus("Please choose a photo or video under 10 MB.", "error");
    return;
  }

  if (mediaFile) {
    setNoteStatus("Preparing upload...");
    const mediaData = await readFileAsBase64(mediaFile);
    noteMediaNameInput.value = mediaFile.name;
    noteMediaTypeInput.value = mediaFile.type;
    noteMediaDataInput.value = mediaData;
  } else {
    noteMediaNameInput.value = "";
    noteMediaTypeInput.value = "";
    noteMediaDataInput.value = "";
  }

  const payload = new FormData(noteForm);
  const submittedNote = {
    name: payload.get("name"),
    comment: payload.get("comment"),
    mediaName: payload.get("mediaName"),
    mediaType: payload.get("mediaType")
  };

  submitButton.disabled = true;
  submitButton.textContent = "Sharing...";
  setNoteStatus("");

  try {
    await fetch(EVENT.googleScriptUrl, {
      method: "POST",
      mode: "no-cors",
      body: payload
    });

    noteForm.reset();
    setNoteStatus("Thank you. Your note has been shared.");
    loadResponses();
  } catch (error) {
    renderNotes([submittedNote]);
    setNoteStatus("Something went wrong sharing the note. Please try again.", "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Share Note";
  }
});

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve(String(reader.result).split(",")[1] || "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
