import { randomUUID } from "node:crypto";

const base = () => {
  const projectId = process.env.PHOTON_PROJECT_ID;
  const apiKey = process.env.PHOTON_API_KEY;
  if (!projectId || !apiKey) throw new Error("Photon is not configured.");
  return { url: `https://api.photon.codes/v1/projects/${projectId}`, apiKey };
}

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

export async function sendPhotonText(spaceId: string, senderId: string, text: string, idempotencyKey?: string) {
  return photonRequest("/messages", {
    spaceId,
    senderId,
    content: { type: "text", format: "plain", text }
  });
}

export function getPhotonAgentUserId() {
  const id = process.env.PHOTON_AGENT_USER_ID;
  if (!id) throw new Error("Add PHOTON_AGENT_USER_ID from your Pogo agent identity in Photon.");
  return id;
}
