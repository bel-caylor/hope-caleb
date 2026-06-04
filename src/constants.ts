export const ADMIN_SHEET = "Admins";
export const PEOPLE_SHEET = "People";
export const EVENTS_SHEET = "Events";
export const GOOGLE_CLIENT_ID_PROPERTY_KEY = "GOOGLE_CLIENT_ID";
export const SPREADSHEET_ID_PROPERTY_KEY = "SPREADSHEET_ID";
export const RSVP_SHEET = "RSVPs";
export const COMMENT_SHEET = "Comments";
export const GUESTS_SHEET = "Guests";
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
  "StartsAt",
  "Location",
  "AssignedTo",
  "ReminderMinutes",
  "MessageTemplate",
  "Notes",
  "Active",
  "UpdatedAt"
];
export const RSVP_HEADERS = ["Submitted At", "Name", "Email", "Attending", "Guests", "Comment"];
export const COMMENT_HEADERS = ["Submitted At", "Name", "Comment", "Media Url", "Media Type", "Media Name", "Media Error"];

export type PlannerRow = Record<string, unknown>;
