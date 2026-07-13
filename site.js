const HOME_EVENT = {
  weddingDateLabel: "Friday, January 8, 2027",
  countdownTargetIso: "2027-01-08T16:00:00-06:00",
  nextMainEvent: {
    title: "Ceremony begins"
  }
};

const AMAZON_REGISTRY = {
  publicUrl: "https://www.amazon.com/wedding/guest-view/2O44LISCGJTRC",
  embedUrl: ""
};

document.querySelectorAll("[data-wedding-date]").forEach((element) => {
  element.textContent = HOME_EVENT.weddingDateLabel;
});

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

const registryLink = document.querySelector("[data-registry-link]");
const registryNote = document.querySelector("[data-registry-note]");

if (registryLink) {
  if (AMAZON_REGISTRY.publicUrl) {
    registryLink.href = AMAZON_REGISTRY.publicUrl;
    registryLink.removeAttribute("aria-disabled");
  } else {
    registryLink.setAttribute("aria-disabled", "true");
    registryLink.removeAttribute("href");
    registryLink.classList.add("button--ghost");
    if (registryNote) {
      registryNote.textContent = "The Amazon registry link will be added here once it is ready.";
    }
  }
}

const storySliders = Array.from(document.querySelectorAll("[data-slider]"));
const sectionNav = document.querySelector(".section-nav");
const sectionMenuToggle = document.querySelector("[data-section-menu-toggle]");
const sectionMenuPanel = document.querySelector("[data-section-menu-panel]");
const submenuItems = Array.from(document.querySelectorAll(".section-nav__item--has-submenu"));
const mobileNavMedia = window.matchMedia("(max-width: 760px)");

function setSectionMenuOpen(isOpen) {
  if (!sectionNav || !sectionMenuToggle) {
    return;
  }

  sectionNav.classList.toggle("is-menu-open", isOpen);
  sectionMenuToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
}

function closeAllSubmenus() {
  submenuItems.forEach((item) => {
    item.classList.remove("is-open");
    const toggle = item.querySelector("[data-section-submenu-toggle]");
    if (toggle) {
      toggle.setAttribute("aria-expanded", "false");
    }
  });
}

if (sectionMenuToggle && sectionMenuPanel) {
  sectionMenuToggle.addEventListener("click", () => {
    const nextOpen = !sectionNav?.classList.contains("is-menu-open");
    setSectionMenuOpen(Boolean(nextOpen));

    if (!nextOpen) {
      closeAllSubmenus();
    }
  });

  sectionMenuPanel.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      if (mobileNavMedia.matches) {
        setSectionMenuOpen(false);
        closeAllSubmenus();
      }
    });
  });

  mobileNavMedia.addEventListener("change", (event) => {
    if (!event.matches) {
      setSectionMenuOpen(false);
      closeAllSubmenus();
    }
  });
}

submenuItems.forEach((item) => {
  const toggle = item.querySelector("[data-section-submenu-toggle]");
  if (!toggle) {
    return;
  }

  const setOpen = (isOpen) => {
    item.classList.toggle("is-open", isOpen);
    toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  };

  toggle.addEventListener("click", (event) => {
    event.preventDefault();
    const nextOpen = !item.classList.contains("is-open");

    submenuItems.forEach((otherItem) => {
      if (otherItem !== item) {
        otherItem.classList.remove("is-open");
        const otherToggle = otherItem.querySelector("[data-section-submenu-toggle]");
        if (otherToggle) {
          otherToggle.setAttribute("aria-expanded", "false");
        }
      }
    });

    setOpen(nextOpen);
  });
});

document.addEventListener("click", (event) => {
  if (sectionNav && !sectionNav.contains(event.target)) {
    setSectionMenuOpen(false);
    closeAllSubmenus();
    return;
  }

  submenuItems.forEach((item) => {
    if (!item.contains(event.target)) {
      item.classList.remove("is-open");
      const toggle = item.querySelector("[data-section-submenu-toggle]");
      if (toggle) {
        toggle.setAttribute("aria-expanded", "false");
      }
    }
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") {
    return;
  }

  setSectionMenuOpen(false);
  closeAllSubmenus();
});

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
