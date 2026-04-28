const EVENT = {
  date: "Saturday, May 23, 2026",
  time: "Open House from 3-7pm",
  location: "Casa Caylor",
  food: "BBQ, drinks, and cupcakes. Bring a side or appetizer to share.",
  googleScriptUrl: ""
};

const form = document.querySelector("#rsvpForm");
const statusEl = document.querySelector("#formStatus");
const heroSlides = Array.from(document.querySelectorAll(".hero__image"));
const gradSlides = Array.from(document.querySelectorAll(".photo-slideshow__image"));
const engagementSlides = Array.from(document.querySelectorAll(".save-date-slideshow__image"));
const floatingRsvp = document.querySelector(".floating-rsvp");
const hero = document.querySelector(".hero");
const galleryImages = Array.from(document.querySelectorAll(".gallery img"));
const lightbox = document.querySelector("#photoLightbox");
const lightboxImage = document.querySelector(".lightbox__image");
const lightboxClose = document.querySelector(".lightbox__close");
const responsesList = document.querySelector("#responsesList");

document.querySelector("[data-event-date]").textContent = EVENT.date;
document.querySelector("[data-event-time]").textContent = EVENT.time;
document.querySelector("[data-event-location]").textContent = EVENT.location;
document.querySelector("[data-event-food]").textContent = EVENT.food;

if (heroSlides.length > 1) {
  let activeSlide = 0;

  setInterval(() => {
    heroSlides[activeSlide].classList.remove("is-active");
    activeSlide = (activeSlide + 1) % heroSlides.length;
    heroSlides[activeSlide].classList.add("is-active");
  }, 2600);
}

if (gradSlides.length > 1) {
  let activeGradSlide = 0;

  setInterval(() => {
    gradSlides[activeGradSlide].classList.remove("is-active");
    activeGradSlide = (activeGradSlide + 1) % gradSlides.length;
    gradSlides[activeGradSlide].classList.add("is-active");
  }, 1800);
}

if (engagementSlides.length > 1) {
  let activeEngagementSlide = 0;

  setInterval(() => {
    engagementSlides[activeEngagementSlide].classList.remove("is-active");
    activeEngagementSlide = (activeEngagementSlide + 1) % engagementSlides.length;
    engagementSlides[activeEngagementSlide].classList.add("is-active");
  }, 2400);
}

if (floatingRsvp && hero) {
  const toggleFloatingRsvp = () => {
    floatingRsvp.classList.toggle("is-visible", window.scrollY > hero.offsetHeight - 80);
  };

  toggleFloatingRsvp();
  window.addEventListener("scroll", toggleFloatingRsvp, { passive: true });
  window.addEventListener("resize", toggleFloatingRsvp);
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

function setStatus(message, tone = "success") {
  statusEl.textContent = message;
  statusEl.dataset.tone = tone;
}

function renderResponses(responses) {
  if (!responsesList) {
    return;
  }

  const visibleResponses = responses.filter((response) => {
    return response.name || response.attending || response.comment;
  });

  if (!visibleResponses.length) {
    responsesList.innerHTML = '<p class="responses__empty">No RSVPs yet.</p>';
    return;
  }

  responsesList.innerHTML = visibleResponses.map((response) => {
    const name = escapeHtml(response.name || "Guest");
    const attending = escapeHtml(response.attending || "RSVP");
    const comment = escapeHtml(response.comment || "No comment yet.");

    return `
      <article class="response-card">
        <div class="response-card__top">
          <p class="response-card__name">${name}</p>
          <span class="response-card__attending">${attending}</span>
        </div>
        <p class="response-card__comment">${comment}</p>
      </article>
    `;
  }).join("");
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
  if (!EVENT.googleScriptUrl || !responsesList) {
    return;
  }

  const callbackName = `handleRsvps${Date.now()}`;
  const script = document.createElement("script");
  const separator = EVENT.googleScriptUrl.includes("?") ? "&" : "?";

  window[callbackName] = (data) => {
    renderResponses(data.responses || []);
    delete window[callbackName];
    script.remove();
  };

  script.onerror = () => {
    responsesList.innerHTML = '<p class="responses__empty">Unable to load RSVPs right now.</p>';
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
    attending: payload.get("attending"),
    comment: payload.get("comment")
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
