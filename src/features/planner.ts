import { EVENT_HEADERS, EVENTS_SHEET, PEOPLE_HEADERS, PEOPLE_SHEET } from "../constants";
import { requireAdmin } from "../auth";
import { createId, ensureSheet, readRows, toIsoString, upsertRow } from "../util/sheets";

type SavePersonInput = {
  id?: string;
  name?: string;
  phone?: string;
  role?: string;
  groupName?: string;
  consentStatus?: string;
  notes?: string;
};

type SaveEventInput = {
  id?: string;
  title?: string;
  startsAt?: string;
  location?: string;
  assignedTo?: string;
  reminderMinutes?: number | string;
  messageTemplate?: string;
  notes?: string;
  active?: boolean | string;
};

export function listPeople() {
  requireAdmin();
  ensureSheet(PEOPLE_SHEET, PEOPLE_HEADERS);

  return readRows(PEOPLE_SHEET)
    .filter((row) => String(row.Name || row.Phone || "").trim())
    .map((row) => ({
      id: String(row.Id || ""),
      name: String(row.Name || ""),
      phone: String(row.Phone || ""),
      role: String(row.Role || ""),
      groupName: String(row.GroupName || ""),
      consentStatus: String(row.ConsentStatus || ""),
      notes: String(row.Notes || ""),
      createdAt: toIsoString(row.CreatedAt),
      updatedAt: toIsoString(row.UpdatedAt)
    }));
}

export function savePerson(input: SavePersonInput) {
  requireAdmin();

  const id = String(input.id || "").trim() || createId("person");
  const now = new Date().toISOString();
  const existing = listPeople().find((person) => person.id === id);

  upsertRow(PEOPLE_SHEET, PEOPLE_HEADERS, id, {
    Id: id,
    Name: String(input.name || "").trim(),
    Phone: String(input.phone || "").trim(),
    Role: String(input.role || "").trim(),
    GroupName: String(input.groupName || "").trim(),
    ConsentStatus: String(input.consentStatus || "invited").trim(),
    Notes: String(input.notes || "").trim(),
    CreatedAt: existing?.createdAt || now,
    UpdatedAt: now
  });

  return { ok: true, id };
}

export function listEvents() {
  requireAdmin();
  ensureSheet(EVENTS_SHEET, EVENT_HEADERS);

  return readRows(EVENTS_SHEET)
    .filter((row) => String(row.Title || row.StartsAt || "").trim())
    .map((row) => ({
      id: String(row.Id || ""),
      title: String(row.Title || ""),
      startsAt: toIsoString(row.StartsAt),
      location: String(row.Location || ""),
      assignedTo: String(row.AssignedTo || ""),
      reminderMinutes: Number(row.ReminderMinutes || 15),
      messageTemplate: String(row.MessageTemplate || ""),
      notes: String(row.Notes || ""),
      active: String(row.Active || "TRUE").toLowerCase() !== "false",
      updatedAt: toIsoString(row.UpdatedAt)
    }));
}

export function saveEvent(input: SaveEventInput) {
  requireAdmin();

  const id = String(input.id || "").trim() || createId("event");
  const now = new Date().toISOString();

  upsertRow(EVENTS_SHEET, EVENT_HEADERS, id, {
    Id: id,
    Title: String(input.title || "").trim(),
    StartsAt: String(input.startsAt || "").trim(),
    Location: String(input.location || "").trim(),
    AssignedTo: String(input.assignedTo || "").trim(),
    ReminderMinutes: Number(input.reminderMinutes || 15),
    MessageTemplate: String(input.messageTemplate || "").trim(),
    Notes: String(input.notes || "").trim(),
    Active: input.active === false || String(input.active).toLowerCase() === "false" ? "FALSE" : "TRUE",
    UpdatedAt: now
  });

  return { ok: true, id };
}
