import { syncGroupsSheet, syncGuestSummarySheets } from "./features/feed";
import { getViewerProfile } from "./auth";
import { deleteEventList, deleteShot, deleteTodo, listBeds, listEventLists, listEvents, listPeople, listShots, listTables, listTodos, saveBed, saveEvent, saveEventList, saveGuestDetails, saveGuestTableAssignment, saveGuestTableAssignments, savePerson, saveShot, saveTable, saveTableReservedOpenSeats, saveTodo } from "./features/planner";
import { generateEventPlan } from "./util/ai";
import { PLANNER_BUILD_VERSION } from "./version";

export function rpc(input: { method: string; payload: unknown }) {
  const { method, payload } = input;

  switch (method) {
    case "getViewerProfile":
      return getViewerProfile();
    case "getPlannerBuildInfo":
      return {
        version: PLANNER_BUILD_VERSION
      };
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
    case "deleteTodo":
      return deleteTodo(payload as Parameters<typeof deleteTodo>[0]);
    case "listEventLists":
      return listEventLists();
    case "saveEventList":
      return saveEventList(payload as Parameters<typeof saveEventList>[0]);
    case "deleteEventList":
      return deleteEventList(payload as Parameters<typeof deleteEventList>[0]);
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
    case "saveGuestDetails":
      return saveGuestDetails(payload as Parameters<typeof saveGuestDetails>[0]);
    case "syncGuestSummarySheets":
      return syncGuestSummarySheets();
    case "syncGroupsSheet":
      return syncGroupsSheet();
    case "generateEventPlan":
      return generateEventPlan(payload as Parameters<typeof generateEventPlan>[0]);
    default:
      throw new Error(`Unknown RPC method: ${method}`);
  }
}
