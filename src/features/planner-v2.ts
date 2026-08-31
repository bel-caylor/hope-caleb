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
import { getViewerProfile, invalidatePlannerAccessCache, requirePlannerAccess } from "../auth";
import { createId, deleteRowById, ensureSheet, getSheetByName, readRows, upsertRow } from "../util/sheets";
import { listEvents, listTodos } from "./planner";

type WorkspaceAccessLevel = "full_planner" | "contributor" | "wedding_party";

type SaveWorkspaceUserInput = {
  id?: string;
  guestId?: string;
  name?: string;
  email?: string;
  phone?: string;
  smsOptedIn?: boolean | string;
  weddingRole?: string;
  accessLevel?: WorkspaceAccessLevel | string;
  active?: boolean | string;
};

type GuestContact = {
  rowNumber: number;
  id: string;
  name: string;
  email: string;
  phone: string;
  smsOptedIn: boolean;
  smsConsentRecordedAt: string;
  types: string[];
};

type TaskAssignmentContext = {
  guests: GuestContact[];
  users: Array<ReturnType<typeof mapUser>>;
};

const GUEST_CONTACT_HEADERS = [
  "Guest Id",
  "Email",
  "Phone Number",
  "SMS Opted In",
  "SMS Consent Recorded At"
];

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
  assignedUserIds?: string[] | string;
  dueAt?: string;
  status?: string;
  priority?: string;
  notes?: string;
  sortOrder?: number | string;
  completedAt?: string;
};

const DEFAULT_TASK_DUE_AT = "2027-01-08";

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
  const seen = new Set<string>();
  return values.map((item) => String(item || "").trim()).filter(Boolean).filter((item) => {
    const key = item.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Task assignees have historically been stored as a planner-user id, a
 * display-name token (guest:Jane), or a guest-type token.  Individual guests
 * now always use their immutable Guest Id, while group tokens stay groups.
 */
function normalizeTaskAssignmentIds(value: unknown, context?: TaskAssignmentContext) {
  const values = splitIds(value);
  if (!context) return values;

  const guestsById = new Map(context.guests.map((guest) => [guest.id.toLowerCase(), guest]));
  const guestsByName = new Map(context.guests.map((guest) => [guest.name.toLowerCase(), guest]));
  const usersById = new Map(context.users.map((user) => [user.id.toLowerCase(), user]));

  return splitIds(values.map((value) => {
    const raw = String(value || "").trim();
    const normalized = raw.toLowerCase();
    if (!raw || normalized.startsWith("guest-type:")) return raw;

    const user = usersById.get(normalized);
    if (user?.guestId && guestsById.has(user.guestId.toLowerCase())) {
      return `guest:${guestsById.get(user.guestId.toLowerCase())!.id}`;
    }

    const individualValue = normalized.startsWith("guest:") ? raw.slice("guest:".length).trim() : raw;
    const guest = guestsById.get(individualValue.toLowerCase()) || guestsByName.get(individualValue.toLowerCase());
    return guest?.id ? `guest:${guest.id}` : raw;
  }));
}

/** Keep planner names consistent without changing intentional acronyms such as "AI" or "UTSA". */
function toTitleCase(value: unknown) {
  return String(value || "").trim().replace(/\S+/g, (word) => {
    if (word === word.toUpperCase() && /[A-Z]/.test(word)) return word;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

function iso(value: unknown) {
  const raw = String(value || "").trim();
  return raw || "";
}

function mapUser(row: Record<string, unknown>, guest?: GuestContact) {
  return {
    id: String(row.Id || "").trim(),
    guestId: String(row.GuestId || "").trim(),
    // Existing records retain their old values only until the admin runs the
    // one-time guest sync. Afterwards every contact value comes from Guests.
    name: guest?.name || String(row.Name || "").trim(),
    email: guest?.email || String(row.Email || "").trim().toLowerCase(),
    phone: guest?.phone || String(row.Phone || "").trim(),
    smsOptedIn: guest ? guest.smsOptedIn : normalizeBoolean(row.SmsOptedIn, false),
    smsConsentRecordedAt: guest?.smsConsentRecordedAt || "",
    weddingRole: String(row.WeddingRole || "").trim(),
    accessLevel: normalizeAccessLevel(row.AccessLevel),
    active: normalizeBoolean(row.Active),
    createdAt: iso(row.CreatedAt),
    updatedAt: iso(row.UpdatedAt)
  };
}

function normalizedHeader(value: unknown) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function firstGuestValue(row: Record<string, unknown>, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const entry = Object.entries(row).find(([key, value]) => pattern.test(normalizedHeader(key)) && String(value || "").trim());
    if (entry) return String(entry[1] || "").trim();
  }
  return "";
}

function ensureGuestContactColumns() {
  const sheet = getSheetByName(GUESTS_SHEET);
  if (!sheet || sheet.getLastRow() < 1) throw new Error("Guests sheet not found.");
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].map((value) => String(value || "").trim());
  GUEST_CONTACT_HEADERS.forEach((header) => {
    if (headers.some((existing) => existing.toLowerCase() === header.toLowerCase())) return;
    const column = sheet.getLastColumn() + 1;
    sheet.getRange(1, column).setValue(header);
    headers.push(header);
  });
  return { sheet, headers };
}

function listGuestContacts(assignMissingIds = false): GuestContact[] {
  // Loading the dashboard must be read-only. Adding columns or generating an
  // ID for every guest belongs to the explicit migration/save path, never to
  // the normal planner bootstrap.
  const existingSheet = getSheetByName(GUESTS_SHEET);
  if (!existingSheet || existingSheet.getLastRow() < 1) throw new Error("Guests sheet not found.");
  const source = assignMissingIds
    ? ensureGuestContactColumns()
    : {
      sheet: existingSheet,
      headers: existingSheet.getRange(1, 1, 1, existingSheet.getLastColumn()).getDisplayValues()[0]
        .map((value) => String(value || "").trim())
    };
  const { sheet, headers } = source;
  const values = sheet.getDataRange().getValues();
  const indexFor = (header: string) => headers.findIndex((item) => item.toLowerCase() === header.toLowerCase());
  const guestIdIndex = indexFor("Guest Id");
  const contacts: GuestContact[] = [];
  values.slice(1).forEach((valuesRow, index) => {
    if (!valuesRow.some((value) => String(value || "").trim())) return;
    const row = Object.fromEntries(headers.map((header, column) => [header, valuesRow[column]]));
    let id = guestIdIndex >= 0 ? String(valuesRow[guestIdIndex] || "").trim() : "";
    if (!id && assignMissingIds) {
      id = createId("guest");
      sheet.getRange(index + 2, guestIdIndex + 1).setValue(id);
    }
    const name = firstGuestValue(row, [/^weddingguest$/, /^guest$/, /^name$/, /guestname/, /fullname/]);
    if (!name) return;
    contacts.push({
      rowNumber: index + 2,
      id,
      name,
      email: firstGuestValue(row, [/^email$/, /emailaddress/, /^googleaccountemail$/, /^googleemail$/]).toLowerCase(),
      phone: firstGuestValue(row, [/^phonenumber$/, /^phone$/, /^mobilenumber$/, /^mobile$/, /cell/]),
      smsOptedIn: normalizeBoolean(firstGuestValue(row, [/^smsoptedin$/, /^textconsent$/, /^smsconsent$/]), false),
      smsConsentRecordedAt: firstGuestValue(row, [/^smsconsentrecordedat$/]),
      types: String(row.Type || "").split(",").map((item) => item.trim()).filter(Boolean)
    });
  });
  return contacts;
}

function saveGuestContact(input: SaveWorkspaceUserInput, guest: GuestContact) {
  const { sheet, headers } = ensureGuestContactColumns();
  const column = (name: string) => headers.findIndex((header) => header.toLowerCase() === name.toLowerCase()) + 1;
  const email = String(input.email || "").trim().toLowerCase();
  const phone = String(input.phone || "").trim();
  // Access edits must never silently revoke RSVP consent. Only update consent
  // when the caller explicitly supplies a value.
  const smsOptedIn = input.smsOptedIn === undefined
    ? guest.smsOptedIn
    : normalizeBoolean(input.smsOptedIn, false);
  sheet.getRange(guest.rowNumber, column("Email")).setValue(email);
  sheet.getRange(guest.rowNumber, column("Phone Number")).setValue(phone);
  sheet.getRange(guest.rowNumber, column("SMS Opted In")).setValue(smsOptedIn ? "TRUE" : "FALSE");
  sheet.getRange(guest.rowNumber, column("SMS Consent Recorded At")).setValue(smsOptedIn ? (guest.smsConsentRecordedAt || new Date().toISOString()) : "");
  return listGuestContacts().find((item) => item.id === guest.id) || guest;
}

function mapEvent(row: Record<string, unknown>) {
  return {
    id: String(row.Id || "").trim(),
    title: toTitleCase(row.Title),
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

/**
 * Event invitations are stored as either the current JSON group/individual
 * selection or an older comma-separated list of names. Keep both formats
 * readable so access does not depend on a front-end migration.
 */
function parseEventInvitees(value: unknown) {
  const raw = String(value || "").trim();
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      const selection = parsed as { groups?: unknown; individuals?: unknown };
      return {
        groups: Array.isArray(selection.groups) ? selection.groups.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean) : [],
        individuals: Array.isArray(selection.individuals) ? selection.individuals.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean) : []
      };
    }
  } catch (_) {
    // Older events saved names as plain text; treat those as individuals.
  }
  return { groups: [], individuals: raw.split(/[\n,;]+/).map((item) => item.trim().toLowerCase()).filter(Boolean) };
}

function eventIncludesWeddingPartyViewer(event: ReturnType<typeof mapEvent>, viewer: ReturnType<typeof getWorkspaceViewer>, guest?: GuestContact) {
  if (event.assignedUserIds.includes(viewer.userId)) return true;

  const { groups, individuals } = parseEventInvitees(event.invitees);
  const viewerNames = [guest?.name, viewer.name]
    .map((name) => String(name || "").trim().toLowerCase())
    .filter(Boolean);
  const viewerGroups = (guest?.types || []).map((type) => type.trim().toLowerCase()).filter(Boolean);
  return viewerNames.some((name) => individuals.includes(name)) || viewerGroups.some((group) => groups.includes(group));
}

function taskIsAssignedToWorkspaceViewer(task: ReturnType<typeof mapTask>, viewer: ReturnType<typeof getWorkspaceViewer>) {
  const assignedUserIds = task.assignedUserIds.map((id) => id.toLowerCase());
  if (!assignedUserIds.length) return false;
  const viewerAssignments = [
    viewer.userId,
    viewer.guestId,
    viewer.guestId ? `guest:${viewer.guestId}` : "",
    // Retain this fallback for an unmigrated guest row with no Guest Id.
    viewer.name ? `guest:${viewer.name}` : ""
  ].map((value) => String(value || "").trim().toLowerCase()).filter(Boolean);
  if (assignedUserIds.some((id) => viewerAssignments.includes(id))) return true;
  const guest = listGuestContacts().find((item) => item.id === String(viewer.guestId || "").trim());
  const groupAssignments = new Set(assignedUserIds
    .filter((id) => id.startsWith("guest-type:"))
    .map((id) => id.slice("guest-type:".length)));
  return (guest?.types || []).some((type) => groupAssignments.has(type.trim().toLowerCase()));
}

function mapTask(row: Record<string, unknown>, assignmentContext?: TaskAssignmentContext) {
  const assignedUserIds = normalizeTaskAssignmentIds(row.AssignedUserId, assignmentContext);
  return {
    id: String(row.Id || "").trim(),
    title: toTitleCase(row.Title),
    eventId: String(row.EventId || "").trim(),
    listId: String(row.ListId || "").trim(),
    assignedUserIds,
    assignedUserId: assignedUserIds[0] || "",
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
    title: toTitleCase(row.Title),
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

function getTaskAssignmentContext(assignMissingGuestIds = false): TaskAssignmentContext {
  const guests = listGuestContacts(assignMissingGuestIds);
  const guestsById = new Map(guests.map((guest) => [guest.id, guest]));
  const users = readRows(PLANNER_USERS_SHEET)
    .map((row) => mapUser(row, guestsById.get(String(row.GuestId || "").trim())))
    .filter((user) => user.id);
  return { guests, users };
}

/** Convert historical task assignee values to immutable guest-id tokens. */
export function normalizeWorkspaceTaskAssignments() {
  requireWorkspaceManager();
  initializePlannerWorkspace();
  const context = getTaskAssignmentContext(true);
  const now = new Date().toISOString();
  let updated = 0;
  let unresolved = 0;

  readRows(PLANNER_V2_TASKS_SHEET).forEach((row) => {
    const id = String(row.Id || "").trim();
    if (!id) return;
    const original = splitIds(row.AssignedUserId);
    const normalized = normalizeTaskAssignmentIds(original, context);
    const originalKey = original.map((value) => value.toLowerCase()).join(",");
    const normalizedKey = normalized.map((value) => value.toLowerCase()).join(",");
    unresolved += normalized.filter((value) => {
      const lower = value.toLowerCase();
      return !lower.startsWith("guest:") && !lower.startsWith("guest-type:");
    }).length;
    if (originalKey === normalizedKey) return;
    upsertRow(PLANNER_V2_TASKS_SHEET, PLANNER_V2_TASK_HEADERS, id, {
      ...row,
      Id: id,
      AssignedUserId: normalized.join(", "),
      UpdatedAt: now
    });
    updated += 1;
  });

  return { updated, unresolved, guestCount: context.guests.length };
}

export function listWorkspaceUsers() {
  const viewer = getWorkspaceViewer();
  ensureWorkspaceSheets();
  const guestsById = new Map(listGuestContacts().map((guest) => [guest.id, guest]));
  const users = readRows(PLANNER_USERS_SHEET).map((row) => mapUser(row, guestsById.get(String(row.GuestId || "").trim()))).filter((user) => user.name || user.email);
  if (viewer.accessLevel === "full_planner" || viewer.accessLevel === "contributor") {
    return users;
  }
  return users.filter((user) => user.id === viewer.userId);
}

export function listWorkspaceInvitees() {
  requireWorkspaceManager();
  const groups = new Map<string, string>();
  const guests = listGuestContacts();
  guests.forEach((guest) => guest.types.forEach((type) => groups.set(type.toLowerCase(), type)));
  return {
    groups: [...groups.values()].sort((left, right) => left.localeCompare(right)),
    guests: guests.sort((left, right) => left.name.localeCompare(right.name))
  };
}

export function saveWorkspaceUser(input: SaveWorkspaceUserInput) {
  requirePlannerAccess();
  initializePlannerWorkspace();
  const id = String(input.id || "").trim() || createId("workspace_user");
  const guestId = String(input.guestId || "").trim();
  const guest = listGuestContacts(true).find((item) => item.id === guestId);
  if (!guest?.name) throw new Error("Choose a guest before giving planner access.");
  const email = String(input.email || guest.email || "").trim().toLowerCase();
  const phone = String(input.phone || guest.phone || "").trim();
  if (!email || !phone) throw new Error("This guest needs a Google account email and mobile number before planner access can be granted.");
  const guestsById = new Map(listGuestContacts().map((item) => [item.id, item]));
  const matchingEmail = readRows(PLANNER_USERS_SHEET)
    .map((row) => mapUser(row, guestsById.get(String(row.GuestId || "").trim())))
    .find((user) => email && user.email === email && user.id !== id);
  if (matchingEmail) throw new Error("That Google account is already connected to another planner user.");
  const now = new Date().toISOString();
  const existing = listWorkspaceUsers().find((user) => user.id === id);
  const saved = {
    Id: id,
    GuestId: guest.id,
    WeddingRole: guest.types.join(", "),
    AccessLevel: normalizeAccessLevel(input.accessLevel),
    Active: "TRUE",
    CreatedAt: existing?.createdAt || now,
    UpdatedAt: now
  };
  const savedGuest = email === guest.email && phone === guest.phone
    ? guest
    : saveGuestContact({ email, phone }, guest);
  upsertRow(PLANNER_USERS_SHEET, PLANNER_USER_HEADERS, id, saved);
  invalidatePlannerAccessCache();
  return mapUser(saved, savedGuest);
}

/** Safely converts existing Planner Users rows to guest-linked access rows. */
export function syncPlannerUsersToGuests() {
  requirePlannerAccess();
  initializePlannerWorkspace();
  const guests = listGuestContacts(true);
  const guestsByName = new Map(guests.map((guest) => [guest.name.toLowerCase(), guest]));
  let linked = 0;
  let unmatched = 0;
  readRows(PLANNER_USERS_SHEET).forEach((row) => {
    const existingGuestId = String(row.GuestId || "").trim();
    const guest = guests.find((item) => item.id === existingGuestId)
      || guestsByName.get(String(row.Name || "").trim().toLowerCase());
    if (!guest) {
      unmatched += 1;
      return;
    }
    saveGuestContact({
      email: String(row.Email || "").trim() || guest.email,
      phone: String(row.Phone || "").trim() || guest.phone,
      smsOptedIn: String(row.SmsOptedIn || "").trim() || guest.smsOptedIn
    }, guest);
    upsertRow(PLANNER_USERS_SHEET, PLANNER_USER_HEADERS, String(row.Id || "").trim(), {
      ...row,
      GuestId: guest.id,
      UpdatedAt: new Date().toISOString()
    });
    linked += 1;
  });
  invalidatePlannerAccessCache();
  return { linked, unmatched, guestCount: guests.length };
}

export function importLegacyPeopleToWorkspaceUsers() {
  requirePlannerAccess();
  initializePlannerWorkspace();
  ensureSheet(PEOPLE_SHEET, PEOPLE_HEADERS);
  const existingNames = new Set(
    readRows(PLANNER_USERS_SHEET)
      .map((row) => mapUser(row))
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
  if (profile.isAdmin) return { ...profile, accessLevel: "full_planner" as WorkspaceAccessLevel, userId: "", guestId: "" };
  ensureWorkspaceSheets();
  const guestsById = new Map(listGuestContacts().map((guest) => [guest.id, guest]));
  const user = readRows(PLANNER_USERS_SHEET)
    .map((row) => mapUser(row, guestsById.get(String(row.GuestId || "").trim())))
    .find((item) => item.active && item.email === profile.email);
  if (!user) throw new Error("This email has not been invited to the planner yet.");
  return { ...profile, name: user.name || profile.name, accessLevel: user.accessLevel, userId: user.id, guestId: user.guestId };
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
    return { signedIn: false, email: "", name: "", accessLevel: "", userId: "", guestId: "" };
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
  const guest = listGuestContacts().find((item) => item.id === String(viewer.guestId || "").trim());
  return events.filter((event) => eventIncludesWeddingPartyViewer(event, viewer, guest));
}

export function saveWorkspaceEvent(input: SaveWorkspaceEventInput) {
  requireWorkspaceManager();
  initializePlannerWorkspace();
  const id = String(input.id || "").trim() || createId("workspace_event");
  const now = new Date().toISOString();
  const existing = readRows(PLANNER_V2_EVENTS_SHEET).map(mapEvent).find((event) => event.id === id);
  const saved = {
    Id: id,
    Title: toTitleCase(input.title),
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

export function deleteWorkspaceEvent(input: { id?: string }) {
  requireWorkspaceManager();
  const id = String(input.id || "").trim();
  if (!id) throw new Error("Missing event id.");

  const taskIds = readRows(PLANNER_V2_TASKS_SHEET)
    .map((row) => mapTask(row))
    .filter((task) => task.eventId === id)
    .map((task) => task.id);
  readRows(PLANNER_V2_ASSETS_SHEET)
    .map(mapAsset)
    .filter((asset) => asset.eventId === id || taskIds.includes(asset.taskId))
    .forEach((asset) => deleteRowById(PLANNER_V2_ASSETS_SHEET, PLANNER_V2_ASSET_HEADERS, asset.id));
  taskIds.forEach((taskId) => deleteRowById(PLANNER_V2_TASKS_SHEET, PLANNER_V2_TASK_HEADERS, taskId));
  readRows(PLANNER_V2_LISTS_SHEET)
    .map(mapList)
    .filter((list) => list.eventId === id)
    .forEach((list) => deleteRowById(PLANNER_V2_LISTS_SHEET, PLANNER_V2_LIST_HEADERS, list.id));
  deleteRowById(PLANNER_V2_EVENTS_SHEET, PLANNER_V2_EVENT_HEADERS, id);
  return { ok: true, id };
}

export function listWorkspaceTasks() {
  const viewer = getWorkspaceViewer();
  const assignmentContext = getTaskAssignmentContext();
  const tasks = readRows(PLANNER_V2_TASKS_SHEET).map((row) => mapTask(row, assignmentContext)).filter((task) => task.title);
  const visibleTasks = viewer.accessLevel === "full_planner" || viewer.accessLevel === "contributor"
    ? tasks
    : tasks.filter((task) => taskIsAssignedToWorkspaceViewer(task, viewer));
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
  const assignmentContext = getTaskAssignmentContext();
  const existing = readRows(PLANNER_V2_TASKS_SHEET).map((row) => mapTask(row, assignmentContext)).find((task) => task.id === id);
  const ownsExistingTask = existing ? taskIsAssignedToWorkspaceViewer(existing, viewer) : false;
  const isCompletionOnly = existing ? ownsExistingTask && String(input.status || existing.status).trim().toLowerCase() === "done" : false;
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
  const assignedUserIds = normalizeTaskAssignmentIds(Object.prototype.hasOwnProperty.call(input, "assignedUserIds")
    ? splitIds(input.assignedUserIds)
    : Object.prototype.hasOwnProperty.call(input, "assignedUserId")
      ? splitIds(input.assignedUserId)
      : existing?.assignedUserIds || splitIds(existing?.assignedUserId), assignmentContext);
  const dueAt = Object.prototype.hasOwnProperty.call(input, "dueAt")
    ? String(input.dueAt || "").trim()
    : String(existing?.dueAt || "").trim();
  const requestedSortOrder = Number(input.sortOrder);
  const sortOrder = Number.isFinite(requestedSortOrder) && requestedSortOrder > 0
    ? requestedSortOrder
    : Number(existing?.sortOrder || 0) || readRows(PLANNER_V2_TASKS_SHEET)
      .map((row) => mapTask(row, assignmentContext))
      .filter((task) => task.eventId === eventId)
      .reduce((highest, task) => Math.max(highest, Number(task.sortOrder || 0)), 0) + 1;
  const saved = {
    Id: id,
    Title: toTitleCase(input.title || existing?.title),
    EventId: eventId,
    ListId: listId,
    AssignedUserId: assignedUserIds.join(", "),
    DueAt: dueAt || (!existing ? DEFAULT_TASK_DUE_AT : ""),
    Status: status,
    Priority: String(input.priority || existing?.priority || "Medium").trim(),
    Notes: String(input.notes || existing?.notes || "").trim(),
    SortOrder: sortOrder,
    CreatedAt: existing?.createdAt || now,
    UpdatedAt: now,
    CompletedAt: status.toLowerCase() === "done" ? String(input.completedAt || existing?.completedAt || now).trim() : ""
  };
  upsertRow(PLANNER_V2_TASKS_SHEET, PLANNER_V2_TASK_HEADERS, id, saved);
  return mapTask(saved, assignmentContext);
}

/** Update only a task's completion state so assignees cannot alter its other details. */
export function setWorkspaceTaskCompleted(input: { id?: string; completed?: boolean | string }) {
  const viewer = getWorkspaceViewer();
  initializePlannerWorkspace();
  const id = String(input.id || "").trim();
  if (!id) throw new Error("Missing task id.");

  const assignmentContext = getTaskAssignmentContext();
  const existing = readRows(PLANNER_V2_TASKS_SHEET).map((row) => mapTask(row, assignmentContext)).find((task) => task.id === id);
  if (!existing) throw new Error("Task not found.");
  const canComplete = viewer.accessLevel === "full_planner" || taskIsAssignedToWorkspaceViewer(existing, viewer);
  if (!canComplete) throw new Error("Only a full planner or the assigned person can complete this task.");

  const completed = normalizeBoolean(input.completed, false);
  const now = new Date().toISOString();
  const saved = {
    Id: existing.id,
    Title: existing.title,
    EventId: existing.eventId,
    ListId: existing.listId,
    AssignedUserId: existing.assignedUserIds.join(", "),
    DueAt: existing.dueAt,
    Status: completed ? "Done" : "Not Started",
    Priority: existing.priority,
    Notes: existing.notes,
    SortOrder: existing.sortOrder,
    CreatedAt: existing.createdAt || now,
    UpdatedAt: now,
    CompletedAt: completed ? now : ""
  };
  upsertRow(PLANNER_V2_TASKS_SHEET, PLANNER_V2_TASK_HEADERS, id, saved);
  return mapTask(saved, assignmentContext);
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
    Title: toTitleCase(input.title || existing?.title),
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
