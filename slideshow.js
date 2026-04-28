const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzZ2peyNc4rQABN3d-CzTc-HF90mJun19RO4oFbseruxx9U7PMFol2fMlv0J1jSs1w/exec";
const SLIDE_DURATION_MS = 6500;

const LOCAL_PHOTOS = [
  "images/hero/engagement.jpg",
  "images/hero/grad caleb.jpg",
  "images/hero/grad hope.jpg",
  "images/hero/standing grad.jpg",
  "images/engagement/engagement ring.jpg",
  "images/engagement/engagement.jpg",
  "images/celebration/celebration grad.jpg",
  "images/celebration/grad celebration0.jpg",
  "images/celebration/grad celebration1.jpg",
  "images/celebration/grad celebration2.jpg",
  "images/celebration/grad celebration3.jpg",
  "images/portrait/grad caleb UTSA.jpg",
  "images/portrait/grad hc UTSA.jpg",
  "images/portrait/grad hope UTSA.jpg",
  "images/portrait/grad UTSA friends.jpg",
  "images/gallery/grad caleb.jpg",
  "images/gallery/grad hats.jpg",
  "images/gallery/grad hope.jpg",
  "images/gallery/grad standing.jpg",
  "images/gallery/grad standing2.jpg",
  "images/gallery/grad water hope.jpg",
  "images/gallery/stairs grad.jpg",
  "images/gallery/standing grad.jpg"
];

const slideshow = document.querySelector(".tv-slideshow");
const statusEl = document.querySelector("#tvStatus");
let slides = Array.from(document.querySelectorAll("[data-slide]"));
let activeSlide = 0;

buildLocalSlides();
loadSharedNotes();
startSlideshow();

function buildLocalSlides() {
  LOCAL_PHOTOS.forEach((src) => {
    slideshow.appendChild(createPhotoSlide(src));
  });

  refreshSlides();
}

function loadSharedNotes() {
  if (!GOOGLE_SCRIPT_URL) {
    setStatus("");
    return;
  }

  const callbackName = `handleTvNotes${Date.now()}`;
  const script = document.createElement("script");
  const separator = GOOGLE_SCRIPT_URL.includes("?") ? "&" : "?";

  window[callbackName] = (data) => {
    const notes = data.notes || [];

    notes.forEach((note) => {
      if (note.mediaUrl) {
        slideshow.appendChild(createMediaNoteSlide(note));
      } else if (note.comment) {
        slideshow.appendChild(createNoteSlide(note));
      }
    });

    refreshSlides();
    setStatus(notes.length ? `${notes.length} shared notes loaded` : "");
    delete window[callbackName];
    script.remove();
  };

  script.onerror = () => {
    setStatus("Shared notes could not load");
    delete window[callbackName];
    script.remove();
  };

  script.src = `${GOOGLE_SCRIPT_URL}${separator}callback=${callbackName}`;
  document.body.appendChild(script);
}

function createPhotoSlide(src) {
  const slide = document.createElement("section");
  const image = document.createElement("img");

  slide.className = "slide";
  slide.dataset.slide = "";
  image.className = "slide__photo";
  image.src = src;
  image.alt = "";
  image.loading = "eager";

  slide.appendChild(image);
  return slide;
}

function createNoteSlide(note) {
  const slide = document.createElement("section");

  slide.className = "slide";
  slide.dataset.slide = "";
  slide.innerHTML = `
    <article class="slide__note">
      <p class="slide__note-text">${escapeHtml(note.comment)}</p>
      <p class="slide__note-from">- ${escapeHtml(note.name || "Guest")}</p>
    </article>
  `;

  return slide;
}

function createMediaNoteSlide(note) {
  const slide = document.createElement("section");
  const mediaMarkup = getMediaMarkup(note);

  slide.className = "slide";
  slide.dataset.slide = "";

  if (note.comment) {
    slide.innerHTML = `
      <div class="slide__split">
        ${mediaMarkup}
        <article class="slide__note">
          <p class="slide__note-text">${escapeHtml(note.comment)}</p>
          <p class="slide__note-from">- ${escapeHtml(note.name || "Guest")}</p>
        </article>
      </div>
    `;
  } else {
    slide.innerHTML = mediaMarkup;
  }

  return slide;
}

function getMediaMarkup(note) {
  if (!isUsableUrl(note.mediaUrl)) {
    return createNoteSlide(note).innerHTML;
  }

  const url = escapeHtml(note.mediaUrl);

  if (note.mediaType && note.mediaType.startsWith("image/")) {
    const imageUrl = escapeHtml(getDriveThumbnailUrl(note.mediaUrl));
    return `<img class="slide__photo" src="${imageUrl}" alt="">`;
  }

  if (note.mediaType && note.mediaType.startsWith("video/")) {
    const previewUrl = escapeHtml(getDrivePreviewUrl(note.mediaUrl));
    return `<iframe class="slide__video" src="${previewUrl}" allow="autoplay; fullscreen" allowfullscreen title="Shared video"></iframe>`;
  }

  return `
    <article class="slide__note">
      <p class="slide__note-text">Shared media from ${escapeHtml(note.name || "a guest")}</p>
      <p class="slide__note-from">${url}</p>
    </article>
  `;
}

function startSlideshow() {
  setInterval(() => {
    if (slides.length <= 1) {
      return;
    }

    slides[activeSlide].classList.remove("is-active");
    activeSlide = (activeSlide + 1) % slides.length;
    slides[activeSlide].classList.add("is-active");
  }, SLIDE_DURATION_MS);
}

function refreshSlides() {
  slides = Array.from(document.querySelectorAll("[data-slide]"));
  slides.forEach((slide, index) => {
    slide.classList.toggle("is-active", index === activeSlide);
  });
}

function setStatus(message) {
  statusEl.textContent = message;

  if (message) {
    setTimeout(() => {
      statusEl.textContent = "";
    }, 5000);
  }
}

function getDriveThumbnailUrl(url) {
  if (!isUsableUrl(url)) {
    return "";
  }

  const id = getDriveFileId(url);
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w1600` : url;
}

function getDrivePreviewUrl(url) {
  if (!isUsableUrl(url)) {
    return "";
  }

  const id = getDriveFileId(url);
  return id ? `https://drive.google.com/file/d/${id}/preview` : url;
}

function getDriveFileId(url) {
  const match = String(url).match(/\/d\/([^/]+)/);
  return match ? match[1] : "";
}

function isUsableUrl(value) {
  const url = String(value || "").trim();
  return Boolean(url) && url !== "undefined" && url !== "null";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
