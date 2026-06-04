export const ADMIN_SHEET = "Admins";
export const PEOPLE_SHEET = "People";
export const EVENTS_SHEET = "Events";
export const GOOGLE_CLIENT_ID_PROPERTY_KEY = "GOOGLE_CLIENT_ID";

export const ADMIN_HEADERS = ["Email", "Name"];
export const PEOPLE_HEADERS = [
  "Id",
  "Name",
  "Phone",
  "Role",
  "GroupName",
  "ConsentStatus",
  "Notes",
  "CreatedAt",
  "UpdatedAt"
];
export const EVENT_HEADERS = [
  "Id",
  "Title",
  "StartsAt",
  "Location",
  "AssignedTo",
  "ReminderMinutes",
  "MessageTemplate",
  "Notes",
  "Active",
  "UpdatedAt"
];

export type PlannerRow = Record<string, unknown>;
