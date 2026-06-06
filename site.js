const HOME_EVENT = {
  weddingDateLabel: "Friday, January 8, 2027",
  countdownTargetIso: "2027-01-08T16:00:00-06:00",
  nextMainEvent: {
    title: "Ceremony begins",
    dateTimeLabel: "Friday, January 8, 2027 at 4:00 PM",
    location: "South Texas venue details coming soon."
  }
};

document.querySelectorAll("[data-wedding-date]").forEach((element) => {
  element.textContent = HOME_EVENT.weddingDateLabel;
});

const nextEventTitle = document.querySelector("[data-next-event-title]");
const nextEventDateTime = document.querySelector("[data-next-event-datetime]");
const nextEventLocation = document.querySelector("[data-next-event-location]");

if (nextEventTitle) {
  nextEventTitle.textContent = HOME_EVENT.nextMainEvent.title;
}

if (nextEventDateTime) {
  nextEventDateTime.textContent = HOME_EVENT.nextMainEvent.dateTimeLabel;
}

if (nextEventLocation) {
  nextEventLocation.textContent = HOME_EVENT.nextMainEvent.location;
}

const countdownEls = {
  days: document.querySelector("[data-countdown-days]"),
  hours: document.querySelector("[data-countdown-hours]"),
  minutes: document.querySelector("[data-countdown-minutes]"),
  seconds: document.querySelector("[data-countdown-seconds]"),
  summary: document.querySelector("[data-countdown-summary]")
};

const countdownTarget = new Date(HOME_EVENT.countdownTargetIso);

function updateCountdown() {
  if (!countdownEls.days || Number.isNaN(countdownTarget.getTime())) {
    return;
  }

  const diffMs = countdownTarget.getTime() - Date.now();

  if (diffMs <= 0) {
    countdownEls.days.textContent = "0";
    countdownEls.hours.textContent = "0";
    countdownEls.minutes.textContent = "0";
    countdownEls.seconds.textContent = "0";

    if (countdownEls.summary) {
      countdownEls.summary.textContent = `${HOME_EVENT.nextMainEvent.title} is here.`;
    }

    return;
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  countdownEls.days.textContent = String(days);
  countdownEls.hours.textContent = String(hours).padStart(2, "0");
  countdownEls.minutes.textContent = String(minutes).padStart(2, "0");
  countdownEls.seconds.textContent = String(seconds).padStart(2, "0");

  if (countdownEls.summary) {
    countdownEls.summary.textContent = `${days} days until ${HOME_EVENT.nextMainEvent.title.toLowerCase()} on ${HOME_EVENT.weddingDateLabel}.`;
  }
}

updateCountdown();
window.setInterval(updateCountdown, 1000);

const storySliders = Array.from(document.querySelectorAll("[data-slider]"));

storySliders.forEach((slider) => {
  const viewport = slider.querySelector(".story-slider__viewport");
  const slides = Array.from(slider.querySelectorAll(".story-slider__image"));
  const dots = Array.from(slider.querySelectorAll(".story-slider__dot"));
  const intervalMs = Number(slider.dataset.interval) || 2800;

  if (!viewport || slides.length <= 1) {
    return;
  }

  let activeIndex = slides.findIndex((slide) => slide.classList.contains("is-active"));
  let paused = false;
  let scrollTimer;

  if (activeIndex < 0) {
    activeIndex = 0;
  }

  const updateDots = (index) => {
    dots.forEach((dot, dotIndex) => {
      dot.classList.toggle("is-active", dotIndex === index);
    });
  };

  const showSlide = (index, behavior = "smooth") => {
    const nextIndex = (index + slides.length) % slides.length;
    activeIndex = nextIndex;
    updateDots(activeIndex);
    viewport.scrollTo({
      left: viewport.clientWidth * activeIndex,
      behavior
    });
  };

  dots.forEach((dot, index) => {
    dot.addEventListener("click", () => {
      showSlide(index);
    });
  });

  slider.addEventListener("mouseenter", () => {
    paused = true;
  });

  slider.addEventListener("mouseleave", () => {
    paused = false;
  });

  slider.addEventListener("focusin", () => {
    paused = true;
  });

  slider.addEventListener("focusout", () => {
    paused = false;
  });

  slider.addEventListener("touchstart", () => {
    paused = true;
  }, { passive: true });

  slider.addEventListener("touchend", () => {
    paused = false;
  }, { passive: true });

  viewport.addEventListener("scroll", () => {
    window.clearTimeout(scrollTimer);
    scrollTimer = window.setTimeout(() => {
      const nextIndex = Math.round(viewport.scrollLeft / Math.max(viewport.clientWidth, 1));
      activeIndex = Math.min(Math.max(nextIndex, 0), slides.length - 1);
      updateDots(activeIndex);
    }, 80);
  }, { passive: true });

  window.addEventListener("resize", () => {
    showSlide(activeIndex, "auto");
  });

  showSlide(activeIndex, "auto");

  window.setInterval(() => {
    if (!paused) {
      showSlide(activeIndex + 1);
    }
  }, intervalMs);
});
