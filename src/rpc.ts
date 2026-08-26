import { listPlannerDashboardFeed, syncGroupsSheet, syncGuestSummarySheets } from "./features/feed";
import { getViewerProfile } from "./auth";
import { deleteEventList, deleteShot, deleteTodo, listBeds, listEventLists, listEvents, listPeople, listShots, listTables, listTodos, saveBed, saveEvent, saveEventList, saveGuestDetails, saveGuestTableAssignment, saveGuestTableAssignments, savePerson, saveShot, saveTable, saveTableReservedOpenSeats, saveTodo, uploadTodoImage } from "./features/planner";
import { generateEventPlan } from "./util/ai";
import { PLANNER_BUILD_VERSION } from "./version";
import { archiveLegacyPlanningData, deleteWorkspaceAsset, deleteWorkspaceList, deleteWorkspaceTask, getWorkspaceProfile, initializePlannerWorkspace, listWorkspaceAssets, listWorkspaceEvents, listWorkspaceInvitees, listWorkspaceLists, listWorkspaceTasks, listWorkspaceUsers, saveWorkspaceAsset, saveWorkspaceEvent, saveWorkspaceList, saveWorkspaceTask, saveWorkspaceUser, setWorkspaceListItemCompleted } from "./features/planner-v2";

export function rpc(input: { method: string; payload: unknown }) {
  const { method, payload } = input;

  switch (method) {
    case "getViewerProfile":
      return getViewerProfile();
    case "getPlannerBootstrap":
      return getPlannerBootstrap();
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
    case "uploadTodoImage":
      return uploadTodoImage(payload as Parameters<typeof uploadTodoImage>[0]);
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
    case "listPlannerDashboardFeed":
      return listPlannerDashboardFeed();
    case "generateEventPlan":
      return generateEventPlan(payload as Parameters<typeof generateEventPlan>[0]);
    case "initializePlannerWorkspace":
      return initializePlannerWorkspace();
    case "getWorkspaceProfile":
      return getWorkspaceProfile();
    case "listWorkspaceUsers":
      return listWorkspaceUsers();
    case "listWorkspaceInvitees":
      return listWorkspaceInvitees();
    case "saveWorkspaceUser":
      return saveWorkspaceUser(payload as Parameters<typeof saveWorkspaceUser>[0]);
    case "archiveLegacyPlanningData":
      return archiveLegacyPlanningData();
    case "listWorkspaceEvents":
      return listWorkspaceEvents();
    case "saveWorkspaceEvent":
      return saveWorkspaceEvent(payload as Parameters<typeof saveWorkspaceEvent>[0]);
    case "listWorkspaceTasks":
      return listWorkspaceTasks();
    case "saveWorkspaceTask":
      return saveWorkspaceTask(payload as Parameters<typeof saveWorkspaceTask>[0]);
    case "deleteWorkspaceTask":
      return deleteWorkspaceTask(payload as Parameters<typeof deleteWorkspaceTask>[0]);
    case "listWorkspaceLists":
      return listWorkspaceLists();
    case "saveWorkspaceList":
      return saveWorkspaceList(payload as Parameters<typeof saveWorkspaceList>[0]);
    case "setWorkspaceListItemCompleted":
      return setWorkspaceListItemCompleted(payload as Parameters<typeof setWorkspaceListItemCompleted>[0]);
    case "deleteWorkspaceList":
      return deleteWorkspaceList(payload as Parameters<typeof deleteWorkspaceList>[0]);
    case "listWorkspaceAssets":
      return listWorkspaceAssets();
    case "saveWorkspaceAsset":
      return saveWorkspaceAsset(payload as Parameters<typeof saveWorkspaceAsset>[0]);
    case "deleteWorkspaceAsset":
      return deleteWorkspaceAsset(payload as Parameters<typeof deleteWorkspaceAsset>[0]);
    default:
      throw new Error(`Unknown RPC method: ${method}`);
  }
}

/**
 * One authenticated startup snapshot. Keeping the spreadsheet reads inside a
 * single Apps Script execution removes the browser's many Worker-to-Script
 * round trips while preserving the existing smaller RPCs for edits.
 */
function getPlannerBootstrap() {
  const profile = getWorkspaceProfile();
  if (!profile.signedIn) {
    return { profile };
  }

  const canManagePlanner = Boolean("isAdmin" in profile && profile.isAdmin) || String(profile.accessLevel || "") === "full_planner";
  if (!canManagePlanner) {
    return {
      profile,
      workspace: {
        users: listWorkspaceUsers(),
        events: listWorkspaceEvents(),
        tasks: listWorkspaceTasks(),
        lists: listWorkspaceLists(),
        assets: listWorkspaceAssets(),
        invitees: { groups: [], guests: [] }
      }
    };
  }

  initializePlannerWorkspace();
  return {
    profile,
    planner: {
      people: listPeople(),
      events: listEvents(),
      shots: listShots(),
      beds: listBeds(),
      todos: listTodos(),
      eventLists: listEventLists(),
      tables: listTables(),
      feed: listPlannerDashboardFeed()
    },
    workspace: {
      users: listWorkspaceUsers(),
      events: listWorkspaceEvents(),
      tasks: listWorkspaceTasks(),
      lists: listWorkspaceLists(),
      assets: listWorkspaceAssets(),
      invitees: listWorkspaceInvitees()
    }
  };
}
