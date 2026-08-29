export const ADMIN_SHEET = "Admins";
export const PEOPLE_SHEET = "People";
export const EVENTS_SHEET = "Events";
export const SHOTS_SHEET = "Shot List";
export const BEDS_SHEET = "Beds";
export const TABLES_SHEET = "Tables";
export const TODO_SHEET = "Todo";
export const EVENT_LISTS_SHEET = "Event Lists";
export const REHEARSAL_SLIDES_SHEET = "Rehearsal Slides";
export const PLANNER_USERS_SHEET = "Planner Users";
export const PLANNER_V2_EVENTS_SHEET = "Planner V2 Events";
export const PLANNER_V2_TASKS_SHEET = "Planner V2 Tasks";
export const PLANNER_V2_LISTS_SHEET = "Planner V2 Lists";
export const PLANNER_V2_ASSETS_SHEET = "Planner V2 Assets";
export const PLANNER_ARCHIVE_SHEET = "Planner Archive";
export const GOOGLE_CLIENT_ID_PROPERTY_KEY = "GOOGLE_CLIENT_ID";
export const SPREADSHEET_ID_PROPERTY_KEY = "SPREADSHEET_ID";
export const OPENAI_API_KEY_PROPERTY_KEY = "OPENAI_API_KEY";
export const RSVP_SHEET = "RSVPs";
export const RSVP_TAB_SHEET = "RSVP";
export const COMMENT_SHEET = "Comments";
export const GUESTS_SHEET = "Guests";
export const GROUPS_SHEET = "Groups";
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
  "EndsAt",
  "Location",
  "AssignedTo",
  "AssignedPeople",
  "ReminderMinutes",
  "MessageTemplate",
  "Notes",
  "Active",
  "UpdatedAt"
];
export const SHOT_HEADERS = [
  "Id",
  "EventId",
  "Title",
  "Description",
  "PeopleNeeded",
  "Priority",
  "SortOrder",
  "Notes",
  "IsComplete",
  "CompletedAt",
  "CreatedAt",
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
  "Location",
  "Order",
  "Type",
  "Count",
  "Reserved Open Seat Positions",
  "CreatedAt",
  "UpdatedAt"
];
export const TODO_HEADERS = [
  "Id",
  "EventId",
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
export const EVENT_LIST_HEADERS = [
  "Id",
  "EventId",
  "Title",
  "Type",
  "Items",
  "Notes",
  "CreatedAt",
  "UpdatedAt"
];
export const REHEARSAL_SLIDE_HEADERS = ["Id", "Caption", "ImageUrl", "DriveFileId", "SortOrder", "CreatedAt", "UpdatedAt"];
export const PLANNER_USER_HEADERS = [
  "Id",
  "GuestId",
  "WeddingRole",
  "AccessLevel",
  "Active",
  "CreatedAt",
  "UpdatedAt"
];
export const PLANNER_V2_EVENT_HEADERS = [
  "Id",
  "Title",
  "StartsAt",
  "EndsAt",
  "Location",
  "Audience",
  "AssignedUserIds",
  "Invitees",
  "Notes",
  "CreatedAt",
  "UpdatedAt"
];
export const PLANNER_V2_TASK_HEADERS = [
  "Id",
  "Title",
  "EventId",
  "ListId",
  "AssignedUserId",
  "DueAt",
  "Status",
  "Priority",
  "Notes",
  "SortOrder",
  "CreatedAt",
  "UpdatedAt",
  "CompletedAt"
];
export const PLANNER_V2_LIST_HEADERS = [
  "Id",
  "EventId",
  "Title",
  "Items",
  "CompletedItems",
  "Notes",
  "CreatedAt",
  "UpdatedAt"
];
export const PLANNER_V2_ASSET_HEADERS = [
  "Id",
  "Title",
  "AssetUrl",
  "AssetType",
  "EventId",
  "TaskId",
  "Visibility",
  "Notes",
  "CreatedAt",
  "UpdatedAt"
];
export const PLANNER_ARCHIVE_HEADERS = ["Id", "ArchivedAt", "Source", "Payload"];
export const RSVP_HEADERS = [
  "Submitted At",
  "Form Type",
  "Name",
  "Email",
  "Attending",
  "Guests",
  "Comment",
  "Group",
  "Group Members",
  "Wedding RSVP Summary",
  "Rehearsal RSVP",
  "Open House RSVP",
  "Plus One Count",
  "Plus One Name",
  "Children Count",
  "Children Note",
  "Mobile",
  "SMS Opted In",
  "SMS Consent Recorded At"
];
export const COMMENT_HEADERS = ["Submitted At", "Name", "Comment", "Media Url", "Media Type", "Media Name", "Media Error"];
export const GROUP_HEADERS = [
  "Group",
  "Display Name",
  "Primary Contact",
  "Email",
  "Phone",
  "Invited Rehearsal",
  "Invited Open House",
  "# Children",
  "Max Plus Ones",
  "Lookup Code",
  "Wedding RSVP",
  "Rehearsal RSVP",
  "Open House RSVP",
  "Notes",
  "Last Updated"
];

export type PlannerRow = Record<string, unknown>;
