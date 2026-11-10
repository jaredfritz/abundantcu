// The site counts anonymous yard waste page actions in Supabase. That isn't part of the open-source tools, so this
// version does nothing.

export type YardWasteEvent =
  | "search_in_zone"
  | "search_outside"
  | "map_zone_click"
  | "calendar_open"
  | "calendar_add"
  | "reminder_submit"
  | "reminder_error";

export function trackYardWaste(_event: YardWasteEvent, _data: { zone?: string; detail?: string } = {}): void {}
