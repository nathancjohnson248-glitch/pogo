import { randomUUID } from "node:crypto";

const base = () => {
  const projectId = process.env.PHOTON_PROJECT_ID;
  const apiKey = process.env.PHOTON_API_KEY;
  if (!projectId || !apiKey) throw new Error("Photon is not configured.");
  return { url: `https://api.photon.codes/v1/projects/${projectId}`, apiKey };
};

export async function photonRequest<T>(path: string, body: unknown, idempotencyKey?: string): Promise<T> {
  const { url, apiKey } = base();
  const response = await fetch(`${url}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey ?? randomUUID()
    },
    body: JSON.stringify(body),
    cache: "no-store"
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Photon request failed (${response.status}): ${text.slice(0, 500)}`);
  return (text ? JSON.parse(text) : null) as T;
}

export async function sendPhotonText(
  spaceId: string,
  senderId: string,
  text: string,
  parentMessageId?: string,
  idempotencyKey?: string
) {
  return photonRequest("/messages", {
    spaceId,
    senderId,
    ...(parentMessageId ? { parentMessageId } : {}),
    content: { type: "text", format: "plain", text }
  }, idempotencyKey);
}

export type SharedLineAssignment = {
  assignmentId: string;
  assignedPhoneNumber: string;
  handle: string;
  platform: string;
  projectId: string;
  createdAt: string;
  releasedAt?: string;
};

// POST /v1/projects/{id}/platforms/imessage/assignments — assigns a number
// from Photon's shared pool to one human handle. Idempotency key derived from
// the handle so a double submit cannot consume two slots.
export async function createSharedLineAssignment(handle: string, firstName?: string) {
  return photonRequest<SharedLineAssignment>(
    "/platforms/imessage/assignments",
    { handle, ...(firstName ? { firstName } : {}) },
    `pogo-assign-${handle}`
  );
}

export async function listSharedLineAssignments(pageToken?: string) {
  const { url, apiKey } = base();
  const query = pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : "";
  const response = await fetch(`${url}/platforms/imessage/assignments${query}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store"
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Photon request failed (${response.status}): ${text.slice(0, 500)}`);
  return JSON.parse(text) as { assignments: SharedLineAssignment[]; nextPageToken?: string };
}

export function getPhotonAgentUserId() {
  const id = process.env.PHOTON_AGENT_USER_ID;
  if (!id) throw new Error("Photon agent identity is not configured.");
  return id;
}
