import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { contentText, verifyPhotonSignature } from "../src/lib/server/photon-webhook.ts";

const RAW_SECRET = Buffer.from("test-signing-key-material-012345");
const SECRET = `whsec_${RAW_SECRET.toString("base64")}`;

function sign(body: string, id: string, timestamp: string) {
  return createHmac("sha256", RAW_SECRET).update(`${id}.${timestamp}.${body}`).digest("base64");
}

const NOW = 1_762_750_000_000;
const TS = String(Math.floor(NOW / 1000));
const BODY = JSON.stringify({ id: "pho_evt_1", type: "message.received" });

test("accepts a valid v1 signature", () => {
  const sig = `v1,${sign(BODY, "msg_1", TS)}`;
  assert.equal(verifyPhotonSignature(BODY, SECRET, sig, "msg_1", TS, NOW), true);
});

test("accepts a valid signature among rotated ones", () => {
  const sig = `v1,${Buffer.from("wrong".repeat(7)).toString("base64")} v1,${sign(BODY, "msg_1", TS)}`;
  assert.equal(verifyPhotonSignature(BODY, SECRET, sig, "msg_1", TS, NOW), true);
});

test("rejects a tampered body", () => {
  const sig = `v1,${sign(BODY, "msg_1", TS)}`;
  assert.equal(verifyPhotonSignature(BODY + "x", SECRET, sig, "msg_1", TS, NOW), false);
});

test("rejects a wrong webhook id", () => {
  const sig = `v1,${sign(BODY, "msg_1", TS)}`;
  assert.equal(verifyPhotonSignature(BODY, SECRET, sig, "msg_2", TS, NOW), false);
});

test("rejects a replayed (stale) timestamp", () => {
  const oldTs = String(Math.floor(NOW / 1000) - 600);
  const sig = `v1,${sign(BODY, "msg_1", oldTs)}`;
  assert.equal(verifyPhotonSignature(BODY, SECRET, sig, "msg_1", oldTs, NOW), false);
});

test("rejects missing or malformed headers", () => {
  assert.equal(verifyPhotonSignature(BODY, SECRET, "", "msg_1", TS, NOW), false);
  assert.equal(verifyPhotonSignature(BODY, SECRET, "v1,abc", "", TS, NOW), false);
  assert.equal(verifyPhotonSignature(BODY, SECRET, "v1,abc", "msg_1", "not-a-number", NOW), false);
});

test("contentText flattens known content shapes", () => {
  assert.equal(contentText({ type: "text", text: "hi" }), "hi");
  assert.equal(
    contentText({ type: "group", parts: [{ type: "text", text: "a" }, { type: "attachment" }] }),
    "a\n[attachment received]"
  );
  assert.equal(contentText({ type: "reaction", reaction: "love" }), "[reaction: love]");
  assert.equal(contentText(undefined), "");
});
