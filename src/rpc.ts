import { syncGuestSummarySheets } from "./features/feed";
import { getViewerProfile } from "./auth";
import { deleteShot, listBeds, listEvents, listPeople, listShots, listTables, listTodos, saveBed, saveEvent, saveGuestTableAssignment, saveGuestTableAssignments, savePerson, saveShot, saveTable, saveTableReservedOpenSeats, saveTodo } from "./features/planner";
import { generateEventPlan } from "./util/ai";

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
    case "listShots":
      return listShots();
    case "saveShot":
      return saveShot(payload as Parameters<typeof saveShot>[0]);
    case "deleteShot":
      return deleteShot(payload as Parameters<typeof deleteShot>[0]);
    case "listTodos":
      return listTodos();
    case "saveTodo":
      return saveTodo(payload as Parameters<typeof saveTodo>[0]);
    case "listTables":
      return listTables();
    case "saveTable":
      return saveTable(payload as Parameters<typeof saveTable>[0]);
    case "saveTableReservedOpenSeats":
      return saveTableReservedOpenSeats(payload as Parameters<typeof saveTableReservedOpenSeats>[0]);
    case "saveGuestTableAssignment":
      return saveGuestTableAssignment(payload as Parameters<typeof saveGuestTableAssignment>[0]);
    case "saveGuestTableAssignments":
      return saveGuestTableAssignments(payload as Parameters<typeof saveGuestTableAssignments>[0]);
    case "syncGuestSummarySheets":
      return syncGuestSummarySheets();
    case "generateEventPlan":
      return generateEventPlan(payload as Parameters<typeof generateEventPlan>[0]);
    default:
      throw new Error(`Unknown RPC method: ${method}`);
  }
}
