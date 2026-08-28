const HOME_EVENT = {
  weddingDateLabel: "Friday, January 8, 2027"
};

const AMAZON_REGISTRY = {
  publicUrl: "https://www.amazon.com/wedding/guest-view/2O44LISCGJTRC",
  embedUrl: ""
};

const HONEYMOON_OPTIONS = {
  zelleEmail: "Hccaylor+wedding@gmail.com",
  venmoUrl: "https://venmo.com/u/Hope-Caylor"
};

const HOME_RSVP = {
  scriptUrl: "https://script.google.com/macros/s/AKfycby0FxGzNOodhH8i_D4yekp5K9jfzRNcyV_6pkYEpMsB6epA6GlUx4tMmaK7zCIgpHBA/exec",
  deadlineLabel: "Please reply by December 1, 2026."
};

document.querySelectorAll("[data-wedding-date]").forEach((element) => {
  element.textContent = HOME_EVENT.weddingDateLabel;
});

const registryLink = document.querySelector("[data-registry-link]");
const registryNote = document.querySelector("[data-registry-note]");
const zelleCopyButton = document.querySelector("[data-copy-zelle]");
const zelleFeedback = document.querySelector("[data-zelle-feedback]");
const venmoLink = document.querySelector("[data-venmo-link]");
const rsvpLookupCard = document.querySelector("[data-rsvp-lookup-card]");
const rsvpLookupForm = document.querySelector("[data-rsvp-lookup-form]");
const rsvpLookupStatus = document.querySelector("[data-rsvp-lookup-status]");
const rsvpGroupPicker = document.querySelector("[data-rsvp-group-picker]");
const rsvpGroupList = document.querySelector("[data-rsvp-group-list]");
const rsvpEditor = document.querySelector("[data-rsvp-editor]");
const rsvpResponseForm = document.querySelector("[data-rsvp-response-form]");
const rsvpMembers = document.querySelector("[data-rsvp-members]");
const rsvpRehearsalSection = document.querySelector("[data-rsvp-rehearsal-section]");
const rsvpOpenHouseSection = document.querySelector("[data-rsvp-open-house-section]");
const rsvpOutOfTownSection = document.querySelector("[data-rsvp-out-of-town-section]");
const rsvpGuestExtras = document.querySelector("[data-rsvp-guest-extras]");
const rsvpPlusOneSection = document.querySelector("[data-rsvp-plus-one-section]");
const rsvpChildrenSection = document.querySelector("[data-rsvp-children-section]");
const rsvpPlusOneCopy = document.querySelector("[data-rsvp-plus-one-copy]");
const rsvpPlusOneCount = document.querySelector("[data-rsvp-plus-one-count]");
const rsvpPlusOneName = document.querySelector("[data-rsvp-plus-one-name]");
const rsvpChildrenCount = document.querySelector("[data-rsvp-children-count]");
const rsvpContactName = document.querySelector("[data-rsvp-contact-name]");
const rsvpEmail = document.querySelector("[data-rsvp-email]");
const rsvpSubmitStatus = document.querySelector("[data-rsvp-submit-status]");
const rsvpChangePartyButton = document.querySelector("[data-rsvp-change-party]");

const rsvpState = {
  lookupFirstName: "",
  lookupLastName: "",
  matches: [],
  selectedGroup: null
};

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

if (zelleCopyButton) {
  zelleCopyButton.addEventListener("click", async () => {
    const copyValue = zelleCopyButton.getAttribute("data-copy-value") || HONEYMOON_OPTIONS.zelleEmail;

    try {
      await navigator.clipboard.writeText(copyValue);
      if (zelleFeedback) {
        zelleFeedback.textContent = "Zelle email copied. Paste it into your bank's Zelle recipient field.";
      }
      zelleCopyButton.textContent = "Copied";
      window.setTimeout(() => {
        zelleCopyButton.textContent = "Copy Zelle Email";
      }, 1800);
    } catch (error) {
      if (zelleFeedback) {
        zelleFeedback.textContent = "Copy failed. Please try again, or use the Venmo button instead.";
      }
    }
  });
}

if (venmoLink) {
  if (HONEYMOON_OPTIONS.venmoUrl) {
    venmoLink.href = HONEYMOON_OPTIONS.venmoUrl;
    venmoLink.removeAttribute("aria-disabled");
  } else {
    venmoLink.removeAttribute("href");
    venmoLink.classList.add("button--ghost");
    venmoLink.setAttribute("aria-disabled", "true");
  }
}

const storySliders = Array.from(document.querySelectorAll("[data-slider]"));
const sectionNav = document.querySelector(".section-nav");
const sectionMenuToggle = document.querySelector("[data-section-menu-toggle]");
const sectionMenuPanel = document.querySelector("[data-section-menu-panel]");
const submenuItems = Array.from(document.querySelectorAll(".section-nav__item--has-submenu"));
const mobileNavMedia = window.matchMedia("(max-width: 760px)");
const compactDesktopNavMedia = window.matchMedia("(min-width: 761px)");
const RSVP_LOOKUP_STORAGE_KEY = "hope-caleb-rsvp-lookup";

function saveRsvpLookupNames(firstName, lastName) {
  if (!firstName || !lastName) return;
  try {
    window.sessionStorage.setItem(RSVP_LOOKUP_STORAGE_KEY, JSON.stringify({ firstName, lastName }));
  } catch (_) {
    // The URL remains the source of truth when browser storage is unavailable.
  }
}

function getSavedRsvpLookupNames() {
  const params = new URLSearchParams(window.location.search);
  const firstName = normalizeNamePart(params.get("firstName"));
  const lastName = normalizeNamePart(params.get("lastName"));
  if (firstName && lastName) {
    saveRsvpLookupNames(firstName, lastName);
    return { firstName, lastName };
  }

  try {
    const saved = JSON.parse(window.sessionStorage.getItem(RSVP_LOOKUP_STORAGE_KEY) || "{}");
    return {
      firstName: normalizeNamePart(saved.firstName),
      lastName: normalizeNamePart(saved.lastName)
    };
  } catch (_) {
    return { firstName: "", lastName: "" };
  }
}

function preserveRsvpLookupInMenuLinks() {
  const { firstName, lastName } = getSavedRsvpLookupNames();

  if (!firstName || !lastName) {
    return;
  }

  document.querySelectorAll(".section-nav a[href]").forEach((link) => {
    const destination = new URL(link.getAttribute("href"), window.location.href);
    if (destination.origin !== window.location.origin) {
      return;
    }

    destination.searchParams.set("firstName", firstName);
    destination.searchParams.set("lastName", lastName);
    link.href = destination.toString();
  });
}

function syncMobileMenuToggleVisibility() {
  if (!sectionNav) {
    return;
  }

  if (!mobileNavMedia.matches) {
    sectionNav.classList.remove("section-nav--show-toggle");
    return;
  }

  const shouldShowToggle = window.scrollY > 48 || sectionNav.classList.contains("is-menu-open");
  sectionNav.classList.toggle("section-nav--show-toggle", shouldShowToggle);
}

function syncDesktopCompactNav() {
  if (!sectionNav) {
    return;
  }

  if (mobileNavMedia.matches) {
    sectionNav.classList.remove("section-nav--compact");
    return;
  }

  if (!compactDesktopNavMedia.matches || sectionNav.classList.contains("is-menu-open")) {
    sectionNav.classList.remove("section-nav--compact");
    return;
  }

  const navTop = sectionNav.offsetTop;
  const navHeight = sectionNav.offsetHeight;
  const shouldCompact = window.scrollY > navTop + navHeight;
  sectionNav.classList.toggle("section-nav--compact", shouldCompact);
}

function setSectionMenuOpen(isOpen) {
  if (!sectionNav || !sectionMenuToggle) {
    return;
  }

  sectionNav.classList.toggle("is-menu-open", isOpen);
  document.body.classList.toggle("is-nav-open", isOpen);
  sectionMenuToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  syncMobileMenuToggleVisibility();
  syncDesktopCompactNav();
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
      setSectionMenuOpen(false);
      closeAllSubmenus();
    });
  });

  mobileNavMedia.addEventListener("change", (event) => {
    if (!event.matches) {
      setSectionMenuOpen(false);
      closeAllSubmenus();
    }

    syncMobileMenuToggleVisibility();
  });

  compactDesktopNavMedia.addEventListener("change", () => {
    syncDesktopCompactNav();
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
  const clickedMenuControl = sectionMenuToggle?.contains(event.target)
    || sectionMenuPanel?.contains(event.target);

  if (sectionNav?.classList.contains("is-menu-open") && !clickedMenuControl) {
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

window.addEventListener("scroll", syncDesktopCompactNav, { passive: true });
window.addEventListener("scroll", syncMobileMenuToggleVisibility, { passive: true });
window.addEventListener("resize", syncDesktopCompactNav);
window.addEventListener("resize", syncMobileMenuToggleVisibility);
syncMobileMenuToggleVisibility();
syncDesktopCompactNav();

storySliders.forEach((slider) => {
  const viewport = slider.querySelector(".story-slider__viewport");
  const slides = Array.from(slider.querySelectorAll(".story-slider__image"));
  const dots = Array.from(slider.querySelectorAll(".story-slider__dot"));
  let previousButton = slider.querySelector('[data-slider-direction="previous"]');
  let nextButton = slider.querySelector('[data-slider-direction="next"]');
  const intervalMs = Number(slider.dataset.interval) || 2800;

  if (!viewport || slides.length <= 1) {
    return;
  }

  if (!previousButton || !nextButton) {
    const controls = document.createElement("div");
    controls.className = "story-slider__arrows";
    controls.setAttribute("aria-label", "Photo slider navigation");
    controls.innerHTML = `
      <button class="story-slider__arrow story-slider__arrow--previous" type="button" data-slider-direction="previous" aria-label="Previous photo">
        <span aria-hidden="true">‹</span>
      </button>
      <button class="story-slider__arrow story-slider__arrow--next" type="button" data-slider-direction="next" aria-label="Next photo">
        <span aria-hidden="true">›</span>
      </button>
    `;
    slider.append(controls);
    previousButton = controls.querySelector('[data-slider-direction="previous"]');
    nextButton = controls.querySelector('[data-slider-direction="next"]');
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

  previousButton?.addEventListener("click", () => {
    paused = true;
    showSlide(activeIndex - 1);
  });

  nextButton?.addEventListener("click", () => {
    paused = true;
    showSlide(activeIndex + 1);
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

if (rsvpLookupForm && rsvpResponseForm) {
  rsvpLookupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(rsvpLookupForm);
    const firstName = normalizeNamePart(formData.get("firstName"));
    const lastName = normalizeNamePart(formData.get("lastName"));

    await runRsvpLookup(firstName, lastName, { updateUrl: true });
  });

  rsvpResponseForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!HOME_RSVP.scriptUrl) {
      setRsvpStatus(rsvpSubmitStatus, "Add your Apps Script URL in site.js before publishing the RSVP form.", "error");
      return;
    }

    const selectedGroup = rsvpState.selectedGroup;
    if (!selectedGroup) {
      setRsvpStatus(rsvpSubmitStatus, "Choose your invitation first.", "error");
      return;
    }

    const memberInputs = Array.from(rsvpResponseForm.querySelectorAll("[data-rsvp-member-select]"));
    const weddingSelections = memberInputs.reduce((acc, input) => {
      const guestName = input.getAttribute("data-guest-name") || "";
      if (guestName && input.checked) {
        acc[guestName] = input.value;
      }
      return acc;
    }, {});

    if (!Object.keys(weddingSelections).length) {
      setRsvpStatus(rsvpSubmitStatus, "We couldn't find the wedding guest list for this party.", "error");
      return;
    }

    const unansweredWeddingGuest = Object.entries(weddingSelections).find(([, value]) => !value);
    if (unansweredWeddingGuest) {
      setRsvpStatus(rsvpSubmitStatus, `Please choose a wedding response for ${unansweredWeddingGuest[0]}.`, "error");
      return;
    }

    const rehearsalSelect = rsvpResponseForm.elements.namedItem("rehearsalRsvp");
    if (!rsvpRehearsalSection.hidden && !rehearsalSelect.value) {
      setRsvpStatus(rsvpSubmitStatus, "Please choose a rehearsal dinner response.", "error");
      return;
    }

    const openHouseSelect = rsvpResponseForm.elements.namedItem("openHouseRsvp");
    if (!rsvpOpenHouseSection.hidden && !openHouseSelect.value) {
      setRsvpStatus(rsvpSubmitStatus, "Please choose an open house response.", "error");
      return;
    }

    const mobileInput = rsvpResponseForm.elements.namedItem("mobile");
    const smsOptInInput = rsvpResponseForm.elements.namedItem("smsOptIn");
    if (smsOptInInput.checked && !String(mobileInput.value || "").trim()) {
      setRsvpStatus(rsvpSubmitStatus, "Enter a mobile number to receive text-message updates.", "error");
      mobileInput.focus();
      return;
    }

    const submitButton = rsvpResponseForm.querySelector("button[type='submit']");
    submitButton.disabled = true;
    submitButton.textContent = "Sending...";
    setRsvpStatus(rsvpSubmitStatus, "Sending your RSVP...", "pending");

    try {
      const payload = new FormData(rsvpResponseForm);
      payload.set("submittedAt", new Date().toISOString());
      payload.set("formType", "group-rsvp");
      payload.set("lookupFirstName", rsvpState.lookupFirstName);
      payload.set("lookupLastName", rsvpState.lookupLastName);
      payload.set("weddingSelections", JSON.stringify(weddingSelections));

      await fetch(HOME_RSVP.scriptUrl, {
        method: "POST",
        mode: "no-cors",
        body: payload
      });

      setRsvpStatus(rsvpSubmitStatus, "Thank you. Your RSVP has been sent.", "success");
      submitButton.textContent = "Sent";
      window.setTimeout(() => {
        submitButton.textContent = "Send RSVP";
        submitButton.disabled = false;
      }, 1800);
    } catch (error) {
      submitButton.textContent = "Send RSVP";
      submitButton.disabled = false;
      setRsvpStatus(rsvpSubmitStatus, "Something went wrong sending the RSVP. Please try again.", "error");
    }
  });

  rsvpChangePartyButton?.addEventListener("click", () => {
    showRsvpLookupCard();
    hideRsvpEditor();
    hideGroupPicker();
    if (rsvpState.matches.length > 1) {
      renderGroupPicker(rsvpState.matches);
    }
  });

  hydrateRsvpLookupFromUrl();
}

async function runRsvpLookup(firstName, lastName, options = {}) {
  const { updateUrl = false, allowSwapFallback = false } = options;

  if (!firstName || !lastName) {
    setRsvpStatus(rsvpLookupStatus, "Enter both a first name and a last name.", "error");
    return;
  }

  setRsvpStatus(rsvpLookupStatus, "Looking up your invitation...", "pending");

  try {
    let resolvedFirstName = firstName;
    let resolvedLastName = lastName;
    let matches = await loadRsvpLookupMatches(resolvedFirstName, resolvedLastName);

    if (!matches.length && allowSwapFallback) {
      const swappedMatches = await loadRsvpLookupMatches(lastName, firstName);
      if (swappedMatches.length) {
        resolvedFirstName = lastName;
        resolvedLastName = firstName;
        matches = swappedMatches;
        syncRsvpLookupInputs(resolvedFirstName, resolvedLastName);
      }
    }

    rsvpState.lookupFirstName = resolvedFirstName;
    rsvpState.lookupLastName = resolvedLastName;
    rsvpState.matches = matches;
    rsvpState.selectedGroup = null;

    syncRsvpLookupUrl(resolvedFirstName, resolvedLastName, updateUrl);
    hideRsvpEditor();

    if (!matches.length) {
      showRsvpLookupCard();
      hideGroupPicker();
      setRsvpStatus(rsvpLookupStatus, "We couldn't find a matching invitation. Double-check the spelling and try again.", "error");
      return;
    }

    if (matches.length === 1) {
      setRsvpStatus(rsvpLookupStatus, "Invitation found.", "success");
      selectRsvpGroup(matches[0]);
      return;
    }

    renderGroupPicker(matches);
    setRsvpStatus(rsvpLookupStatus, "We found more than one possible invitation. Choose your party below.", "success");
  } catch (error) {
    setRsvpStatus(rsvpLookupStatus, error.message || "Unable to load the RSVP lookup right now.", "error");
  }
}

function hydrateRsvpLookupFromUrl() {
  if (!rsvpLookupForm) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const firstName = normalizeNamePart(params.get("firstName"));
  const lastName = normalizeNamePart(params.get("lastName"));

  if (!firstName || !lastName) {
    return;
  }

  syncRsvpLookupInputs(firstName, lastName);
  void runRsvpLookup(firstName, lastName, { allowSwapFallback: true });
}

function syncRsvpLookupUrl(firstName, lastName, shouldPushState) {
  const url = new URL(window.location.href);
  url.searchParams.set("firstName", firstName);
  url.searchParams.set("lastName", lastName);
  saveRsvpLookupNames(firstName, lastName);

  if (shouldPushState) {
    window.history.pushState({}, "", url);
  } else {
    window.history.replaceState({}, "", url);
  }

  preserveRsvpLookupInMenuLinks();
}

function syncRsvpLookupInputs(firstName, lastName) {
  if (!rsvpLookupForm) {
    return;
  }

  const firstNameInput = rsvpLookupForm.elements.namedItem("firstName");
  const lastNameInput = rsvpLookupForm.elements.namedItem("lastName");

  if (firstNameInput instanceof HTMLInputElement) {
    firstNameInput.value = firstName;
  }

  if (lastNameInput instanceof HTMLInputElement) {
    lastNameInput.value = lastName;
  }
}

preserveRsvpLookupInMenuLinks();

async function loadRsvpLookupMatches(firstName, lastName) {
  if (!HOME_RSVP.scriptUrl) {
    throw new Error("Add your Apps Script URL in site.js before publishing the RSVP form.");
  }

  const payload = await loadRsvpLookupJsonp(firstName, lastName);
  return Array.isArray(payload?.matches) ? payload.matches.map(normalizeLookupMatch) : [];
}

function loadRsvpLookupJsonp(firstName, lastName) {
  return new Promise((resolve, reject) => {
    const callbackName = `homeRsvpLookup${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
    const script = document.createElement("script");
    const url = new URL(HOME_RSVP.scriptUrl);
    url.searchParams.set("lookup", "rsvp");
    url.searchParams.set("firstName", firstName);
    url.searchParams.set("lastName", lastName);
    url.searchParams.set("callback", callbackName);

    window[callbackName] = (data) => {
      cleanup();
      resolve(data || {});
    };

    const cleanup = () => {
      delete window[callbackName];
      script.remove();
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("Unable to load the RSVP lookup right now."));
    };

    script.src = url.toString();
    document.body.appendChild(script);
  });
}

function normalizeLookupGuest(item) {
  const fullName = String(item?.name || "").trim();
  return {
    rowNumber: Number(item?.rowNumber || 0),
    name: fullName,
    firstName: normalizeNamePart(item?.firstName || extractFirstName(fullName)),
    lastName: normalizeNamePart(item?.lastName || extractLastName(fullName)),
    group: String(item?.group || "").trim(),
    type: String(item?.type || "").trim(),
    plusOnesAllowed: normalizeWholeNumber(item?.plusOnesAllowed),
    childrenAllowed: normalizeWholeNumber(item?.childrenAllowed),
    rsvp: String(item?.rsvp || "").trim(),
    plusOneRsvp: String(item?.plusOneRsvp || "").trim()
  };
}

function normalizeLookupGroup(item) {
  return {
    rowNumber: Number(item?.rowNumber || 0),
    group: String(item?.group || "").trim(),
    displayName: String(item?.displayName || item?.group || "").trim(),
    primaryContact: String(item?.primaryContact || "").trim(),
    email: String(item?.email || "").trim(),
    phone: String(item?.phone || "").trim(),
    invitedRehearsal: isTruthyInvitationValue(item?.invitedRehearsal),
    invitedOpenHouse: isTruthyInvitationValue(item?.invitedOpenHouse),
    childrenCount: normalizeWholeNumber(item?.childrenCount),
    maxPlusOnes: normalizeWholeNumber(item?.maxPlusOnes),
    weddingRsvp: normalizeLookupAnswer(item?.weddingRsvp || item?.savedWeddingRsvp),
    rehearsalRsvp: normalizeLookupAnswer(item?.rehearsalRsvp || item?.savedRehearsalRsvp),
    openHouseRsvp: normalizeLookupAnswer(item?.openHouseRsvp || item?.savedOpenHouseRsvp),
    savedEmail: String(item?.savedEmail || item?.email || "").trim(),
    savedComment: String(item?.savedComment || "").trim(),
    savedPlusOneCount: normalizeWholeNumber(item?.savedPlusOneCount),
    savedPlusOneName: String(item?.savedPlusOneName || "").trim(),
    savedChildrenCount: normalizeWholeNumber(item?.savedChildrenCount),
    savedChildrenNote: String(item?.savedChildrenNote || "").trim(),
    notes: String(item?.notes || "").trim(),
    lookupCode: String(item?.lookupCode || "").trim()
  };
}

function normalizeLookupMatch(item) {
  return {
    ...normalizeLookupGroup(item),
    members: Array.isArray(item?.members) ? item.members.map(normalizeLookupGuest) : []
  };
}

function renderGroupPicker(matches) {
  if (!rsvpGroupPicker || !rsvpGroupList) {
    return;
  }

  rsvpGroupList.innerHTML = matches.map((group) => `
    <button class="rsvp-group-button" type="button" data-rsvp-group="${escapeHtml(group.group)}">
      <strong>${escapeHtml(group.displayName || group.group)}</strong>
      <span>${escapeHtml(group.members.map((member) => member.name).join(", "))}</span>
    </button>
  `).join("");

  rsvpGroupList.querySelectorAll("[data-rsvp-group]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextGroup = matches.find((group) => group.group === button.getAttribute("data-rsvp-group"));
      if (nextGroup) {
        selectRsvpGroup(nextGroup);
      }
    });
  });

  rsvpGroupPicker.hidden = false;
}

function hideGroupPicker() {
  if (rsvpGroupPicker) {
    rsvpGroupPicker.hidden = true;
  }
}

function selectRsvpGroup(group) {
  rsvpState.selectedGroup = group;
  hideRsvpLookupCard();
  hideGroupPicker();
  renderRsvpEditor(group);
}

function renderRsvpEditor(group) {
  if (!rsvpEditor || !rsvpResponseForm || !rsvpMembers) {
    return;
  }

  const members = group.members || [];
  const maxPlusOnes = Number(group.maxPlusOnes || 0);
  const childAllowance = Number(group.childrenCount || 0);

  rsvpResponseForm.reset();
  rsvpResponseForm.elements.namedItem("group").value = group.group;
  rsvpResponseForm.elements.namedItem("lookupFirstName").value = rsvpState.lookupFirstName;
  rsvpResponseForm.elements.namedItem("lookupLastName").value = rsvpState.lookupLastName;
  if (rsvpContactName) {
    rsvpContactName.value = group.primaryContact || members[0]?.name || "";
  }
  if (rsvpEmail) {
    rsvpEmail.value = group.savedEmail || group.email || "";
  }
  const commentField = rsvpResponseForm.elements.namedItem("comment");
  if (commentField instanceof HTMLTextAreaElement) {
    commentField.value = group.savedComment || "";
  }

  rsvpMembers.innerHTML = members.map((member) => `
    <article class="rsvp-member-card">
      <div class="rsvp-member-card__head">
        <strong>${escapeHtml(member.name)}</strong>
        <div class="rsvp-choice-pills">
          <label>
            <input type="radio" name="member-${escapeForId(member.name)}" value="attending" data-rsvp-member-select data-guest-name="${escapeHtml(member.name)}">
            <span>Attending</span>
          </label>
          <label>
            <input type="radio" name="member-${escapeForId(member.name)}" value="not-attending" data-rsvp-member-select data-guest-name="${escapeHtml(member.name)}">
            <span>Not attending</span>
          </label>
        </div>
      </div>
    </article>
  `).join("");

  members.forEach((member) => {
    const selectedValue = normalizeLookupAnswer(member.rsvp);
    if (!selectedValue) {
      return;
    }

    const selectedInput = rsvpResponseForm.querySelector(
      `[name="member-${escapeForId(member.name)}"][value="${selectedValue}"]`
    );
    if (selectedInput instanceof HTMLInputElement) {
      selectedInput.checked = true;
    }
  });

  if (group.invitedRehearsal) {
    rsvpRehearsalSection.hidden = false;
    rsvpResponseForm.elements.namedItem("rehearsalRsvp").value = group.rehearsalRsvp || "";
  } else {
    rsvpRehearsalSection.hidden = true;
    rsvpResponseForm.elements.namedItem("rehearsalRsvp").value = "";
  }

  if (group.invitedOpenHouse) {
    rsvpOpenHouseSection.hidden = false;
    rsvpResponseForm.elements.namedItem("openHouseRsvp").value = group.openHouseRsvp || "";
  } else {
    rsvpOpenHouseSection.hidden = true;
    rsvpResponseForm.elements.namedItem("openHouseRsvp").value = "";
  }

  if (rsvpOutOfTownSection) {
    rsvpOutOfTownSection.hidden = rsvpRehearsalSection.hidden && rsvpOpenHouseSection.hidden;
  }

  if (maxPlusOnes > 0) {
    rsvpPlusOneSection.hidden = false;
    rsvpPlusOneCopy.textContent = `Your invitation includes up to ${maxPlusOnes} plus-one${maxPlusOnes === 1 ? "" : "s"}.`;
    fillCountSelect(rsvpPlusOneCount, maxPlusOnes);
    rsvpPlusOneName.placeholder = maxPlusOnes === 1 ? "Optional" : "Optional names";
    rsvpPlusOneCount.value = String(Math.min(group.savedPlusOneCount || 0, maxPlusOnes));
    rsvpPlusOneName.value = group.savedPlusOneName || "";
  } else {
    rsvpPlusOneSection.hidden = true;
    fillCountSelect(rsvpPlusOneCount, 0);
    rsvpPlusOneName.value = "";
  }

  if (childAllowance > 0) {
    rsvpChildrenSection.hidden = false;
    fillCountSelect(rsvpChildrenCount, childAllowance);
    rsvpChildrenCount.value = String(Math.min(group.savedChildrenCount || 0, childAllowance));
  } else {
    rsvpChildrenSection.hidden = true;
    fillCountSelect(rsvpChildrenCount, 0);
  }

  syncRsvpGuestExtrasLayout();

  setRsvpStatus(rsvpSubmitStatus, "", "");
  rsvpEditor.hidden = false;
  rsvpEditor.scrollIntoView({ behavior: "smooth", block: "start" });
}

function hideRsvpEditor() {
  if (rsvpEditor) {
    rsvpEditor.hidden = true;
  }
}

function hideRsvpLookupCard() {
  if (rsvpLookupCard) {
    rsvpLookupCard.hidden = true;
  }
}

function showRsvpLookupCard() {
  if (rsvpLookupCard) {
    rsvpLookupCard.hidden = false;
  }
}

function syncRsvpGuestExtrasLayout() {
  if (!rsvpGuestExtras || !rsvpPlusOneSection || !rsvpChildrenSection) {
    return;
  }

  const showChildrenFullWidth = rsvpPlusOneSection.hidden && !rsvpChildrenSection.hidden;
  const showPlusOneFullWidth = !rsvpPlusOneSection.hidden && rsvpChildrenSection.hidden;
  rsvpGuestExtras.classList.toggle("rsvp-form-grid--children-full", showChildrenFullWidth);
  rsvpGuestExtras.classList.toggle("rsvp-form-grid--plus-one-full", showPlusOneFullWidth);
}

function fillCountSelect(select, maxCount) {
  if (!select) {
    return;
  }

  const safeMax = Math.max(0, Number(maxCount || 0));
  select.innerHTML = Array.from({ length: safeMax + 1 }, (_, index) => (
    `<option value="${index}">${index}</option>`
  )).join("");
}

function setRsvpStatus(element, message, tone = "success") {
  if (!element) {
    return;
  }

  element.textContent = message;
  if (tone) {
    element.dataset.tone = tone;
  } else {
    delete element.dataset.tone;
  }
}

function normalizeLookupAnswer(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return "";
  }

  if (["yes", "y", "attending", "accept", "accepted"].includes(normalized)) {
    return "attending";
  }

  if (["no", "n", "not attending", "declined", "decline"].includes(normalized)) {
    return "not-attending";
  }

  if (normalized === "partial") {
    return "";
  }

  return normalized;
}

function normalizeNamePart(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9'-]+/g, " ");
}

function extractFirstName(fullName) {
  return String(fullName || "").trim().split(/\s+/).filter(Boolean)[0] || "";
}

function extractLastName(fullName) {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "";
}

function normalizeWholeNumber(value) {
  const nextValue = Number(String(value || "").replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(nextValue) || nextValue <= 0) {
    return 0;
  }

  return Math.floor(nextValue);
}

function isTruthyInvitationValue(value) {
  return ["yes", "true", "1", "attending"].includes(String(value || "").trim().toLowerCase());
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeForId(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
