const RPC_URL = "https://hope-caleb-wedding-planner-proxy.belinda-caylor.workers.dev";
const GOOGLE_CLIENT_ID = "1013045170295-uqapcrbk5aie1megfqa8jk62t87b2kha.apps.googleusercontent.com";
const GOOGLE_PHOTOS_SCOPE = "https://www.googleapis.com/auth/photospicker.mediaitems.readonly";
const SESSION_KEY = "hope-caleb-dashboard-session-token";
const AUTH_KEY = "hope-caleb-dashboard-auth-token";
const form = document.querySelector("#slideForm");
const imageInput = document.querySelector("#slideImage");
const captionInput = document.querySelector("#slideCaption");
const preview = document.querySelector("#slidePreview");
const statusEl = document.querySelector("#slideStatus");
const list = document.querySelector("#slidesList");
const refreshButton = document.querySelector("#refreshSlides");
const chooseGooglePhotosButton = document.querySelector("#chooseGooglePhotos");
let slides = [];
let previewUrl = "";

imageInput.addEventListener("change", showPreview);
form.addEventListener("submit", saveSlide);
refreshButton.addEventListener("click", loadSlides);
chooseGooglePhotosButton.addEventListener("click", chooseGooglePhotos);
list.addEventListener("click", handleListAction);
loadSlides();

function getAuthToken() {
  return String(localStorage.getItem(SESSION_KEY) || localStorage.getItem(AUTH_KEY) || sessionStorage.getItem(AUTH_KEY) || "").trim();
}

async function request(method, payload) {
  const token = getAuthToken();
  if (!token) throw new Error("Open this page from the planner after signing in with Google.");
  const response = await fetch(RPC_URL, { method: "POST", credentials: "include", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ method, payload, authToken: token }) });
  const result = await response.json();
  if (result?.sessionToken) localStorage.setItem(SESSION_KEY, String(result.sessionToken));
  if (!result?.ok) throw new Error(String(result?.error || "Unable to update the slideshow."));
  return result.data;
}

async function loadSlides() {
  list.innerHTML = '<p class="empty">Loading slideshow photos…</p>';
  try { slides = await request("listRehearsalSlides", {}); renderSlides(); }
  catch (error) { list.innerHTML = `<p class="empty">${escapeHtml(error.message)}</p>`; }
}

function renderSlides() {
  if (!slides.length) { list.innerHTML = '<p class="empty">No photos yet. Add the first one above.</p>'; return; }
  list.innerHTML = slides.map((slide, index) => `
    <article class="slide-item">
      <img src="${escapeHtml(displaySlideImage(slide))}" data-rehearsal-slide-image="${escapeHtml(slide.id)}" alt="Slideshow photo ${index + 1}">
      <div><small>Slide ${index + 1}</small><label class="slide-caption-label">Caption<textarea data-caption="${escapeHtml(slide.id)}" rows="2" maxlength="280" placeholder="Add a caption…">${escapeHtml(slide.caption || "")}</textarea></label></div>
      <div class="slide-actions"><button class="secondary" type="button" data-save-caption="${slide.id}">Save caption</button><button type="button" data-move="${slide.id}" data-direction="-1" aria-label="Move slide up" ${index === 0 ? "disabled" : ""}>↑</button><button type="button" data-move="${slide.id}" data-direction="1" aria-label="Move slide down" ${index === slides.length - 1 ? "disabled" : ""}>↓</button><button class="delete" type="button" data-delete="${slide.id}">Delete</button></div>
    </article>`).join("");
  void hydrateSlideImages();
}

async function hydrateSlideImages() {
  const images = Array.from(list.querySelectorAll("[data-rehearsal-slide-image]"));
  await Promise.all(images.map(async (image) => {
    try {
      const response = await request("getRehearsalSlideImage", { id: image.dataset.rehearsalSlideImage });
      if (String(response?.dataUrl || "").startsWith("data:image/")) image.src = response.dataUrl;
    } catch (_) { /* Keep the direct Drive link as a fallback. */ }
  }));
}

async function showPreview() {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  const file = imageInput.files?.[0];
  if (!file) { preview.hidden = true; preview.replaceChildren(); return; }
  previewUrl = URL.createObjectURL(file);
  preview.innerHTML = `<img src="${previewUrl}" alt="Selected photo preview">`;
  preview.hidden = false;
}

async function saveSlide(event) {
  event.preventDefault();
  const file = imageInput.files?.[0];
  if (!file) return;
  setStatus("Preparing photo…");
  form.querySelector("button[type=submit]").disabled = true;
  try {
    const prepared = await prepareImage(file);
    setStatus("Uploading photo…");
    const uploaded = await request("uploadRehearsalSlideImage", prepared);
    await request("saveRehearsalSlide", { imageUrl: uploaded.imageUrl, driveFileId: uploaded.fileId, caption: captionInput.value, sortOrder: slides.length });
    form.reset();
    await showPreview();
    setStatus("Photo added to the slideshow.", "success");
    await loadSlides();
  } catch (error) { setStatus(error.message || "Unable to save this photo.", "error"); }
  finally { form.querySelector("button[type=submit]").disabled = false; }
}

async function chooseGooglePhotos() {
  if (!window.google?.accounts?.oauth2) {
    setStatus("Google Photos is still loading. Please try again in a moment.", "error");
    return;
  }
  const pickerWindow = window.open("", "hope-caleb-google-photos", "popup,width=620,height=720");
  if (pickerWindow) {
    pickerWindow.document.title = "Google Photos";
    pickerWindow.document.body.innerHTML = "<p style='font:16px system-ui;padding:2rem'>Connecting to Google Photos…</p>";
  }
  chooseGooglePhotosButton.disabled = true;
  setStatus("Connecting to Google Photos…");
  try {
    const accessToken = await withTimeout(requestGooglePhotosAccessToken(), 45_000, "Google Photos permission did not finish. Close the extra window, verify the API setup, and try again.");
    const session = await googlePhotosRequest("https://photospicker.googleapis.com/v1/sessions", accessToken, { method: "POST", body: JSON.stringify({ pickingConfig: { maxItemCount: 100 } }) });
    if (!session?.pickerUri || !session?.id) throw new Error("Google Photos did not create a picker session.");
    const pickerUrl = session.pickerUri;
    if (!pickerWindow) throw new Error("Your browser blocked the Google Photos window. Allow popups for this site, then try again.");
    pickerWindow.location.href = pickerUrl;
    setStatus("Choose your photos in the Google Photos window, then tap Done. Keep that window open until importing begins here.");
    const pickedItems = await waitForPickedPhotos(session, accessToken);
    if (!pickedItems.length) { setStatus("No Google Photos were selected."); return; }
    setStatus(`Importing ${pickedItems.length} photo${pickedItems.length === 1 ? "" : "s"}…`);
    await saveGooglePhotos(pickedItems, accessToken);
    setStatus(`${pickedItems.length} photo${pickedItems.length === 1 ? "" : "s"} added to the slideshow.`, "success");
    await loadSlides();
  } catch (error) {
    setStatus(error.message || "Unable to import Google Photos.", "error");
  } finally {
    chooseGooglePhotosButton.disabled = false;
  }
}

function requestGooglePhotosAccessToken() {
  return new Promise((resolve, reject) => {
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: GOOGLE_PHOTOS_SCOPE,
      callback: (response) => response?.access_token ? resolve(response.access_token) : reject(new Error(response?.error || "Google Photos permission was not granted.")),
      error_callback: (error) => reject(new Error(error?.message || "Google Photos permission window could not open."))
    });
    tokenClient.requestAccessToken({ prompt: "consent" });
  });
}

async function googlePhotosRequest(url, accessToken, options = {}) {
  const response = await fetch(url, { ...options, headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...(options.headers || {}) } });
  if (!response.ok) {
    const details = await response.json().catch(() => ({}));
    throw new Error(details?.error?.message || "Google Photos could not complete that request.");
  }
  return response.status === 204 ? null : response.json();
}

async function waitForPickedPhotos(session, accessToken) {
  const interval = Math.max(2000, durationToMilliseconds(session.pollingConfig?.pollInterval, 3000));
  const deadline = Date.now() + Math.max(60_000, durationToMilliseconds(session.pollingConfig?.timeoutIn, 15 * 60_000));
  while (Date.now() < deadline) {
    await delay(interval);
    const current = await googlePhotosRequest(`https://photospicker.googleapis.com/v1/sessions/${encodeURIComponent(session.id)}`, accessToken);
    if (!current.mediaItemsSet) continue;
    const items = await googlePhotosRequest(`https://photospicker.googleapis.com/v1/mediaItems?sessionId=${encodeURIComponent(session.id)}`, accessToken);
    await googlePhotosRequest(`https://photospicker.googleapis.com/v1/sessions/${encodeURIComponent(session.id)}`, accessToken, { method: "DELETE" }).catch(() => null);
    return Array.isArray(items.mediaItems) ? items.mediaItems.filter((item) => String(item.mimeType || item.mediaFile?.mimeType || "").startsWith("image/")) : [];
  }
  throw new Error("Google Photos selection timed out. Please try again.");
}

async function saveGooglePhotos(items, accessToken) {
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const baseUrl = String(item.mediaFile?.baseUrl || item.baseUrl || "").trim();
    if (!baseUrl) continue;
    const response = await fetch(`${baseUrl}=w1920-h1920`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) throw new Error("A selected Google Photo could not be downloaded.");
    const fileName = String(item.filename || `google-photo-${index + 1}.jpg`);
    const prepared = await prepareImageBlob(await response.blob(), fileName);
    const uploaded = await request("uploadRehearsalSlideImage", prepared);
    await request("saveRehearsalSlide", { imageUrl: uploaded.imageUrl, driveFileId: uploaded.fileId, caption: "", sortOrder: slides.length + index });
  }
}

function delay(milliseconds) { return new Promise((resolve) => window.setTimeout(resolve, milliseconds)); }
function withTimeout(promise, milliseconds, message) { return Promise.race([promise, new Promise((_, reject) => window.setTimeout(() => reject(new Error(message)), milliseconds))]); }
function durationToMilliseconds(value, fallback) { const match = String(value || "").trim().match(/^(\d+(?:\.\d+)?)(ms|s|m|h)?$/i); if (!match) return fallback; const multiplier = { ms: 1, s: 1000, m: 60_000, h: 3_600_000 }[String(match[2] || "s").toLowerCase()] || 1000; return Number(match[1]) * multiplier; }

async function handleListAction(event) {
  const deleteButton = event.target.closest("[data-delete]");
  const moveButton = event.target.closest("[data-move]");
  const saveCaptionButton = event.target.closest("[data-save-caption]");
  try {
    if (saveCaptionButton) {
      const slide = slides.find((item) => item.id === saveCaptionButton.dataset.saveCaption);
      const input = list.querySelector(`[data-caption="${CSS.escape(String(slide?.id || ""))}"]`);
      if (!slide || !input) return;
      saveCaptionButton.disabled = true;
      const saved = await request("saveRehearsalSlide", { id: slide.id, caption: input.value });
      slide.caption = String(saved?.caption ?? input.value).trim();
      setStatus("Caption saved.", "success");
      saveCaptionButton.disabled = false;
      return;
    }
    if (deleteButton) {
      const slide = slides.find((item) => item.id === deleteButton.dataset.delete);
      if (!slide || !confirm("Delete this photo from the rehearsal slideshow?")) return;
      deleteButton.disabled = true;
      await request("deleteRehearsalSlide", { id: slide.id });
      slides = slides.filter((item) => item.id !== slide.id);
      await saveOrder();
      renderSlides();
    }
    if (moveButton) {
      const index = slides.findIndex((item) => item.id === moveButton.dataset.move);
      const nextIndex = index + Number(moveButton.dataset.direction);
      if (index < 0 || nextIndex < 0 || nextIndex >= slides.length) return;
      [slides[index], slides[nextIndex]] = [slides[nextIndex], slides[index]];
      renderSlides();
      await saveOrder();
    }
  } catch (error) { setStatus(error.message || "Unable to update the slideshow.", "error"); await loadSlides(); }
}

async function saveOrder() { await Promise.all(slides.map((slide, index) => request("saveRehearsalSlide", { id: slide.id, sortOrder: index }))); }

async function prepareImage(file) {
  return prepareImageBlob(file, file.name);
}
async function prepareImageBlob(blob, fileName) {
  const image = await loadImage(blob);
  const scale = Math.min(1, 1920 / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas"); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  const outputBlob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", .88));
  if (!outputBlob) throw new Error("The selected photo could not be prepared.");
  return { data: await blobToDataUrl(outputBlob), contentType: "image/jpeg", fileName: `${String(fileName || "rehearsal-photo").replace(/\.[^.]+$/, "") || "rehearsal-photo"}.jpg` };
}
function loadImage(file) { return new Promise((resolve, reject) => { const image = new Image(); const url = URL.createObjectURL(file); image.onload = () => { URL.revokeObjectURL(url); resolve(image); }; image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("The selected file is not a usable image.")); }; image.src = url; }); }
function blobToDataUrl(blob) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error("The selected photo could not be read.")); reader.readAsDataURL(blob); }); }
function setStatus(message, kind = "") { statusEl.textContent = message; statusEl.className = `status ${kind}`; }
function escapeHtml(value) { return String(value || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"); }
function displaySlideImage(slide) { return slide.driveFileId ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(slide.driveFileId)}&sz=w1600` : String(slide.imageUrl || ""); }
