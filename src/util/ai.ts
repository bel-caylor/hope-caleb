import { OPENAI_API_KEY_PROPERTY_KEY } from "../constants";
import { requirePlannerAccess } from "../auth";

type GenerateEventPlanInput = {
  eventId?: string;
  title?: string;
  date?: string;
  startsAt?: string;
  location?: string;
  assignedTo?: string;
  reminderMinutes?: number | string;
  notes?: string;
  planningNotes?: string;
  goals?: string[];
  existingShots?: Array<{ title?: string; description?: string; notes?: string }>;
  systemPrompt?: string;
  userPrompt?: string;
};

type EventPlanItem = {
  title: string;
  ownerSuggestion?: string;
  dueTiming?: string;
  notes?: string;
};

type EventPlanChecklist = {
  title: string;
  type: string;
  items: Array<{
    item: string;
    quantity?: string;
    notes?: string;
  }>;
};

type EventPlanShotIdea = {
  title: string;
  reason?: string;
};

type EventPlanResult = {
  summary: string;
  assumptions: string[];
  todos: EventPlanItem[];
  checklists: EventPlanChecklist[];
  shotIdeas: EventPlanShotIdea[];
  questions: string[];
  error?: string;
};

let lastAiCallAt = 0;
const AI_MIN_DELAY_MS = 1200;

export function generateEventPlan(input: GenerateEventPlanInput): EventPlanResult {
  requirePlannerAccess();

  const title = String(input?.title || "").trim();
  if (!title) {
    throw new Error("Event title is required.");
  }

  const fallback = buildFallbackEventPlan(input);
  const key = getOpenAiKey();
  if (!key) {
    return {
      ...fallback,
      error: "OPENAI_API_KEY not set in Script Properties"
    };
  }

  const goals = normalizeGoals(input?.goals);
  const prompts = buildEventPlanPrompts(input, goals);

  try {
    const responseText = callOpenAi(prompts.systemPrompt, prompts.userPrompt, key);
    const parsed = safeJsonParse(responseText);
    const normalized = normalizeEventPlan(parsed, fallback, goals);
    return normalized;
  } catch (error) {
    try {
      Logger.log(`generateEventPlan AI error: ${(error as Error)?.message || error}`);
    } catch (_) {}
    return {
      ...fallback,
      error: "AI request failed"
    };
  }
}

function buildEventPlanPrompts(input: GenerateEventPlanInput, goals: string[]) {
  const existingShots = Array.isArray(input?.existingShots) ? input.existingShots : [];
  const fallbackSystemPrompt = "You are a practical event-planning assistant. Return clean JSON only. Create realistic, useful planning outputs based on the event context. Keep items concise and actionable.";
  const fallbackUserPrompt = [
    "Build an event plan for the following event.",
    "",
    "Event context:",
    `- Title: ${String(input?.title || "").trim() || "Untitled event"}`,
    `- Date: ${String(input?.date || "").trim() || "Not provided"}`,
    `- Start time: ${String(input?.startsAt || "").trim() || "Not provided"}`,
    `- Location: ${String(input?.location || "").trim() || "Not provided"}`,
    `- Assigned to: ${String(input?.assignedTo || "").trim() || "Not provided"}`,
    `- Reminder minutes: ${String(input?.reminderMinutes || "").trim() || "15"}`,
    `- Event notes: ${String(input?.notes || "").trim() || "None"}`,
    `- Planning notes: ${String(input?.planningNotes || "").trim() || "None"}`,
    `- Requested outputs: ${goals.join(", ") || "todo items, shopping or packing lists"}`,
    "",
    "Existing shot requests already in the planner:",
    existingShots.length
      ? existingShots.map((shot, index) => `${index + 1}. ${String(shot?.title || "").trim() || "Untitled shot"}${String(shot?.description || "").trim() ? ` - ${String(shot?.description || "").trim()}` : ""}`).join("\n")
      : "None yet."
  ].join("\n");

  const systemPrompt = String(input?.systemPrompt || "").trim() || fallbackSystemPrompt;
  const userPromptBase = String(input?.userPrompt || "").trim() || fallbackUserPrompt;
  const schemaGuardrail = [
    "",
    "Return valid JSON with this exact shape:",
    "{\"summary\":\"string\",\"assumptions\":[\"string\"],\"todos\":[{\"title\":\"string\",\"ownerSuggestion\":\"string\",\"dueTiming\":\"string\",\"notes\":\"string\"}],\"checklists\":[{\"title\":\"string\",\"type\":\"shopping|packing|checklist\",\"items\":[{\"item\":\"string\",\"quantity\":\"string\",\"notes\":\"string\"}]}],\"shotIdeas\":[{\"title\":\"string\",\"reason\":\"string\"}],\"questions\":[\"string\"]}",
    "",
    "Rules:",
    "- Only include sections that are helpful for this event, but always return all top-level keys.",
    "- If shopping or packing is not requested, checklists may be an empty array.",
    "- If shot ideas are not requested, shotIdeas may be an empty array.",
    "- Prefer 3-8 todos unless the notes clearly justify more.",
    "- Group checklist items sensibly.",
    "- Do not wrap the JSON in markdown fences."
  ].join("\n");

  return {
    systemPrompt,
    userPrompt: `${userPromptBase}${schemaGuardrail}`
  };
}

function buildFallbackEventPlan(input: GenerateEventPlanInput): EventPlanResult {
  const title = String(input?.title || "Event").trim() || "Event";
  const notes = String(input?.planningNotes || input?.notes || "").trim();
  const goals = normalizeGoals(input?.goals);

  const assumptions = [
    String(input?.location || "").trim() ? `The event will happen at ${String(input?.location || "").trim()}.` : "",
    notes ? "The planning notes describe the main priorities for the event." : "More event planning notes would improve the generated plan."
  ].filter(Boolean);

  const todos = goals.includes("todo items")
    ? [
        {
          title: `Confirm the final plan for ${title}`,
          ownerSuggestion: "Planner",
          dueTiming: "1-3 days before",
          notes: notes || "Review food, setup, and guest flow."
        }
      ]
    : [];

  const checklists = goals.includes("shopping or packing lists")
    ? [
        {
          title: `${title} Checklist`,
          type: "checklist",
          items: notes
            ? [{ item: "Review planning notes and convert them into supplies", notes }]
            : [{ item: "Add supplies once event needs are finalized" }]
        }
      ]
    : [];

  const shotIdeas = goals.includes("photo shot ideas")
    ? [
        {
          title: `${title} candid moment`,
          reason: "Capture a natural moment tied to the event."
        }
      ]
    : [];

  return {
    summary: `${title} needs a practical event plan based on the notes provided.`,
    assumptions,
    todos,
    checklists,
    shotIdeas,
    questions: [
      "How many people are expected?",
      "What supplies or food need to be prepared ahead of time?",
      "Is there anything that should be packed, purchased, or photographed?"
    ]
  };
}

function normalizeGoals(value: unknown) {
  return (Array.isArray(value) ? value : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function normalizeEventPlan(raw: unknown, fallback: EventPlanResult, goals: string[]): EventPlanResult {
  const data = typeof raw === "object" && raw ? raw as Record<string, unknown> : {};

  const todos = Array.isArray(data.todos)
    ? data.todos.map((item) => ({
        title: String((item as Record<string, unknown>)?.title || "").trim(),
        ownerSuggestion: String((item as Record<string, unknown>)?.ownerSuggestion || "").trim(),
        dueTiming: String((item as Record<string, unknown>)?.dueTiming || "").trim(),
        notes: String((item as Record<string, unknown>)?.notes || "").trim()
      })).filter((item) => item.title)
    : fallback.todos;

  const checklists = Array.isArray(data.checklists)
    ? data.checklists
      .map((list) => ({
        title: String((list as Record<string, unknown>)?.title || "").trim(),
        type: String((list as Record<string, unknown>)?.type || "checklist").trim() || "checklist",
        items: Array.isArray((list as Record<string, unknown>)?.items)
          ? ((list as Record<string, unknown>).items as unknown[])
            .map((item) => ({
              item: String((item as Record<string, unknown>)?.item || "").trim(),
              quantity: String((item as Record<string, unknown>)?.quantity || "").trim(),
              notes: String((item as Record<string, unknown>)?.notes || "").trim()
            }))
            .filter((item) => item.item)
          : []
      }))
      .filter((list) => list.title || list.items.length)
      .map((list) => ({
        title: list.title || "Checklist",
        type: list.type,
        items: list.items
      }))
    : fallback.checklists;

  const shotIdeas = Array.isArray(data.shotIdeas)
    ? data.shotIdeas.map((item) => ({
        title: String((item as Record<string, unknown>)?.title || "").trim(),
        reason: String((item as Record<string, unknown>)?.reason || "").trim()
      })).filter((item) => item.title)
    : fallback.shotIdeas;

  return {
    summary: String(data.summary || "").trim() || fallback.summary,
    assumptions: normalizeStringList(data.assumptions, fallback.assumptions),
    todos: goals.includes("todo items") ? todos : [],
    checklists: goals.includes("shopping or packing lists") ? checklists : [],
    shotIdeas: goals.includes("photo shot ideas") ? shotIdeas : [],
    questions: normalizeStringList(data.questions, fallback.questions)
  };
}

function normalizeStringList(value: unknown, fallback: string[]) {
  const items = Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  return items.length ? items : fallback;
}

function safeJsonParse(value: string) {
  try {
    return JSON.parse(String(value || "").trim());
  } catch (_) {
    const matched = String(value || "").match(/\{[\s\S]*\}/);
    if (!matched) {
      throw new Error("AI did not return valid JSON.");
    }
    return JSON.parse(matched[0]);
  }
}

function getOpenAiKey() {
  return String(PropertiesService.getScriptProperties().getProperty(OPENAI_API_KEY_PROPERTY_KEY) || "").trim();
}

function throttleAiRequests() {
  const now = Date.now();
  const wait = Math.max(0, lastAiCallAt + AI_MIN_DELAY_MS - now);
  if (wait > 0) {
    Utilities.sleep(wait);
  }
  lastAiCallAt = Date.now();
}

function callOpenAi(systemPrompt: string, userPrompt: string, key: string) {
  const payload = {
    model: "gpt-4o-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ]
  };

  throttleAiRequests();

  let response: GoogleAppsScript.URL_Fetch.HTTPResponse;
  try {
    response = UrlFetchApp.fetch("https://api.openai.com/v1/chat/completions", {
      method: "post",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  } catch (error) {
    throw new Error(`AI HTTP error: ${(error as Error)?.message || error}`);
  }

  const status = response.getResponseCode();
  const body = response.getContentText();
  if (status < 200 || status >= 300) {
    throw new Error(`OpenAI request failed (${status}): ${body.slice(0, 300)}`);
  }

  const parsed = JSON.parse(body) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = String(parsed?.choices?.[0]?.message?.content || "").trim();
  if (!content) {
    throw new Error("OpenAI returned an empty response.");
  }

  return content;
}
