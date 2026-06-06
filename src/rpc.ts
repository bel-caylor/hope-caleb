import { syncGuestSummarySheets } from "./features/feed";
import { getViewerProfile } from "./auth";
import { listBeds, listEvents, listPeople, listTables, listTodos, saveBed, saveEvent, saveGuestTableAssignment, savePerson, saveTable, saveTodo } from "./features/planner";

export function rpc(input: { method: string; payload: unknown }) {
  const { method, payload } = input;

  switch (method) {
    case "getViewerProfile":
      return getViewerProfile();
    case "listPeople":
      return listPeople();
    case "savePerson":
      return savePerson(payload as Parameters<typeof savePerson>[0]);
    case "listBeds":
      return listBeds();
    case "saveBed":
      return saveBed(payload as Parameters<typeof saveBed>[0]);
    case "listEvents":
      return listEvents();
    case "saveEvent":
      return saveEvent(payload as Parameters<typeof saveEvent>[0]);
    case "listTodos":
      return listTodos();
    case "saveTodo":
      return saveTodo(payload as Parameters<typeof saveTodo>[0]);
    case "listTables":
      return listTables();
    case "saveTable":
      return saveTable(payload as Parameters<typeof saveTable>[0]);
    case "saveGuestTableAssignment":
      return saveGuestTableAssignment(payload as Parameters<typeof saveGuestTableAssignment>[0]);
    case "syncGuestSummarySheets":
      return syncGuestSummarySheets();
    default:
      throw new Error(`Unknown RPC method: ${method}`);
  }
}
