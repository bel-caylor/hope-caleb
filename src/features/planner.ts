import { BED_HEADERS, BEDS_SHEET, EVENT_HEADERS, EVENTS_SHEET, GUESTS_SHEET, PEOPLE_HEADERS, PEOPLE_SHEET, TABLE_HEADERS, TABLES_SHEET, TODO_HEADERS, TODO_SHEET } from "../constants";
import { requirePlannerAccess } from "../auth";
import { createId, ensureSheet, getSheetByName, readRows, toIsoString, upsertRow } from "../util/sheets";

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
  main?: boolean | string;
  date?: string;
  startsAt?: string;
  location?: string;
  assignedTo?: string;
  reminderMinutes?: number | string;
  messageTemplate?: string;
  notes?: string;
  active?: boolean | string;
};

type SaveBedInput = {
  id?: string;
  lodging?: string;
  room?: string;
  bedLabel?: string;
  bedType?: string;
  capacity?: number | string;
  thursday?: string;
  friday?: string;
  notes?: string;
};

type SaveTodoInput = {
  id?: string;
  title?: string;
  notes?: string;
  assignedTo?: string;
  startDate?: string;
  dueDate?: string;
  priority?: string;
  status?: string;
  isComplete?: boolean | string;
  completedAt?: string;
  imageUrl?: string;
  smsMessage?: string;
  reminderDate?: string;
  category?: string;
  tags?: string;
};

type SaveTableInput = {
  id?: string;
  tableName?: string;
  type?: string;
  count?: number | string;
};

type SaveGuestTableAssignmentInput = {
  rowNumber?: number | string;
  tableName?: string;
  tableOrder?: number | string;
};

function normalizeBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === "true" || normalized === "yes" || normalized === "1";
}

function normalizeSheetDate(value: unknown) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }

  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime())
    ? raw
    : Utilities.formatDate(parsed, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function normalizeSheetTime(value: unknown) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "HH:mm");
  }

  const raw = String(value || "").trim();
  if (!raw) return "";

  const twentyFourHourMatch = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (twentyFourHourMatch) {
    const hours = twentyFourHourMatch[1].padStart(2, "0");
    return `${hours}:${twentyFourHourMatch[2]}`;
  }

  const meridiemMatch = raw.match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
  if (meridiemMatch) {
    let hours = Number(meridiemMatch[1]) % 12;
    if (meridiemMatch[3].toUpperCase() === "PM") {
      hours += 12;
    }
    return `${String(hours).padStart(2, "0")}:${meridiemMatch[2]}`;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime())
    ? raw
    : Utilities.formatDate(parsed, Session.getScriptTimeZone(), "HH:mm");
}

function deriveLegacyEventDate(startsAtValue: unknown) {
  const normalizedDate = normalizeSheetDate(startsAtValue);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalizedDate) ? normalizedDate : "";
}

function deriveLegacyEventTime(startsAtValue: unknown) {
  const normalizedTime = normalizeSheetTime(startsAtValue);
  return /^\d{2}:\d{2}$/.test(normalizedTime) ? normalizedTime : normalizedTime;
}

const DEFAULT_BEDS = [
  {
    id: "bed_house_master_king",
    lodging: "House",
    room: "Master Bedroom",
    bedLabel: "King Bed",
    bedType: "King",
    capacity: 2,
    notes: "1 king",
    sortOrder: 10
  },
  {
    id: "bed_house_guest_1_queen",
    lodging: "House",
    room: "Guest Bedroom 1",
    bedLabel: "Queen Bed",
    bedType: "Queen",
    capacity: 2,
    notes: "1 queen",
    sortOrder: 20
  },
  {
    id: "bed_house_guest_2_bunk",
    lodging: "House",
    room: "Guest Bedroom 2",
    bedLabel: "Bunk Bed",
    bedType: "Bunk",
    capacity: 2,
    notes: "Part of room that sleeps 4 total",
    sortOrder: 30
  },
  {
    id: "bed_house_guest_2_trundle",
    lodging: "House",
    room: "Guest Bedroom 2",
    bedLabel: "Trundle Bed",
    bedType: "Trundle",
    capacity: 1,
    notes: "Part of room that sleeps 4 total",
    sortOrder: 40
  },
  {
    id: "bed_house_guest_2_single_sofa",
    lodging: "House",
    room: "Guest Bedroom 2",
    bedLabel: "Single Sofa Bed",
    bedType: "Sofa Bed",
    capacity: 1,
    notes: "Part of room that sleeps 4 total",
    sortOrder: 50
  },
  {
    id: "bed_cabin_2_queen",
    lodging: "Cabin #2",
    room: "Bedroom",
    bedLabel: "Queen Bed",
    bedType: "Queen",
    capacity: 2,
    notes: "Queen bed in separate room",
    sortOrder: 60
  },
  {
    id: "bed_cabin_2_sleeper",
    lodging: "Cabin #2",
    room: "Living Room",
    bedLabel: "Queen Sleeper Sofa",
    bedType: "Sleeper Sofa",
    capacity: 2,
    notes: "Queen sleeper sofa in separate room",
    sortOrder: 70
  },
  {
    id: "bed_cabin_3_queen",
    lodging: "Cabin #3",
    room: "Bedroom",
    bedLabel: "Queen Bed",
    bedType: "Queen",
    capacity: 2,
    notes: "Queen bed in separate room",
    sortOrder: 80
  },
  {
    id: "bed_cabin_3_sleeper",
    lodging: "Cabin #3",
    room: "Living Room",
    bedLabel: "Queen Sleeper Sofa",
    bedType: "Sleeper Sofa",
    capacity: 2,
    notes: "Queen sleeper sofa in separate room",
    sortOrder: 90
  },
  {
    id: "bed_cabin_4_queen",
    lodging: "Cabin #4",
    room: "Bedroom",
    bedLabel: "Queen Bed",
    bedType: "Queen",
    capacity: 2,
    notes: "Queen bed in separate room",
    sortOrder: 100
  },
  {
    id: "bed_cabin_4_sleeper",
    lodging: "Cabin #4",
    room: "Living Room",
    bedLabel: "Queen Sleeper Sofa",
    bedType: "Sleeper Sofa",
    capacity: 2,
    notes: "Queen sleeper sofa in separate room",
    sortOrder: 110
  },
  {
    id: "bed_cabin_5_king",
    lodging: "Cabin #5",
    room: "Bedroom",
    bedLabel: "King Bed",
    bedType: "King",
    capacity: 2,
    notes: "King bed in separate room",
    sortOrder: 120
  },
  {
    id: "bed_cabin_5_sleeper",
    lodging: "Cabin #5",
    room: "Living Room",
    bedLabel: "Queen Sleeper Sofa",
    bedType: "Sleeper Sofa",
    capacity: 2,
    notes: "Queen sleeper sofa in separate room",
    sortOrder: 130
  },
  {
    id: "bed_cabin_6_king",
    lodging: "Cabin #6",
    room: "Bedroom",
    bedLabel: "King Bed",
    bedType: "King",
    capacity: 2,
    notes: "1 king",
    sortOrder: 140
  },
  {
    id: "bed_cabin_9_king",
    lodging: "Cabin #9",
    room: "Bedroom",
    bedLabel: "King Bed",
    bedType: "King",
    capacity: 2,
    notes: "King bed in separate room",
    sortOrder: 150
  },
  {
    id: "bed_cabin_9_sleeper",
    lodging: "Cabin #9",
    room: "Living Room",
    bedLabel: "Queen Sleeper Sofa",
    bedType: "Sleeper Sofa",
    capacity: 2,
    notes: "Queen sleeper sofa in separate room",
    sortOrder: 160
  }
];

const DEFAULT_BED_SORT_ORDER = Object.fromEntries(
  DEFAULT_BEDS.map((bed) => [bed.id, bed.sortOrder])
);

function ensureBedsSheet() {
  const sheet = ensureSheet(BEDS_SHEET, BED_HEADERS);
  if (sheet.getLastRow() > 1) {
    return sheet;
  }

  const now = new Date().toISOString();
  const rows = DEFAULT_BEDS.map((bed) => BED_HEADERS.map((header) => {
    switch (header) {
      case "Id":
        return bed.id;
      case "Lodging":
        return bed.lodging;
      case "Room":
        return bed.room;
      case "BedLabel":
        return bed.bedLabel;
      case "BedType":
        return bed.bedType;
      case "Capacity":
        return bed.capacity;
      case "Thursday":
      case "Friday":
        return "";
      case "Notes":
        return bed.notes;
      default:
        return "";
    }
  }));

  if (rows.length) {
    sheet.getRange(2, 1, rows.length, BED_HEADERS.length).setValues(rows);
  }

  return sheet;
}

export function listPeople() {
  requirePlannerAccess();
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
  requirePlannerAccess();

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
  requirePlannerAccess();
  ensureSheet(EVENTS_SHEET, EVENT_HEADERS);

  return readRows(EVENTS_SHEET)
    .filter((row) => String(row.Title || row.Date || row.StartsAt || "").trim())
    .map((row) => ({
      id: String(row.Id || ""),
      title: String(row.Title || ""),
      main: normalizeBoolean(row.Main),
      date: normalizeSheetDate(row.Date) || deriveLegacyEventDate(row.StartsAt),
      startsAt: normalizeSheetTime(row.StartsAt) || deriveLegacyEventTime(row.StartsAt),
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
  requirePlannerAccess();

  const id = String(input.id || "").trim() || createId("event");
  const now = new Date().toISOString();

  upsertRow(EVENTS_SHEET, EVENT_HEADERS, id, {
    Id: id,
    Title: String(input.title || "").trim(),
    Main: input.main === true || String(input.main).toLowerCase() === "true" ? "TRUE" : "FALSE",
    Date: String(input.date || "").trim(),
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

export function listBeds() {
  requirePlannerAccess();
  ensureBedsSheet();

  return readRows(BEDS_SHEET)
    .filter((row) => String(row.Lodging || row.Room || row.BedLabel || "").trim())
    .map((row) => ({
      id: String(row.Id || ""),
      lodging: String(row.Lodging || ""),
      room: String(row.Room || ""),
      bedLabel: String(row.BedLabel || ""),
      bedType: String(row.BedType || ""),
      capacity: Number(row.Capacity || 0),
      thursday: String(row.Thursday || ""),
      friday: String(row.Friday || ""),
      notes: String(row.Notes || ""),
      sortOrder: Number(row.SortOrder || DEFAULT_BED_SORT_ORDER[String(row.Id || "")] || 0),
      createdAt: toIsoString(row.CreatedAt),
      updatedAt: toIsoString(row.UpdatedAt)
    }));
}

export function saveBed(input: SaveBedInput) {
  requirePlannerAccess();
  ensureBedsSheet();

  const id = String(input.id || "").trim() || createId("bed");

  upsertRow(BEDS_SHEET, BED_HEADERS, id, {
    Id: id,
    Lodging: String(input.lodging || "").trim(),
    Room: String(input.room || "").trim(),
    BedLabel: String(input.bedLabel || "").trim(),
    BedType: String(input.bedType || "").trim(),
    Capacity: Number(input.capacity || 0),
    Thursday: String(input.thursday || "").trim(),
    Friday: String(input.friday || "").trim(),
    Notes: String(input.notes || "").trim(),
  });

  return { ok: true, id };
}

export function listTodos() {
  requirePlannerAccess();
  ensureSheet(TODO_SHEET, TODO_HEADERS);

  return readRows(TODO_SHEET)
    .filter((row) => String(row.Title || row.Notes || row.AssignedTo || row.DueDate || "").trim())
    .map((row) => ({
      id: String(row.Id || ""),
      title: String(row.Title || ""),
      notes: String(row.Notes || ""),
      assignedTo: String(row.AssignedTo || ""),
      startDate: normalizeSheetDate(row.StartDate),
      dueDate: normalizeSheetDate(row.DueDate),
      priority: String(row.Priority || "Medium"),
      status: String(row.Status || "Not Started"),
      isComplete: normalizeBoolean(row.IsComplete) || String(row.Status || "").trim().toLowerCase() === "done",
      completedAt: toIsoString(row.CompletedAt),
      imageUrl: String(row.ImageUrl || ""),
      smsMessage: String(row.SmsMessage || ""),
      reminderDate: normalizeSheetDate(row.ReminderDate),
      category: String(row.Category || ""),
      tags: String(row.Tags || ""),
      createdAt: toIsoString(row.CreatedAt),
      updatedAt: toIsoString(row.UpdatedAt)
    }));
}

export function listTables() {
  requirePlannerAccess();
  ensureSheet(TABLES_SHEET, TABLE_HEADERS);

  return readRows(TABLES_SHEET)
    .filter((row) => String(row["Table Name"] || row.Type || row.Count || "").trim())
    .map((row) => ({
      id: String(row.Id || ""),
      tableName: String(row["Table Name"] || "").trim(),
      type: String(row.Type || "").trim(),
      count: Number(row.Count || 0),
      createdAt: toIsoString(row.CreatedAt),
      updatedAt: toIsoString(row.UpdatedAt)
    }));
}

export function saveTable(input: SaveTableInput) {
  requirePlannerAccess();

  const id = String(input.id || "").trim() || createId("table");
  const now = new Date().toISOString();
  const existing = listTables().find((table) => table.id === id);

  upsertRow(TABLES_SHEET, TABLE_HEADERS, id, {
    Id: id,
    "Table Name": String(input.tableName || "").trim(),
    Type: String(input.type || "").trim(),
    Count: Number(input.count || 0),
    CreatedAt: existing?.createdAt || now,
    UpdatedAt: now
  });

  return { ok: true, id };
}

export function saveGuestTableAssignment(input: SaveGuestTableAssignmentInput) {
  requirePlannerAccess();

  const rowNumber = Number(input.rowNumber || 0);
  if (!Number.isInteger(rowNumber) || rowNumber < 2) {
    throw new Error("Missing guest row number.");
  }

  const guestsSheet = getSheetByName(GUESTS_SHEET);
  if (!guestsSheet || guestsSheet.getLastRow() < 1) {
    throw new Error("Guests sheet not found.");
  }

  const headers = guestsSheet
    .getRange(1, 1, 1, guestsSheet.getLastColumn())
    .getDisplayValues()[0]
    .map((header) => String(header || "").trim().toLowerCase());
  const tableNumberIndex = headers.findIndex((header) => header === "table number" || header === "table #");
  const tableOrderIndex = headers.findIndex((header) => header === "table order");

  if (tableNumberIndex < 0) {
    throw new Error("Guests sheet is missing the Table number column.");
  }

  guestsSheet.getRange(rowNumber, tableNumberIndex + 1).setValue(String(input.tableName || "").trim());
  if (tableOrderIndex >= 0) {
    guestsSheet.getRange(rowNumber, tableOrderIndex + 1).setValue(Number(input.tableOrder || 0) || "");
  }

  return {
    ok: true,
    rowNumber,
    tableName: String(input.tableName || "").trim(),
    tableOrder: Number(input.tableOrder || 0) || 0
  };
}

export function saveTodo(input: SaveTodoInput) {
  requirePlannerAccess();

  const id = String(input.id || "").trim() || createId("todo");
  const now = new Date().toISOString();
  const existing = listTodos().find((todo) => todo.id === id);
  const isComplete = normalizeBoolean(input.isComplete) || String(input.status || "").trim().toLowerCase() === "done";
  const completedAt = isComplete
    ? String(input.completedAt || existing?.completedAt || now).trim()
    : "";

  upsertRow(TODO_SHEET, TODO_HEADERS, id, {
    Id: id,
    Title: String(input.title || "").trim(),
    Notes: String(input.notes || "").trim(),
    AssignedTo: String(input.assignedTo || "").trim(),
    StartDate: String(input.startDate || "").trim(),
    DueDate: String(input.dueDate || "").trim(),
    Priority: String(input.priority || "Medium").trim(),
    Status: String(input.status || (isComplete ? "Done" : "Not Started")).trim(),
    IsComplete: isComplete ? "TRUE" : "FALSE",
    CompletedAt: completedAt,
    ImageUrl: String(input.imageUrl || "").trim(),
    SmsMessage: String(input.smsMessage || "").trim(),
    ReminderDate: String(input.reminderDate || "").trim(),
    Category: String(input.category || "").trim(),
    Tags: String(input.tags || "").trim(),
    CreatedAt: existing?.createdAt || now,
    UpdatedAt: now
  });

  return { ok: true, id };
}

export function initializeBedsSheet() {
  const sheet = ensureBedsSheet();

  return {
    ok: true,
    sheetName: sheet.getName(),
    rowCount: Math.max(sheet.getLastRow() - 1, 0),
    seeded: sheet.getLastRow() > 1
  };
}
