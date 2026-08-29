const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx-VabY9rHKinhHZXWV8Nd01-AKGO00KuY_XqggoIyamJGhSG7gRkct5SYLwKQUHAOQ/exec";
const SLIDE_DURATION_MS = 6500;
const slideshow = document.querySelector(".tv-slideshow");
const statusEl = document.querySelector("#tvStatus");
const arrowButtons = Array.from(document.querySelectorAll("[data-slide-direction]"));
let slides = Array.from(document.querySelectorAll("[data-slide]"));
let activeSlide = 0;
const TRANSITIONS = ["kenburns-in", "kenburns-out", "drift-left", "drift-right", "lift"];

loadSlides(); setupArrows(); startSlideshow();

function loadSlides() {
  const callbackName = `handleRehearsalSlides${Date.now()}`;
  const script = document.createElement("script");
  window[callbackName] = (data) => {
    const rehearsalSlides = data.slides || [];
    rehearsalSlides.forEach((slide) => slideshow.appendChild(createSlide(slide)));
    refreshSlides(); setStatus(rehearsalSlides.length ? "" : "No rehearsal photos have been added yet.");
    delete window[callbackName]; script.remove();
  };
  script.onerror = () => { setStatus("Rehearsal photos could not load."); delete window[callbackName]; script.remove(); };
  script.src = `${GOOGLE_SCRIPT_URL}?feed=rehearsal-slideshow&callback=${callbackName}`;
  document.body.appendChild(script);
}

function createSlide(slide) {
  const section = document.createElement("section"); section.className = "slide slide--media"; section.dataset.slide = "";
  const caption = String(slide.caption || "").trim();
  section.innerHTML = `<div class="slide__media-quote slide__media-quote--image"><img class="slide__photo-bg" src="${escapeHtml(slide.imageUrl)}" alt="" aria-hidden="true"><img class="slide__photo slide__photo--zoom" src="${escapeHtml(slide.imageUrl)}" alt="${escapeHtml(caption || "Rehearsal dinner memory")}" data-detect-orientation>${caption ? `<article class="slide__note slide__note--overlay slide__note--plain"><p class="slide__note-text">${escapeHtml(caption)}</p></article>` : ""}</div>`;
  return section;
}
function startSlideshow() { setInterval(() => { if (slides.length > 1) showSlide(activeSlide + 1); }, SLIDE_DURATION_MS); }
function setupArrows() { arrowButtons.forEach((button) => button.addEventListener("click", () => showSlide(activeSlide + (button.dataset.slideDirection === "previous" ? -1 : 1)))); }
function showSlide(index) { if (!slides.length) return; activeSlide = (index + slides.length) % slides.length; updateActiveSlide(); }
function refreshSlides() { slides = Array.from(document.querySelectorAll("[data-slide]")); document.querySelectorAll("[data-detect-orientation]").forEach(trackPortraitImage); slides.forEach((slide, index) => slide.classList.add(`slide--${TRANSITIONS[index % TRANSITIONS.length]}`)); updateActiveSlide(); }
function updateActiveSlide() { slides.forEach((slide, index) => slide.classList.toggle("is-active", index === activeSlide)); }
function trackPortraitImage(image) { const update = () => image.classList.toggle("slide__photo--portrait", image.naturalHeight > image.naturalWidth); if (image.complete && image.naturalWidth) update(); else image.addEventListener("load", update, { once: true }); }
function setStatus(message) { statusEl.textContent = message; }
function escapeHtml(value) { return String(value || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"); }
