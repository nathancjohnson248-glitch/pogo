import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy — Pogo" };

export default function Privacy() {
  return (
    <>
      <p className="text-[10px] font-semibold uppercase tracking-[.22em] text-[#898879]">Last updated November 2026</p>
      <h1 className="display mt-4 text-5xl leading-[1]">Privacy</h1>

      <h2>What Pogo collects</h2>
      <p>
        Pogo is a messaging-based assistant. To work, it stores the messages you exchange with it, your phone number, and the context you share in conversation — the things you ask it to remember about your work. If you connect an outside account (like email or a calendar), Pogo accesses it only through that provider&apos;s authorized connection, scoped to your own account.
      </p>

      <h2>How it&apos;s used</h2>
      <ul>
        <li>Your conversation history and saved context are used to answer you and carry work forward. They are scoped to you and never shared with other Pogo users.</li>
        <li>Messages are processed by the AI provider that powers Pogo&apos;s responses in order to generate replies.</li>
        <li>We don&apos;t sell your data, and we don&apos;t use your conversations to market to you.</li>
      </ul>

      <h2>Your choices</h2>
      <ul>
        <li>You can ask Pogo to forget something it has remembered, at any time, in the conversation itself.</li>
        <li>You can disconnect a connected account at any time; Pogo loses access when you do.</li>
        <li>To request deletion of your data entirely, message Pogo or contact us and we&apos;ll remove your account records.</li>
      </ul>

      <h2>Messaging</h2>
      <p>
        Pogo only replies to people who message it first. It never sends unsolicited messages, and standard carrier messaging rates may apply on your side.
      </p>
    </>
  );
}
