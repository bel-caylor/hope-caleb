const RPC_URL = "https://hope-caleb-wedding-planner-proxy.belinda-caylor.workers.dev";
const SESSION_KEY = "hope-caleb-dashboard-session-token";
const AUTH_KEY = "hope-caleb-dashboard-auth-token";
const form = document.querySelector("#slideForm");
const imageInput = document.querySelector("#slideImage");
const captionInput = document.querySelector("#slideCaption");
const preview = document.querySelector("#slidePreview");
const statusEl = document.querySelector("#slideStatus");
const list = document.querySelector("#slidesList");
const refreshButton = document.querySelector("#refreshSlides");
let slides = [];
let previewUrl = "";

imageInput.addEventListener("change", showPreview);
form.addEventListener("submit", saveSlide);
refreshButton.addEventListener("click", loadSlides);
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
      <img src="${escapeHtml(slide.imageUrl)}" alt="Slideshow photo ${index + 1}">
      <div><small>Slide ${index + 1}</small><p>${escapeHtml(slide.caption || "No caption")}</p></div>
      <div class="slide-actions"><button type="button" data-move="${slide.id}" data-direction="-1" aria-label="Move slide up" ${index === 0 ? "disabled" : ""}>↑</button><button type="button" data-move="${slide.id}" data-direction="1" aria-label="Move slide down" ${index === slides.length - 1 ? "disabled" : ""}>↓</button><button class="delete" type="button" data-delete="${slide.id}">Delete</button></div>
    </article>`).join("");
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

async function handleListAction(event) {
  const deleteButton = event.target.closest("[data-delete]");
  const moveButton = event.target.closest("[data-move]");
  try {
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
  const image = await loadImage(file);
  const scale = Math.min(1, 1920 / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas"); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", .88));
  if (!blob) throw new Error("The selected photo could not be prepared.");
  return { data: await blobToDataUrl(blob), contentType: "image/jpeg", fileName: `${file.name.replace(/\.[^.]+$/, "") || "rehearsal-photo"}.jpg` };
}
function loadImage(file) { return new Promise((resolve, reject) => { const image = new Image(); const url = URL.createObjectURL(file); image.onload = () => { URL.revokeObjectURL(url); resolve(image); }; image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("The selected file is not a usable image.")); }; image.src = url; }); }
function blobToDataUrl(blob) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error("The selected photo could not be read.")); reader.readAsDataURL(blob); }); }
function setStatus(message, kind = "") { statusEl.textContent = message; statusEl.className = `status ${kind}`; }
function escapeHtml(value) { return String(value || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"); }
