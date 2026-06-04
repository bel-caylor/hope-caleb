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
