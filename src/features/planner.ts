import { BED_HEADERS, BEDS_SHEET, EVENT_HEADERS, EVENT_LIST_HEADERS, EVENT_LISTS_SHEET, EVENTS_SHEET, GUESTS_SHEET, PEOPLE_HEADERS, PEOPLE_SHEET, SHOT_HEADERS, SHOTS_SHEET, TABLE_HEADERS, TABLES_SHEET, TODO_HEADERS, TODO_SHEET } from "../constants";
import { requirePlannerAccess } from "../auth";
import { createId, deleteRowById, ensureSheet, getSheetByName, readRows, toIsoString, upsertRow } from "../util/sheets";

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
  endsAt?: string;
  location?: string;
  assignedTo?: string;
  assignedPeople?: string;
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

type SaveShotInput = {
  id?: string;
  eventId?: string;
  title?: string;
  description?: string;
  peopleNeeded?: string;
  priority?: string;
  sortOrder?: number | string;
  notes?: string;
  isComplete?: boolean | string;
  completedAt?: string;
};

type SaveTodoInput = {
  id?: string;
  eventId?: string;
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

type UploadTodoImageInput = {
  data?: string;
  contentType?: string;
  fileName?: string;
  taskTitle?: string;
};

type SaveEventListInput = {
  id?: string;
  eventId?: string;
  title?: string;
  type?: string;
  items?: string;
  notes?: string;
};

type SaveTableInput = {
  id?: string;
  tableName?: string;
  location?: string;
  order?: number | string;
  type?: string;
  count?: number | string;
};

type SaveTableReservedOpenSeatsInput = {
  id?: string;
  reservedOpenSeatPositions?: string | number[] | string[];
};

type SaveGuestTableAssignmentInput = {
  rowNumber?: number | string;
  tableName?: string;
  tableOrder?: number | string;
};

type SaveGuestTableAssignmentsInput = {
  assignments?: SaveGuestTableAssignmentInput[];
};

type SaveGuestDetailsInput = {
  rowNumber?: number | string;
  type?: string;
  rsvp?: string;
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

function mapPersonRow(row: Record<string, unknown>) {
  return {
    id: String(row.Id || ""),
    name: String(row.Name || ""),
    phone: String(row.Phone || ""),
    role: String(row.Role || ""),
    groupName: String(row.GroupName || ""),
    consentStatus: String(row.ConsentStatus || ""),
    notes: String(row.Notes || ""),
    createdAt: toIsoString(row.CreatedAt),
    updatedAt: toIsoString(row.UpdatedAt)
  };
}

function mapEventRow(row: Record<string, unknown>) {
  return {
    id: String(row.Id || ""),
    title: String(row.Title || ""),
    main: normalizeBoolean(row.Main),
    date: normalizeSheetDate(row.Date) || deriveLegacyEventDate(row.StartsAt),
    startsAt: normalizeSheetTime(row.StartsAt) || deriveLegacyEventTime(row.StartsAt),
    endsAt: normalizeSheetTime(row.EndsAt),
    location: String(row.Location || ""),
    assignedTo: String(row.AssignedTo || ""),
    assignedPeople: String(row.AssignedPeople || ""),
    reminderMinutes: Number(row.ReminderMinutes || 15),
    messageTemplate: String(row.MessageTemplate || ""),
    notes: String(row.Notes || ""),
    active: String(row.Active || "TRUE").toLowerCase() !== "false",
    updatedAt: toIsoString(row.UpdatedAt)
  };
}

function mapShotRow(row: Record<string, unknown>) {
  return {
    id: String(row.Id || ""),
    eventId: String(row.EventId || "").trim(),
    title: String(row.Title || "").trim(),
    description: String(row.Description || "").trim(),
    peopleNeeded: String(row.PeopleNeeded || "").trim(),
    priority: String(row.Priority || "Medium").trim(),
    sortOrder: Number(row.SortOrder || 0),
    notes: String(row.Notes || "").trim(),
    isComplete: normalizeBoolean(row.IsComplete),
    completedAt: toIsoString(row.CompletedAt),
    createdAt: toIsoString(row.CreatedAt),
    updatedAt: toIsoString(row.UpdatedAt)
  };
}

function mapBedRow(row: Record<string, unknown>) {
  return {
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
  };
}

function mapTodoRow(row: Record<string, unknown>) {
  return {
    id: String(row.Id || ""),
    eventId: String(row.EventId || "").trim(),
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
  };
}

function mapEventListRow(row: Record<string, unknown>) {
  return {
    id: String(row.Id || "").trim(),
    eventId: String(row.EventId || "").trim(),
    title: String(row.Title || "").trim(),
    type: String(row.Type || "shopping").trim(),
    items: String(row.Items || "").trim(),
    notes: String(row.Notes || "").trim(),
    createdAt: toIsoString(row.CreatedAt),
    updatedAt: toIsoString(row.UpdatedAt)
  };
}

function mapTableRow(row: Record<string, unknown>) {
  const rawLocation = String(row.Location || "").trim();
  const rawType = String(row.Type || "").trim();
  const normalizedLegacySide = normalizeLegacyTableSide(rawType);

  return {
    id: String(row.Id || ""),
    tableName: String(row["Table Name"] || "").trim(),
    location: rawLocation || normalizedLegacySide,
    order: Number(row.Order || 0),
    type: rawLocation ? rawType : normalizedLegacySide ? "" : rawType,
    count: Number(row.Count || 0),
    reservedOpenSeatPositions: String(row["Reserved Open Seat Positions"] || "").trim(),
    createdAt: toIsoString(row.CreatedAt),
    updatedAt: toIsoString(row.UpdatedAt)
  };
}

function normalizeLegacyTableSide(value: string) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return "";
  }
  if (normalized.includes("bar")) {
    return "Bar Side";
  }
  if (normalized.includes("food")) {
    return "Food Side";
  }
  if (normalized.includes("head") || normalized.includes("center")) {
    return "Center";
  }
  return "";
}

function isTableLayoutSideLabel(value: unknown) {
  return Boolean(normalizeLegacyTableSide(String(value || "").trim()));
}

function findHeaderIndexes(headers: string[], headerName: string) {
  const normalizedTarget = String(headerName || "").trim().toLowerCase();
  return headers.reduce<number[]>((matches, header, index) => {
    if (String(header || "").trim().toLowerCase() === normalizedTarget) {
      matches.push(index);
    }
    return matches;
  }, []);
}

function pickColumnValue(
  row: unknown[],
  preferredIndexes: number[],
  usedIndexes: Set<number>,
  fallbackIndexes: number[] = []
) {
  const candidates = [...preferredIndexes, ...fallbackIndexes];
  for (const index of candidates) {
    if (!Number.isInteger(index) || index < 0 || index >= row.length || usedIndexes.has(index)) {
      continue;
    }

    usedIndexes.add(index);
    return row[index];
  }

  return "";
}

function isTableIdValue(value: unknown) {
  return /^table_/i.test(String(value || "").trim());
}

function isLikelyDateValue(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) {
    return false;
  }
  const parsed = new Date(raw);
  return !Number.isNaN(parsed.getTime());
}

function isLikelyNumericValue(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) {
    return false;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed);
}

function pickRemainingColumnValue(
  row: unknown[],
  usedIndexes: Set<number>,
  predicate: (value: unknown, index: number) => boolean
) {
  for (let index = 0; index < row.length; index += 1) {
    if (usedIndexes.has(index)) {
      continue;
    }
    if (!predicate(row[index], index)) {
      continue;
    }

    usedIndexes.add(index);
    return row[index];
  }

  return "";
}

function normalizeTablesSheet() {
  const sheet = ensureSheet(TABLES_SHEET, TABLE_HEADERS);
  const lastColumn = Math.max(sheet.getLastColumn(), TABLE_HEADERS.length);
  const headerValues = sheet
    .getRange(1, 1, 1, lastColumn)
    .getDisplayValues()[0]
    .map((value) => String(value || "").trim());
  const visibleHeaders = headerValues.slice(0, TABLE_HEADERS.length);
  const headersMatch = TABLE_HEADERS.every((header, index) => visibleHeaders[index] === header);
  const hasDuplicateHeaders = headerValues.some((header, index) => header && headerValues.indexOf(header) !== index);

  if (headersMatch && !hasDuplicateHeaders) {
    return sheet;
  }

  const rowCount = Math.max(sheet.getLastRow() - 1, 0);
  const rawRows = rowCount
    ? sheet.getRange(2, 1, rowCount, lastColumn).getValues()
    : [];

  const normalizedRows = rawRows.map((row) => {
    const usedIndexes = new Set<number>();
    const hasLocationHeader = findHeaderIndexes(headerValues, "Location").length > 0;
    const hasOrderHeader = findHeaderIndexes(headerValues, "Order").length > 0;
    const createdAtIndexes = findHeaderIndexes(headerValues, "CreatedAt");
    const updatedAtIndexes = findHeaderIndexes(headerValues, "UpdatedAt");
    const id = pickColumnValue(row, findHeaderIndexes(headerValues, "Id"), usedIndexes, [0])
      || pickRemainingColumnValue(row, usedIndexes, (value) => isTableIdValue(value));
    const tableName = pickColumnValue(row, findHeaderIndexes(headerValues, "Table Name"), usedIndexes, [1])
      || pickRemainingColumnValue(row, usedIndexes, (value) => {
        const raw = String(value || "").trim();
        return Boolean(raw) && !isLikelyNumericValue(raw) && !isLikelyDateValue(raw) && !isTableLayoutSideLabel(raw);
      });
    const location = pickColumnValue(row, findHeaderIndexes(headerValues, "Location"), usedIndexes)
      || pickRemainingColumnValue(row, usedIndexes, (value) => isTableLayoutSideLabel(value));
    const order = pickColumnValue(row, findHeaderIndexes(headerValues, "Order"), usedIndexes)
      || pickRemainingColumnValue(row, usedIndexes, (value) => {
        const parsed = Number(String(value || "").trim());
        return Number.isFinite(parsed) && parsed > 0 && parsed <= 20;
      });
    const type = pickColumnValue(
      row,
      findHeaderIndexes(headerValues, "Type"),
      usedIndexes,
      !hasLocationHeader && !hasOrderHeader ? [2] : []
    ) || pickRemainingColumnValue(row, usedIndexes, (value) => {
      const raw = String(value || "").trim();
      return Boolean(raw) && !isLikelyNumericValue(raw) && !isLikelyDateValue(raw) && !isTableLayoutSideLabel(raw);
    });
    const count = pickColumnValue(
      row,
      findHeaderIndexes(headerValues, "Count"),
      usedIndexes,
      !hasLocationHeader && !hasOrderHeader ? [3] : []
    ) || pickRemainingColumnValue(row, usedIndexes, (value) => {
      const parsed = Number(String(value || "").trim());
      return Number.isFinite(parsed) && parsed >= 0;
    });
    const reservedOpenSeatPositions = pickColumnValue(row, findHeaderIndexes(headerValues, RESERVED_OPEN_SEAT_POSITIONS_HEADER), usedIndexes);
    const createdAt = pickColumnValue(
      row,
      createdAtIndexes,
      usedIndexes,
      !hasLocationHeader && !hasOrderHeader ? [4] : []
    ) || pickRemainingColumnValue(row, usedIndexes, (value) => isLikelyDateValue(value));
    const updatedAt = pickColumnValue(
      row,
      updatedAtIndexes.slice(1),
      usedIndexes,
      updatedAtIndexes.length ? [updatedAtIndexes[0]] : (!hasLocationHeader && !hasOrderHeader ? [5] : [])
    ) || pickRemainingColumnValue(row, usedIndexes, (value) => isLikelyDateValue(value));

    return [
      id,
      tableName,
      location,
      order,
      type,
      count,
      reservedOpenSeatPositions,
      createdAt,
      updatedAt
    ];
  });

  const totalRows = Math.max(sheet.getLastRow(), normalizedRows.length + 1);
  const totalColumns = Math.max(sheet.getLastColumn(), TABLE_HEADERS.length);
  sheet.getRange(1, 1, totalRows, totalColumns).clearContent();
  sheet.getRange(1, 1, 1, TABLE_HEADERS.length).setValues([TABLE_HEADERS]);
  if (normalizedRows.length) {
    sheet.getRange(2, 1, normalizedRows.length, TABLE_HEADERS.length).setValues(normalizedRows);
  }

  return sheet;
}

const RESERVED_OPEN_SEAT_POSITIONS_HEADER = "Reserved Open Seat Positions";

function normalizeReservedOpenSeatPositions(value: SaveTableReservedOpenSeatsInput["reservedOpenSeatPositions"]) {
  const tokens = Array.isArray(value)
    ? value
    : String(value || "")
      .split(",");

  const seen = new Set<number>();
  return tokens
    .map((token) => Number(String(token || "").trim()))
    .filter((seat) => Number.isInteger(seat) && seat > 0)
    .filter((seat) => {
      if (seen.has(seat)) {
        return false;
      }
      seen.add(seat);
      return true;
    })
    .sort((left, right) => left - right)
    .join(", ");
}

function ensureColumn(sheet: GoogleAppsScript.Spreadsheet.Sheet, header: string) {
  const headers = sheet
    .getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1))
    .getDisplayValues()[0]
    .map((value) => String(value || "").trim());
  const existingIndex = headers.findIndex((value) => value === header);
  if (existingIndex >= 0) {
    return existingIndex + 1;
  }

  const nextColumn = headers.length + 1;
  sheet.getRange(1, nextColumn).setValue(header);
  return nextColumn;
}

function ensureColumnCaseInsensitive(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  headers: string[],
  header: string
) {
  const normalizedHeader = String(header || "").trim().toLowerCase();
  const existingIndex = headers.findIndex((value) => String(value || "").trim().toLowerCase() === normalizedHeader);
  if (existingIndex >= 0) {
    return existingIndex + 1;
  }

  return ensureColumn(sheet, header);
}

function saveGuestTableAssignmentInternal(
  guestsSheet: GoogleAppsScript.Spreadsheet.Sheet,
  headers: string[],
  input: SaveGuestTableAssignmentInput
) {
  const rowNumber = Number(input.rowNumber || 0);
  if (!Number.isInteger(rowNumber) || rowNumber < 2) {
    throw new Error("Missing guest row number.");
  }

  const tableNumberIndex = headers.findIndex((header) => header === "table number" || header === "table #");
  const tableOrderIndex = headers.findIndex((header) => header === "table order");

  if (tableNumberIndex < 0) {
    throw new Error("Guests sheet is missing the Table number column.");
  }

  const tableName = String(input.tableName || "").trim();
  const tableOrder = Number(input.tableOrder || 0) || 0;

  guestsSheet.getRange(rowNumber, tableNumberIndex + 1).setValue(tableName);
  if (tableOrderIndex >= 0) {
    guestsSheet.getRange(rowNumber, tableOrderIndex + 1).setValue(tableOrder || "");
  }

  return {
    rowNumber,
    tableName,
    tableOrder
  };
}

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
    .map(mapPersonRow);
}

export function savePerson(input: SavePersonInput) {
  requirePlannerAccess();

  const id = String(input.id || "").trim() || createId("person");
  const now = new Date().toISOString();
  const existing = listPeople().find((person) => person.id === id);

  const savedRow = {
    Id: id,
    Name: String(input.name || "").trim(),
    Phone: String(input.phone || "").trim(),
    Role: String(input.role || "").trim(),
    GroupName: String(input.groupName || "").trim(),
    ConsentStatus: String(input.consentStatus || "invited").trim(),
    Notes: String(input.notes || "").trim(),
    CreatedAt: existing?.createdAt || now,
    UpdatedAt: now
  };

  upsertRow(PEOPLE_SHEET, PEOPLE_HEADERS, id, savedRow);

  return mapPersonRow(savedRow);
}

export function listEvents() {
  requirePlannerAccess();
  ensureSheet(EVENTS_SHEET, EVENT_HEADERS);

  return readRows(EVENTS_SHEET)
    .filter((row) => String(row.Title || row.Date || row.StartsAt || "").trim())
    .map(mapEventRow);
}

export function saveEvent(input: SaveEventInput) {
  requirePlannerAccess();

  const id = String(input.id || "").trim() || createId("event");
  const now = new Date().toISOString();

  const savedRow = {
    Id: id,
    Title: String(input.title || "").trim(),
    Main: input.main === true || String(input.main).toLowerCase() === "true" ? "TRUE" : "FALSE",
    Date: String(input.date || "").trim(),
    StartsAt: String(input.startsAt || "").trim(),
    EndsAt: String(input.endsAt || "").trim(),
    Location: String(input.location || "").trim(),
    AssignedTo: String(input.assignedTo || "").trim(),
    AssignedPeople: String(input.assignedPeople || "").trim(),
    ReminderMinutes: Number(input.reminderMinutes || 15),
    MessageTemplate: String(input.messageTemplate || "").trim(),
    Notes: String(input.notes || "").trim(),
    Active: input.active === false || String(input.active).toLowerCase() === "false" ? "FALSE" : "TRUE",
    UpdatedAt: now
  };

  upsertRow(EVENTS_SHEET, EVENT_HEADERS, id, savedRow);

  return mapEventRow(savedRow);
}

export function listShots() {
  requirePlannerAccess();
  ensureSheet(SHOTS_SHEET, SHOT_HEADERS);

  return readRows(SHOTS_SHEET)
    .filter((row) => String(row.Title || row.EventId || row.Description || "").trim())
    .map(mapShotRow);
}

export function saveShot(input: SaveShotInput) {
  requirePlannerAccess();

  const id = String(input.id || "").trim() || createId("shot");
  const now = new Date().toISOString();
  const existing = listShots().find((shot) => shot.id === id);
  const isComplete = normalizeBoolean(input.isComplete);
  const completedAt = isComplete
    ? String(input.completedAt || existing?.completedAt || now).trim()
    : "";

  const savedRow = {
    Id: id,
    EventId: String(input.eventId || "").trim(),
    Title: String(input.title || "").trim(),
    Description: String(input.description || "").trim(),
    PeopleNeeded: String(input.peopleNeeded || "").trim(),
    Priority: String(input.priority || "Medium").trim(),
    SortOrder: Number(input.sortOrder || 0),
    Notes: String(input.notes || "").trim(),
    IsComplete: isComplete ? "TRUE" : "FALSE",
    CompletedAt: completedAt,
    CreatedAt: existing?.createdAt || now,
    UpdatedAt: now
  };

  upsertRow(SHOTS_SHEET, SHOT_HEADERS, id, savedRow);

  return mapShotRow(savedRow);
}

export function deleteShot(input: { id?: string }) {
  requirePlannerAccess();
  const id = String(input?.id || "").trim();
  if (!id) {
    throw new Error("Missing shot id.");
  }

  deleteRowById(SHOTS_SHEET, SHOT_HEADERS, id);
  return { ok: true, id };
}

export function listBeds() {
  requirePlannerAccess();
  ensureBedsSheet();

  return readRows(BEDS_SHEET)
    .filter((row) => String(row.Lodging || row.Room || row.BedLabel || "").trim())
    .map(mapBedRow);
}

export function saveBed(input: SaveBedInput) {
  requirePlannerAccess();
  ensureBedsSheet();

  const id = String(input.id || "").trim() || createId("bed");
  const now = new Date().toISOString();
  const existing = listBeds().find((bed) => bed.id === id);
  const savedRow = {
    Id: id,
    Lodging: String(input.lodging || "").trim(),
    Room: String(input.room || "").trim(),
    BedLabel: String(input.bedLabel || "").trim(),
    BedType: String(input.bedType || "").trim(),
    Capacity: Number(input.capacity || 0),
    Thursday: String(input.thursday || "").trim(),
    Friday: String(input.friday || "").trim(),
    Notes: String(input.notes || "").trim(),
    SortOrder: Number(existing?.sortOrder || DEFAULT_BED_SORT_ORDER[id] || 0),
    CreatedAt: existing?.createdAt || now,
    UpdatedAt: now
  };

  upsertRow(BEDS_SHEET, BED_HEADERS, id, savedRow);

  return mapBedRow(savedRow);
}

export function listTodos() {
  requirePlannerAccess();
  ensureSheet(TODO_SHEET, TODO_HEADERS);

  return readRows(TODO_SHEET)
    .filter((row) => String(row.Title || row.Notes || row.AssignedTo || row.DueDate || "").trim())
    .map(mapTodoRow);
}

export function deleteTodo(input: { id?: string }) {
  requirePlannerAccess();
  const id = String(input?.id || "").trim();
  if (!id) {
    throw new Error("Missing todo id.");
  }

  deleteRowById(TODO_SHEET, TODO_HEADERS, id);
  return { ok: true, id };
}

/**
 * Stores task snapshots in Drive and returns a browser-friendly thumbnail URL.
 * The client resizes photos before sending them so ordinary phone snapshots
 * remain well within Apps Script request limits.
 */
export function uploadTodoImage(input: UploadTodoImageInput) {
  requirePlannerAccess();

  const encoded = String(input.data || "").trim().replace(/^data:[^;]+;base64,/, "");
  const contentType = String(input.contentType || "").trim().toLowerCase();
  if (!encoded || !contentType.startsWith("image/")) {
    throw new Error("Choose a valid image to attach to this task.");
  }

  let bytes: number[];
  try {
    bytes = Utilities.base64Decode(encoded);
  } catch (_) {
    throw new Error("The selected photo could not be read.");
  }

  // Keep a server-side ceiling as a safeguard if a client skips compression.
  if (bytes.length > 5 * 1024 * 1024) {
    throw new Error("That photo is too large. Please choose a smaller image.");
  }

  const extension = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  const requestedName = String(input.fileName || "").trim().replace(/[^a-z0-9._-]+/gi, "-");
  const titlePrefix = String(input.taskTitle || "task").trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "task";
  const fileName = requestedName || `${titlePrefix}-${Date.now()}.${extension}`;
  const blob = Utilities.newBlob(bytes, contentType, fileName);
  const folder = getTodoPhotoFolder();
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return {
    fileId: file.getId(),
    imageUrl: `https://drive.google.com/thumbnail?id=${encodeURIComponent(file.getId())}&sz=w1600`,
    fileUrl: file.getUrl(),
    fileName: file.getName()
  };
}

function getTodoPhotoFolder() {
  const name = "Hope & Caleb Task Photos";
  const folders = DriveApp.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(name);
}

export function listEventLists() {
  requirePlannerAccess();
  ensureSheet(EVENT_LISTS_SHEET, EVENT_LIST_HEADERS);

  return readRows(EVENT_LISTS_SHEET)
    .filter((row) => String(row.Title || row.Items || row.EventId || "").trim())
    .map(mapEventListRow);
}

export function listTables() {
  requirePlannerAccess();
  normalizeTablesSheet();

  return readRows(TABLES_SHEET)
    .filter((row) => String(row["Table Name"] || row.Type || row.Count || "").trim())
    .map(mapTableRow);
}

export function saveTable(input: SaveTableInput) {
  requirePlannerAccess();

  const id = String(input.id || "").trim() || createId("table");
  const now = new Date().toISOString();
  const existing = listTables().find((table) => table.id === id);

  const savedRow = {
    Id: id,
    "Table Name": String(input.tableName || "").trim(),
    Location: String(input.location || existing?.location || "").trim(),
    Order: Number(input.order || existing?.order || 0),
    Type: String(input.type || existing?.type || "").trim(),
    Count: Number(input.count || 0),
    "Reserved Open Seat Positions": String(existing?.reservedOpenSeatPositions || "").trim(),
    CreatedAt: existing?.createdAt || now,
    UpdatedAt: now
  };

  upsertRow(TABLES_SHEET, TABLE_HEADERS, id, savedRow);

  return mapTableRow(savedRow);
}

export function saveTableReservedOpenSeats(input: SaveTableReservedOpenSeatsInput) {
  requirePlannerAccess();
  normalizeTablesSheet();

  const id = String(input.id || "").trim();
  if (!id) {
    throw new Error("Missing table id.");
  }

  const sheet = getSheetByName(TABLES_SHEET);
  if (!sheet || sheet.getLastRow() < 2) {
    throw new Error("Tables sheet not found.");
  }

  const headerValues = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getDisplayValues()[0]
    .map((value) => String(value || "").trim());
  const idColumnIndex = headerValues.findIndex((header) => header === "Id");
  if (idColumnIndex < 0) {
    throw new Error("Tables sheet is missing the Id column.");
  }

  const rows = sheet
    .getRange(2, 1, Math.max(sheet.getLastRow() - 1, 1), sheet.getLastColumn())
    .getDisplayValues();
  const rowIndex = rows.findIndex((row) => String(row[idColumnIndex] || "").trim() === id);
  if (rowIndex < 0) {
    throw new Error("Table not found.");
  }

  const reservedColumnIndex = ensureColumn(sheet, RESERVED_OPEN_SEAT_POSITIONS_HEADER);
  const updatedAtColumnIndex = ensureColumn(sheet, "UpdatedAt");
  const normalizedReservedPositions = normalizeReservedOpenSeatPositions(input.reservedOpenSeatPositions);
  const sheetRowNumber = rowIndex + 2;
  const now = new Date().toISOString();

  sheet.getRange(sheetRowNumber, reservedColumnIndex).setValue(normalizedReservedPositions);
  sheet.getRange(sheetRowNumber, updatedAtColumnIndex).setValue(now);

  const refreshedHeaders = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getDisplayValues()[0]
    .map((value) => String(value || "").trim());
  const refreshedValues = sheet.getRange(sheetRowNumber, 1, 1, sheet.getLastColumn()).getValues()[0];
  const savedRow: Record<string, unknown> = {};
  refreshedHeaders.forEach((header, index) => {
    savedRow[header] = refreshedValues[index];
  });

  return mapTableRow(savedRow);
}

export function saveGuestTableAssignment(input: SaveGuestTableAssignmentInput) {
  requirePlannerAccess();

  const guestsSheet = getSheetByName(GUESTS_SHEET);
  if (!guestsSheet || guestsSheet.getLastRow() < 1) {
    throw new Error("Guests sheet not found.");
  }

  const headers = guestsSheet
    .getRange(1, 1, 1, guestsSheet.getLastColumn())
    .getDisplayValues()[0]
    .map((header) => String(header || "").trim().toLowerCase());

  return saveGuestTableAssignmentInternal(guestsSheet, headers, input);
}

export function saveGuestTableAssignments(input: SaveGuestTableAssignmentsInput) {
  requirePlannerAccess();

  const assignments = Array.isArray(input.assignments) ? input.assignments : [];
  if (!assignments.length) {
    return [];
  }

  const guestsSheet = getSheetByName(GUESTS_SHEET);
  if (!guestsSheet || guestsSheet.getLastRow() < 1) {
    throw new Error("Guests sheet not found.");
  }

  const headers = guestsSheet
    .getRange(1, 1, 1, guestsSheet.getLastColumn())
    .getDisplayValues()[0]
    .map((header) => String(header || "").trim().toLowerCase());

  return assignments.map((assignment) => saveGuestTableAssignmentInternal(guestsSheet, headers, assignment));
}

export function saveGuestDetails(input: SaveGuestDetailsInput) {
  requirePlannerAccess();

  const guestsSheet = getSheetByName(GUESTS_SHEET);
  if (!guestsSheet || guestsSheet.getLastRow() < 1) {
    throw new Error("Guests sheet not found.");
  }

  const rowNumber = Number(input.rowNumber || 0);
  if (!Number.isInteger(rowNumber) || rowNumber < 2) {
    throw new Error("Missing guest row number.");
  }

  const headers = guestsSheet
    .getRange(1, 1, 1, guestsSheet.getLastColumn())
    .getDisplayValues()[0]
    .map((header) => String(header || "").trim());

  const typeColumnIndex = ensureColumnCaseInsensitive(guestsSheet, headers, "Type");
  const rsvpColumnIndex = ensureColumnCaseInsensitive(guestsSheet, headers, "RSVP");
  const typeValue = String(input.type || "").trim();
  const rsvpValue = String(input.rsvp || "").trim();

  guestsSheet.getRange(rowNumber, typeColumnIndex).setValue(typeValue);
  guestsSheet.getRange(rowNumber, rsvpColumnIndex).setValue(rsvpValue);

  return {
    rowNumber,
    type: typeValue,
    rsvp: rsvpValue
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

  const savedRow = {
    Id: id,
    EventId: String(input.eventId || "").trim(),
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
  };

  upsertRow(TODO_SHEET, TODO_HEADERS, id, savedRow);

  return mapTodoRow(savedRow);
}

export function saveEventList(input: SaveEventListInput) {
  requirePlannerAccess();

  const id = String(input.id || "").trim() || createId("event_list");
  const now = new Date().toISOString();
  const existing = listEventLists().find((list) => list.id === id);
  const savedRow = {
    Id: id,
    EventId: String(input.eventId || "").trim(),
    Title: String(input.title || "").trim(),
    Type: String(input.type || existing?.type || "shopping").trim(),
    Items: String(input.items || "").trim(),
    Notes: String(input.notes || "").trim(),
    CreatedAt: existing?.createdAt || now,
    UpdatedAt: now
  };

  upsertRow(EVENT_LISTS_SHEET, EVENT_LIST_HEADERS, id, savedRow);

  return mapEventListRow(savedRow);
}

export function deleteEventList(input: { id?: string }) {
  requirePlannerAccess();
  const id = String(input?.id || "").trim();
  if (!id) {
    throw new Error("Missing event list id.");
  }

  deleteRowById(EVENT_LISTS_SHEET, EVENT_LIST_HEADERS, id);
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
