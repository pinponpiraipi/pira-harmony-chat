import { applyTab } from "./cloak";

/** Updates the tab title/icon (with the unread count) for the chosen mode. */
export function setUnreadFavicon(count: number) {
  void applyTab(count);
}
