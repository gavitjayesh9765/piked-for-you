import type { ContactTopic } from "./types";

/**
 * The four things a contact message can be about, and their labels.
 *
 * In a plain module rather than beside the filter control that uses it, and
 * that is not organisational tidiness — it is a correctness requirement the
 * build enforces. Exporting this array from `components/admin/MessageListControls`
 * (a `"use client"` module) and importing it into the messages page (a Server
 * Component) hands the server a client-reference PROXY rather than the array:
 *
 *     TypeError: MESSAGE_TOPICS.map is not a function
 *
 * A module with no `"use client"` directive is compiled for whichever side
 * imports it, so both get the real data.
 *
 * The values are the database's `topic` enum, checked by a CHECK constraint on
 * `contact_messages` and by the `ContactTopic` literal in app/modules/contact.
 * The labels are the same ones the public form shows, so an admin reading the
 * queue sees the words the sender chose from.
 */
export const CONTACT_TOPICS: readonly { value: ContactTopic; label: string }[] = [
  { value: "research_request", label: "Research request" },
  { value: "correction", label: "Correction" },
  { value: "press", label: "Press & partnerships" },
  { value: "general", label: "General" },
];

/** Topic value → label, for rendering a stored `topic` string. */
export const CONTACT_TOPIC_LABEL: Record<string, string> = Object.fromEntries(
  CONTACT_TOPICS.map((t) => [t.value, t.label]),
);
