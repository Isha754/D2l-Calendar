export type EventItem = {
  id: string;
  title: string;
  description?: string | null;
  startAt: string;
  endAt?: string | null;
  url?: string | null;
  className?: string | null;
  source: "d2l" | "manual";
};

let cachedEvents: EventItem[] = [];

export const getEvents = () => cachedEvents;

export const setD2lEvents = (events: EventItem[]) => {
  const manualEvents = cachedEvents.filter((event) => event.source === "manual");
  cachedEvents = [...manualEvents, ...events];
};

export const addManualEvent = (event: EventItem) => {
  cachedEvents = [event, ...cachedEvents];
  return event;
};

export const removeManualEvent = (id: string) => {
  const existing = cachedEvents.find((event) => event.id === id);
  if (!existing || existing.source !== "manual") {
    return null;
  }
  cachedEvents = cachedEvents.filter((event) => event.id !== id);
  return existing;
};
