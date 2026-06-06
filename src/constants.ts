export const ADMIN_SHEET = "Admins";
export const PEOPLE_SHEET = "People";
export const EVENTS_SHEET = "Events";
export const BEDS_SHEET = "Beds";
export const TABLES_SHEET = "Tables";
export const TODO_SHEET = "Todo";
export const GOOGLE_CLIENT_ID_PROPERTY_KEY = "GOOGLE_CLIENT_ID";
export const SPREADSHEET_ID_PROPERTY_KEY = "SPREADSHEET_ID";
export const DASHBOARD_PASSWORD_HASH_PROPERTY_KEY = "DASHBOARD_PASSWORD_HASH";
export const RSVP_SHEET = "RSVPs";
export const RSVP_TAB_SHEET = "RSVP";
export const COMMENT_SHEET = "Comments";
export const GUESTS_SHEET = "Guests";
export const TABLE_NUMBER_SHEET = "Table Number";
export const MEDIA_FOLDER_NAME = "H&C Grad";
export const RSVP_NOTIFICATION_EMAILS_PROPERTY_KEY = "RSVP_NOTIFICATION_EMAILS";

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
  "Main",
  "Date",
  "StartsAt",
  "Location",
  "AssignedTo",
  "ReminderMinutes",
  "MessageTemplate",
  "Notes",
  "Active",
  "UpdatedAt"
];
export const BED_HEADERS = [
  "Id",
  "Lodging",
  "Room",
  "BedLabel",
  "BedType",
  "Capacity",
  "Thursday",
  "Friday",
  "Notes",
];
export const TABLE_HEADERS = [
  "Id",
  "Table Name",
  "Type",
  "Count",
  "CreatedAt",
  "UpdatedAt"
];
export const TODO_HEADERS = [
  "Id",
  "Title",
  "Notes",
  "AssignedTo",
  "StartDate",
  "DueDate",
  "Priority",
  "Status",
  "IsComplete",
  "CompletedAt",
  "ImageUrl",
  "SmsMessage",
  "ReminderDate",
  "Category",
  "Tags",
  "CreatedAt",
  "UpdatedAt"
];
export const RSVP_HEADERS = ["Submitted At", "Name", "Email", "Attending", "Guests", "Comment"];
export const COMMENT_HEADERS = ["Submitted At", "Name", "Comment", "Media Url", "Media Type", "Media Name", "Media Error"];

export type PlannerRow = Record<string, unknown>;
