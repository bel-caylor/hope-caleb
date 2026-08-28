import {
  PLANNER_ARCHIVE_HEADERS,
  PLANNER_ARCHIVE_SHEET,
  GUESTS_SHEET,
  PEOPLE_HEADERS,
  PEOPLE_SHEET,
  PLANNER_USERS_SHEET,
  PLANNER_USER_HEADERS,
  PLANNER_V2_ASSETS_SHEET,
  PLANNER_V2_ASSET_HEADERS,
  PLANNER_V2_EVENTS_SHEET,
  PLANNER_V2_EVENT_HEADERS,
  PLANNER_V2_LISTS_SHEET,
  PLANNER_V2_LIST_HEADERS,
  PLANNER_V2_TASKS_SHEET,
  PLANNER_V2_TASK_HEADERS
} from "../constants";
import { getViewerProfile, requirePlannerAccess } from "../auth";
import { createId, deleteRowById, ensureSheet, readRows, upsertRow } from "../util/sheets";
import { listEvents, listTodos } from "./planner";

type WorkspaceAccessLevel = "full_planner" | "contributor" | "wedding_party";

type SaveWorkspaceUserInput = {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  smsOptedIn?: boolean | string;
  weddingRole?: string;
  accessLevel?: WorkspaceAccessLevel | string;
  active?: boolean | string;
};

type SaveWorkspaceEventInput = {
  id?: string;
  title?: string;
  startsAt?: string;
  endsAt?: string;
  location?: string;
  audience?: "private" | "wedding_party" | string;
  assignedUserIds?: string[] | string;
  invitees?: string;
  notes?: string;
};

type SaveWorkspaceTaskInput = {
  id?: string;
  title?: string;
  eventId?: string;
  listId?: string;
  assignedUserId?: string;
  dueAt?: string;
  status?: string;
  priority?: string;
  notes?: string;
  sortOrder?: number | string;
  completedAt?: string;
};

type SaveWorkspaceAssetInput = {
  id?: string;
  title?: string;
  assetUrl?: string;
  assetType?: string;
  eventId?: string;
  taskId?: string;
  visibility?: "private" | "linked" | string;
  notes?: string;
};

type SaveWorkspaceListInput = {
  id?: string;
  eventId?: string;
  title?: string;
  items?: string;
  completedItems?: number[] | string;
  notes?: string;
};

function normalizeAccessLevel(value: unknown): WorkspaceAccessLevel {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "contributor") return "contributor";
  if (normalized === "wedding_party") return "wedding_party";
  return "full_planner";
}

function normalizeBoolean(value: unknown, fallback = true) {
  if (typeof value === "boolean") return value;
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === "true" || normalized === "yes" || normalized === "1";
}

function splitIds(value: unknown) {
  const values = Array.isArray(value) ? value : String(value || "").split(/[\n,;]+/);
  return values.map((item) => String(item || "").trim()).filter(Boolean);
}

function iso(value: unknown) {
  const raw = String(value || "").trim();
  return raw || "";
}

function mapUser(row: Record<string, unknown>) {
  return {
    id: String(row.Id || "").trim(),
    name: String(row.Name || "").trim(),
    email: String(row.Email || "").trim().toLowerCase(),
    phone: String(row.Phone || "").trim(),
    smsOptedIn: normalizeBoolean(row.SmsOptedIn, false),
    weddingRole: String(row.WeddingRole || "").trim(),
    accessLevel: normalizeAccessLevel(row.AccessLevel),
    active: normalizeBoolean(row.Active),
    createdAt: iso(row.CreatedAt),
    updatedAt: iso(row.UpdatedAt)
  };
}

function mapEvent(row: Record<string, unknown>) {
  return {
    id: String(row.Id || "").trim(),
    title: String(row.Title || "").trim(),
    startsAt: iso(row.StartsAt),
    endsAt: iso(row.EndsAt),
    location: String(row.Location || "").trim(),
    audience: String(row.Audience || "private").trim() || "private",
    assignedUserIds: splitIds(row.AssignedUserIds),
    invitees: String(row.Invitees || "").trim(),
    notes: String(row.Notes || "").trim(),
    createdAt: iso(row.CreatedAt),
    updatedAt: iso(row.UpdatedAt)
  };
}

function mapTask(row: Record<string, unknown>) {
  return {
    id: String(row.Id || "").trim(),
    title: String(row.Title || "").trim(),
    eventId: String(row.EventId || "").trim(),
    listId: String(row.ListId || "").trim(),
    assignedUserId: String(row.AssignedUserId || "").trim(),
    dueAt: iso(row.DueAt),
    status: String(row.Status || "Not Started").trim(),
    priority: String(row.Priority || "Medium").trim(),
    notes: String(row.Notes || "").trim(),
    sortOrder: Number(row.SortOrder || 0),
    completedAt: iso(row.CompletedAt),
    createdAt: iso(row.CreatedAt),
    updatedAt: iso(row.UpdatedAt)
  };
}

function mapAsset(row: Record<string, unknown>) {
  return {
    id: String(row.Id || "").trim(),
    title: String(row.Title || "").trim(),
    assetUrl: String(row.AssetUrl || "").trim(),
    assetType: String(row.AssetType || "").trim(),
    eventId: String(row.EventId || "").trim(),
    taskId: String(row.TaskId || "").trim(),
    visibility: String(row.Visibility || "private").trim() || "private",
    notes: String(row.Notes || "").trim(),
    createdAt: iso(row.CreatedAt),
    updatedAt: iso(row.UpdatedAt)
  };
}

function mapList(row: Record<string, unknown>) {
  const completedItems = (() => {
    try {
      const parsed = JSON.parse(String(row.CompletedItems || "[]"));
      return Array.isArray(parsed)
        ? parsed.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item >= 0)
        : [];
    } catch (_) {
      return [];
    }
  })();
  return {
    id: String(row.Id || "").trim(),
    eventId: String(row.EventId || "").trim(),
    title: String(row.Title || "").trim(),
    items: String(row.Items || "").trim(),
    completedItems,
    notes: String(row.Notes || "").trim(),
    createdAt: iso(row.CreatedAt),
    updatedAt: iso(row.UpdatedAt)
  };
}

export function initializePlannerWorkspace() {
  requirePlannerAccess();
  ensureWorkspaceSheets();
  return { ok: true };
}

function ensureWorkspaceSheets() {
  ensureSheet(PLANNER_USERS_SHEET, PLANNER_USER_HEADERS);
  ensureSheet(PLANNER_V2_EVENTS_SHEET, PLANNER_V2_EVENT_HEADERS);
  ensureSheet(PLANNER_V2_TASKS_SHEET, PLANNER_V2_TASK_HEADERS);
  ensureSheet(PLANNER_V2_LISTS_SHEET, PLANNER_V2_LIST_HEADERS);
  ensureSheet(PLANNER_V2_ASSETS_SHEET, PLANNER_V2_ASSET_HEADERS);
  ensureSheet(PLANNER_ARCHIVE_SHEET, PLANNER_ARCHIVE_HEADERS);
}

export function listWorkspaceUsers() {
  const viewer = getWorkspaceViewer();
  ensureWorkspaceSheets();
  const users = readRows(PLANNER_USERS_SHEET).map(mapUser).filter((user) => user.name || user.email);
  if (viewer.accessLevel === "full_planner" || viewer.accessLevel === "contributor") {
    return users;
  }
  return users.filter((user) => user.id === viewer.userId);
}

export function listWorkspaceInvitees() {
  requireWorkspaceManager();
  const groups = new Map<string, string>();
  const guests = new Map<string, { name: string; email: string; phone: string; types: string[] }>();
  readRows(GUESTS_SHEET).forEach((row) => {
    const normalizedFields = Object.fromEntries(Object.entries(row).map(([key, value]) => [key.toLowerCase().replace(/[^a-z0-9]/g, ""), value]));
    const name = String(
      row["Wedding Guest"]
      || row["Guest Name"]
      || row.Name
      || normalizedFields.weddingguest
      || normalizedFields.guestname
      || normalizedFields.name
      || normalizedFields.guest
      || ""
    ).trim();
    const emailField = Object.entries(normalizedFields).find(([key]) => key.includes("email") || key === "googleaccount");
    const phoneField = Object.entries(normalizedFields).find(([key]) => key.includes("phone") || key.includes("mobile") || key.includes("cell"));
    const email = String(
      row.Email
      || normalizedFields.email
      || normalizedFields.emailaddress
      || normalizedFields.googleaccountemail
      || normalizedFields.googleemail
      || emailField?.[1]
      || ""
    ).trim();
    const phone = String(
      row.Phone
      || row["Phone Number"]
      || normalizedFields.phone
      || normalizedFields.phonenumber
      || normalizedFields.mobile
      || normalizedFields.mobilephone
      || normalizedFields.cell
      || normalizedFields.cellphone
      || phoneField?.[1]
      || ""
    ).trim();
    const types = String(row.Type || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    types.forEach((type) => groups.set(type.toLowerCase(), type));
    if (name) {
      const key = name.toLowerCase();
      const existing = guests.get(key);
      guests.set(key, {
        name: existing?.name || name,
        email: existing?.email || email,
        phone: existing?.phone || phone,
        types: [...new Set([...(existing?.types || []), ...types])]
      });
    }
  });
  return {
    groups: [...groups.values()].sort((left, right) => left.localeCompare(right)),
    guests: [...guests.values()].sort((left, right) => left.name.localeCompare(right.name))
  };
}

export function saveWorkspaceUser(input: SaveWorkspaceUserInput) {
  requirePlannerAccess();
  initializePlannerWorkspace();
  const id = String(input.id || "").trim() || createId("workspace_user");
  const name = String(input.name || "").trim();
  const email = String(input.email || "").trim().toLowerCase();
  const active = normalizeBoolean(input.active);
  if (!name) throw new Error("A name is required for each planner contact.");
  if (active && !email) throw new Error("A Google account email is required for an active planner user.");
  const matchingEmail = readRows(PLANNER_USERS_SHEET)
    .map(mapUser)
    .find((user) => email && user.email === email && user.id !== id);
  if (matchingEmail) throw new Error("That Google account is already connected to another planner user.");
  const now = new Date().toISOString();
  const existing = listWorkspaceUsers().find((user) => user.id === id);
  const saved = {
    Id: id,
    Name: name,
    Email: email,
    Phone: String(input.phone || "").trim(),
    SmsOptedIn: normalizeBoolean(input.smsOptedIn, false) ? "TRUE" : "FALSE",
    WeddingRole: String(input.weddingRole || "").trim(),
    AccessLevel: normalizeAccessLevel(input.accessLevel),
    Active: active ? "TRUE" : "FALSE",
    CreatedAt: existing?.createdAt || now,
    UpdatedAt: now
  };
  upsertRow(PLANNER_USERS_SHEET, PLANNER_USER_HEADERS, id, saved);
  return mapUser(saved);
}

export function importLegacyPeopleToWorkspaceUsers() {
  requirePlannerAccess();
  initializePlannerWorkspace();
  ensureSheet(PEOPLE_SHEET, PEOPLE_HEADERS);
  const existingNames = new Set(
    readRows(PLANNER_USERS_SHEET)
      .map(mapUser)
      .map((user) => user.name.toLowerCase())
      .filter(Boolean)
  );
  const now = new Date().toISOString();
  let imported = 0;
  let skipped = 0;

  readRows(PEOPLE_SHEET).forEach((person) => {
    const name = String(person.Name || "").trim();
    if (!name || existingNames.has(name.toLowerCase())) {
      skipped += 1;
      return;
    }
    const consent = String(person.ConsentStatus || "").trim().toLowerCase();
    const smsOptedIn = /^(opted[ -]?in|yes|true)$/i.test(consent);
    const id = createId("workspace_user");
    upsertRow(PLANNER_USERS_SHEET, PLANNER_USER_HEADERS, id, {
      Id: id,
      Name: name,
      Email: "",
      Phone: String(person.Phone || "").trim(),
      SmsOptedIn: smsOptedIn ? "TRUE" : "FALSE",
      WeddingRole: String(person.Role || "").trim(),
      AccessLevel: "wedding_party",
      Active: "FALSE",
      CreatedAt: now,
      UpdatedAt: now
    });
    existingNames.add(name.toLowerCase());
    imported += 1;
  });

  return { imported, skipped };
}

function getWorkspaceViewer() {
  const profile = getViewerProfile();
  if (!profile.signedIn) throw new Error("Please sign in with Google first.");
  if (profile.isAdmin) return { ...profile, accessLevel: "full_planner" as WorkspaceAccessLevel, userId: "" };
  ensureWorkspaceSheets();
  const user = readRows(PLANNER_USERS_SHEET)
    .map(mapUser)
    .find((item) => item.active && item.email === profile.email);
  if (!user) throw new Error("This email has not been invited to the planner yet.");
  return { ...profile, name: user.name || profile.name, accessLevel: user.accessLevel, userId: user.id };
}

function requireWorkspaceManager() {
  const viewer = getWorkspaceViewer();
  if (viewer.accessLevel !== "full_planner") throw new Error("Only full planners can change the shared wedding plan.");
  return viewer;
}

export function getWorkspaceProfile() {
  try {
    return getWorkspaceViewer();
  } catch (_) {
    return { signedIn: false, email: "", name: "", accessLevel: "", userId: "" };
  }
}

export function archiveLegacyPlanningData() {
  requireWorkspaceManager();
  initializePlannerWorkspace();
  const archiveRows = [
    { source: "Events", payload: listEvents() },
    { source: "Todo", payload: listTodos() }
  ];
  const archivedAt = new Date().toISOString();
  archiveRows.forEach((entry) => {
    const id = createId("archive");
    upsertRow(PLANNER_ARCHIVE_SHEET, PLANNER_ARCHIVE_HEADERS, id, {
      Id: id,
      ArchivedAt: archivedAt,
      Source: entry.source,
      Payload: JSON.stringify(entry.payload)
    });
  });
  return { ok: true, archivedAt, sources: archiveRows.map((entry) => entry.source) };
}

export function listWorkspaceEvents() {
  const viewer = getWorkspaceViewer();
  const events = readRows(PLANNER_V2_EVENTS_SHEET).map(mapEvent).filter((event) => event.title);
  if (viewer.accessLevel === "full_planner" || viewer.accessLevel === "contributor") return events;
  return events.filter((event) => event.audience === "wedding_party" || event.assignedUserIds.includes(viewer.userId));
}

export function saveWorkspaceEvent(input: SaveWorkspaceEventInput) {
  requireWorkspaceManager();
  initializePlannerWorkspace();
  const id = String(input.id || "").trim() || createId("workspace_event");
  const now = new Date().toISOString();
  const existing = readRows(PLANNER_V2_EVENTS_SHEET).map(mapEvent).find((event) => event.id === id);
  const saved = {
    Id: id,
    Title: String(input.title || "").trim(),
    StartsAt: String(input.startsAt || "").trim(),
    EndsAt: String(input.endsAt || "").trim(),
    Location: String(input.location || "").trim(),
    Audience: String(input.audience || "private").trim() || "private",
    AssignedUserIds: splitIds(input.assignedUserIds).join(", "),
    Invitees: String(input.invitees || existing?.invitees || "").trim(),
    Notes: String(input.notes || "").trim(),
    CreatedAt: existing?.createdAt || now,
    UpdatedAt: now
  };
  upsertRow(PLANNER_V2_EVENTS_SHEET, PLANNER_V2_EVENT_HEADERS, id, saved);
  return mapEvent(saved);
}

export function listWorkspaceTasks() {
  const viewer = getWorkspaceViewer();
  const tasks = readRows(PLANNER_V2_TASKS_SHEET).map(mapTask).filter((task) => task.title);
  const visibleTasks = viewer.accessLevel === "full_planner" || viewer.accessLevel === "contributor"
    ? tasks
    : tasks.filter((task) => task.assignedUserId === viewer.userId);
  return visibleTasks.sort((left, right) => {
    const leftOrder = Number(left.sortOrder || 0);
    const rightOrder = Number(right.sortOrder || 0);
    if (left.eventId === right.eventId && leftOrder !== rightOrder) return leftOrder - rightOrder;
    return 0;
  });
}

export function saveWorkspaceTask(input: SaveWorkspaceTaskInput) {
  const viewer = getWorkspaceViewer();
  const id = String(input.id || "").trim() || createId("workspace_task");
  const existing = readRows(PLANNER_V2_TASKS_SHEET).map(mapTask).find((task) => task.id === id);
  const ownsExistingTask = existing?.assignedUserId === viewer.userId;
  const isCompletionOnly = Boolean(existing) && ownsExistingTask && String(input.status || existing.status).trim().toLowerCase() === "done";
  if (viewer.accessLevel !== "full_planner" && viewer.accessLevel !== "contributor" && !isCompletionOnly) {
    throw new Error("You can only complete tasks assigned to you.");
  }
  initializePlannerWorkspace();
  const now = new Date().toISOString();
  const status = String(input.status || existing?.status || "Not Started").trim();
  const eventId = String(input.eventId || existing?.eventId || "").trim();
  const listId = Object.prototype.hasOwnProperty.call(input, "listId")
    ? String(input.listId || "").trim()
    : String(existing?.listId || "").trim();
  const assignedUserId = Object.prototype.hasOwnProperty.call(input, "assignedUserId")
    ? String(input.assignedUserId || "").trim()
    : String(existing?.assignedUserId || "").trim();
  const requestedSortOrder = Number(input.sortOrder);
  const sortOrder = Number.isFinite(requestedSortOrder) && requestedSortOrder > 0
    ? requestedSortOrder
    : Number(existing?.sortOrder || 0) || readRows(PLANNER_V2_TASKS_SHEET)
      .map(mapTask)
      .filter((task) => task.eventId === eventId)
      .reduce((highest, task) => Math.max(highest, Number(task.sortOrder || 0)), 0) + 1;
  const saved = {
    Id: id,
    Title: String(input.title || existing?.title || "").trim(),
    EventId: eventId,
    ListId: listId,
    AssignedUserId: assignedUserId,
    DueAt: String(input.dueAt || existing?.dueAt || "").trim(),
    Status: status,
    Priority: String(input.priority || existing?.priority || "Medium").trim(),
    Notes: String(input.notes || existing?.notes || "").trim(),
    SortOrder: sortOrder,
    CreatedAt: existing?.createdAt || now,
    UpdatedAt: now,
    CompletedAt: status.toLowerCase() === "done" ? String(input.completedAt || existing?.completedAt || now).trim() : ""
  };
  upsertRow(PLANNER_V2_TASKS_SHEET, PLANNER_V2_TASK_HEADERS, id, saved);
  return mapTask(saved);
}

export function deleteWorkspaceTask(input: { id?: string }) {
  requireWorkspaceManager();
  const id = String(input.id || "").trim();
  if (!id) throw new Error("Missing task id.");
  deleteRowById(PLANNER_V2_TASKS_SHEET, PLANNER_V2_TASK_HEADERS, id);
  return { ok: true, id };
}

export function listWorkspaceLists() {
  const viewer = getWorkspaceViewer();
  const accessibleEventIds = new Set(listWorkspaceEvents().map((event) => event.id));
  const lists = readRows(PLANNER_V2_LISTS_SHEET).map(mapList).filter((list) => list.title || list.items);
  if (viewer.accessLevel === "full_planner" || viewer.accessLevel === "contributor") return lists;
  return lists.filter((list) => accessibleEventIds.has(list.eventId));
}

export function saveWorkspaceList(input: SaveWorkspaceListInput) {
  requireWorkspaceManager();
  initializePlannerWorkspace();
  const id = String(input.id || "").trim() || createId("workspace_list");
  const now = new Date().toISOString();
  const existing = readRows(PLANNER_V2_LISTS_SHEET).map(mapList).find((list) => list.id === id);
  const completedItems = Array.isArray(input.completedItems)
    ? input.completedItems.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item >= 0)
    : existing?.completedItems || [];
  const saved = {
    Id: id,
    EventId: String(input.eventId || existing?.eventId || "").trim(),
    Title: String(input.title || existing?.title || "").trim(),
    Items: String(input.items || existing?.items || "").trim(),
    CompletedItems: JSON.stringify([...new Set(completedItems)].sort((left, right) => left - right)),
    Notes: String(input.notes || existing?.notes || "").trim(),
    CreatedAt: existing?.createdAt || now,
    UpdatedAt: now
  };
  upsertRow(PLANNER_V2_LISTS_SHEET, PLANNER_V2_LIST_HEADERS, id, saved);
  return mapList(saved);
}

export function setWorkspaceListItemCompleted(input: { id?: string; itemIndex?: number | string; completed?: boolean | string }) {
  const viewer = getWorkspaceViewer();
  initializePlannerWorkspace();
  const id = String(input.id || "").trim();
  const itemIndex = Number(input.itemIndex);
  if (!id || !Number.isInteger(itemIndex) || itemIndex < 0) throw new Error("Missing list item.");

  const existing = readRows(PLANNER_V2_LISTS_SHEET).map(mapList).find((list) => list.id === id);
  if (!existing) throw new Error("List not found.");
  const canAccessList = viewer.accessLevel === "full_planner" || viewer.accessLevel === "contributor"
    || listWorkspaceEvents().some((event) => event.id === existing.eventId);
  if (!canAccessList) throw new Error("You do not have access to this list.");

  const items = existing.items.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  if (itemIndex >= items.length) throw new Error("List item not found.");
  const completed = normalizeBoolean(input.completed, false);
  const completedItems = new Set(existing.completedItems);
  if (completed) completedItems.add(itemIndex);
  else completedItems.delete(itemIndex);

  const now = new Date().toISOString();
  const saved = {
    Id: existing.id,
    EventId: existing.eventId,
    Title: existing.title,
    Items: existing.items,
    CompletedItems: JSON.stringify([...completedItems].sort((left, right) => left - right)),
    Notes: existing.notes,
    CreatedAt: existing.createdAt || now,
    UpdatedAt: now
  };
  upsertRow(PLANNER_V2_LISTS_SHEET, PLANNER_V2_LIST_HEADERS, id, saved);
  return mapList(saved);
}

export function deleteWorkspaceList(input: { id?: string }) {
  requireWorkspaceManager();
  const id = String(input.id || "").trim();
  if (!id) throw new Error("Missing list id.");
  deleteRowById(PLANNER_V2_LISTS_SHEET, PLANNER_V2_LIST_HEADERS, id);
  return { ok: true, id };
}

export function listWorkspaceAssets() {
  const viewer = getWorkspaceViewer();
  const assets = readRows(PLANNER_V2_ASSETS_SHEET).map(mapAsset).filter((asset) => asset.title || asset.assetUrl);
  if (viewer.accessLevel === "full_planner" || viewer.accessLevel === "contributor") return assets;
  const visibleEventIds = new Set(listWorkspaceEvents().map((event) => event.id));
  const visibleTaskIds = new Set(listWorkspaceTasks().map((task) => task.id));
  return assets.filter((asset) => asset.visibility === "linked" && (visibleEventIds.has(asset.eventId) || visibleTaskIds.has(asset.taskId)));
}

export function saveWorkspaceAsset(input: SaveWorkspaceAssetInput) {
  requireWorkspaceManager();
  initializePlannerWorkspace();
  const id = String(input.id || "").trim() || createId("workspace_asset");
  const now = new Date().toISOString();
  const existing = readRows(PLANNER_V2_ASSETS_SHEET).map(mapAsset).find((asset) => asset.id === id);
  const saved = {
    Id: id,
    Title: String(input.title || "").trim(),
    AssetUrl: String(input.assetUrl || "").trim(),
    AssetType: String(input.assetType || "").trim(),
    EventId: String(input.eventId || "").trim(),
    TaskId: String(input.taskId || "").trim(),
    Visibility: String(input.visibility || "private").trim() || "private",
    Notes: String(input.notes || "").trim(),
    CreatedAt: existing?.createdAt || now,
    UpdatedAt: now
  };
  upsertRow(PLANNER_V2_ASSETS_SHEET, PLANNER_V2_ASSET_HEADERS, id, saved);
  return mapAsset(saved);
}

export function deleteWorkspaceAsset(input: { id?: string }) {
  requireWorkspaceManager();
  const id = String(input.id || "").trim();
  if (!id) throw new Error("Missing task snapshot id.");
  deleteRowById(PLANNER_V2_ASSETS_SHEET, PLANNER_V2_ASSET_HEADERS, id);
  return { ok: true, id };
}

/**
 * Supplies a task image through the authenticated planner API. Drive thumbnail
 * URLs are not dependable across browsers because they may require Google
 * session cookies, even when the file is link-shared.
 */
export function getWorkspaceAssetImage(input: { id?: string }) {
  const id = String(input?.id || "").trim();
  if (!id) throw new Error("Missing task snapshot id.");

  const asset = listWorkspaceAssets().find((item) => item.id === id);
  if (!asset) throw new Error("Task snapshot was not found or is not available to you.");

  const fileId = extractDriveFileId(asset.assetUrl);
  if (!fileId) throw new Error("This task snapshot does not have a usable Drive file.");

  const blob = DriveApp.getFileById(fileId).getBlob();
  const contentType = String(blob.getContentType() || "image/jpeg").toLowerCase();
  if (!contentType.startsWith("image/")) throw new Error("The task snapshot is not an image.");

  return {
    dataUrl: `data:${contentType};base64,${Utilities.base64Encode(blob.getBytes())}`
  };
}

function extractDriveFileId(value: string) {
  const raw = String(value || "").trim();
  const queryMatch = raw.match(/[?&]id=([^&#]+)/i);
  if (queryMatch?.[1]) return decodeURIComponent(queryMatch[1]);
  const pathMatch = raw.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return pathMatch?.[1] || "";
}
