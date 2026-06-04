import { getViewerProfile } from "./auth";
import { listEvents, listPeople, saveEvent, savePerson } from "./features/planner";

export function rpc(input: { method: string; payload: unknown }) {
  const { method, payload } = input;

  switch (method) {
    case "getViewerProfile":
      return getViewerProfile();
    case "listPeople":
      return listPeople();
    case "savePerson":
      return savePerson(payload as Parameters<typeof savePerson>[0]);
    case "listEvents":
      return listEvents();
    case "saveEvent":
      return saveEvent(payload as Parameters<typeof saveEvent>[0]);
    default:
      throw new Error(`Unknown RPC method: ${method}`);
  }
}
