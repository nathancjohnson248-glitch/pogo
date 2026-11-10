import { createHmac, timingSafeEqual } from "node:crypto";

export type PhotonContent = {
  type?: string;
  text?: string;
  reaction?: string;
  attachmentId?: string;
  metadata?: Record<string, unknown>;
  parts?: PhotonContent[];
  question?: string;
  options?: Array<{ id?: string; text?: string; title?: string }>;
  selectedOptions?: Array<{ id?: string; text?: string; title?: string }>;
};

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

// Standard Webhooks (https://www.standardwebhooks.com/) HMAC verification as
// used by Photon: signature over `${id}.${timestamp}.${body}` with a
// base64-decoded whsec_ key, compared against each `v1,<sig>` entry.
export function verifyPhotonSignature(
  rawBody: string,
  secret: string,
  signatureHeader: string,
  webhookId: string,
  timestamp: string,
  nowMs = Date.now()
) {
  if (!signatureHeader || !webhookId || !timestamp || !/^\d+$/.test(timestamp)) return false;
  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt) || Math.abs(nowMs / 1000 - sentAt) > 300) return false;

  const key = secret.startsWith("whsec_")
    ? Buffer.from(secret.slice(6), "base64")
    : Buffer.from(secret, "utf8");
  const signedContent = `${webhookId}.${timestamp}.${rawBody}`;
  const expected = createHmac("sha256", key).update(signedContent).digest("base64");

  return signatureHeader.split(/\s+/).some((entry) => {
    const [version, value] = entry.split(",", 2);
    return version === "v1" && !!value && safeEqual(value, expected);
  });
}

export function contentText(content?: PhotonContent): string {
  if (!content) return "";
  if (content.type === "text") return content.text ?? "";
  if (content.type === "group") return (content.parts ?? []).map(contentText).filter(Boolean).join("\n");
  if (content.type === "reaction") return content.reaction ? `[reaction: ${content.reaction}]` : "[reaction received]";
  if (content.type === "voice") return "[voice message received]";
  if (content.type === "attachment") return "[attachment received]";
  if (content.type === "poll") return `[poll: ${content.question ?? "question"}]`;
  if (content.type === "poll.vote") return "[poll vote received]";
  if (content.type === "message.update") return content.text ?? "[message update received]";
  if (content.type) return `[${content.type} received]`;
  return "";
}
