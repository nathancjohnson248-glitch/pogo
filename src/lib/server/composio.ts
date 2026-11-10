const COMPOSIO_BASE = "https://backend.composio.dev/api/v3.1";

function apiKey() {
  const key = process.env.COMPOSIO_API_KEY;
  if (!key) throw new Error("Composio is not configured.");
  return key;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${COMPOSIO_BASE}${path}`, {
    ...init,
    headers: {
      "x-api-key": apiKey(),
      "Content-Type": "application/json",
      ...(init.headers ?? {})
    },
    cache: "no-store"
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Composio request failed (${response.status}): ${text.slice(0, 700)}`);
  return (text ? JSON.parse(text) : null) as T;
}

export type ComposioTool = {
  slug: string;
  description: string;
  input_schema: Record<string, unknown>;
  toolkit: string;
  tags?: string[];
  no_auth?: boolean;
};

export async function createComposioSession(userId: string) {
  return request<{session_id:string;tool_router_tools:string[]}>("/tool_router/session", {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      toolkits: { enabled: ["gmail", "googlecalendar", "googledrive", "notion", "slack", "twitter", "tavily_mcp"] },
      manage_connections: {
        enable: true,
        callback_url: "https://heypogo.xyz/connections",
        enable_wait_for_connections: false,
        enable_connection_removal: true
      },
      search: { enable: true },
      execute: { enable_multi_execute: true },
    })
  });
}

export async function searchComposioTools(sessionId: string, useCase: string) {
  const result = await request<{
    results?: Array<{primary_tool_slugs?:string[];related_tool_slugs?:string[];toolkits?:string[]}>;
    tool_schemas?: Record<string, {tool_slug?:string;description?:string;toolkit?:string;input_schema?:Record<string,unknown>;hasFullSchema?:boolean;tags?:string[];no_auth?:boolean}>;
    toolkit_connection_statuses?: Array<{toolkit:string;has_active_connection:boolean;status_message?:string}>;
  }>(`/tool_router/session/${sessionId}/search`, {
    method: "POST",
    body: JSON.stringify({ queries: [{ use_case: useCase }], search_strategy: "auto" })
  });
  const schemas = Object.values(result.tool_schemas ?? {}).filter((item) => item.tool_slug && item.input_schema);
  return {
    tools: schemas.map((item) => ({
      slug: item.tool_slug!,
      description: item.description ?? item.tool_slug!,
      toolkit: (item.toolkit ?? item.tool_slug!.split("_")[0]).toLowerCase(),
      input_schema: item.input_schema!,
      tags: item.tags,
      no_auth: item.no_auth
    })),
    connections: result.toolkit_connection_statuses ?? []
  };
}

export async function executeComposioTool(sessionId: string, toolSlug: string, arguments_: Record<string, unknown>) {
  return request<{result_type:string;data?:unknown;error?:string}>(`/tool_router/session/${sessionId}/execute`, {
    method: "POST",
    body: JSON.stringify({ tool_slug: toolSlug, arguments: arguments_ })
  });
}

export async function createComposioConnectLink(sessionId: string, toolkit: string) {
  return request<{redirect_url:string;connected_account_id:string}>(`/tool_router/session/${sessionId}/link`, {
    method: "POST",
    body: JSON.stringify({ toolkit, callback_url: "https://heypogo.xyz/connections" })
  });
}
