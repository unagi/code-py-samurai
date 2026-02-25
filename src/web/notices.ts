/**
 * Site-wide notices (known bugs, announcements, etc.).
 *
 * To add a notice, push an entry to `activeNotices` and add the
 * corresponding i18n key under the `"notices"` namespace.
 * Notices are displayed as a single-line strip below the header.
 */

export interface Notice {
  /** Unique ID for dismiss tracking via localStorage. */
  id: string;
  /** Visual severity — controls background/icon colour. */
  severity: "info" | "warning";
  /** i18n key for the notice message text. */
  messageKey: string;
  /** Optional URL (e.g. a GitHub Issue) shown as a link after the message. */
  link?: string;
  /** i18n key for the link label. Falls back to the raw URL if omitted. */
  linkLabelKey?: string;
  /** ISO-8601 date string. The notice is hidden after this date. */
  expiresAt?: string;
}

/**
 * Currently active notices.
 *
 * Add entries here when a notice needs to be shown.
 * Remove or let them expire when they are no longer relevant.
 */
export const activeNotices: Notice[] = [
  // Example:
  // {
  //   id: "known-bug-example-2026-02",
  //   severity: "warning",
  //   messageKey: "notices.exampleBug",
  //   link: "https://github.com/unagi/code-py-samurai/issues/1",
  //   linkLabelKey: "notices.seeIssue",
  // },
];
