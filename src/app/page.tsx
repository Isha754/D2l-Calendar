"use client";

import { useEffect, useMemo, useState } from "react";

type EventItem = {
  id: string;
  title: string;
  description?: string | null;
  startAt: string;
  endAt?: string | null;
  url?: string | null;
  className?: string | null;
  source?: "d2l" | "manual";
};

type TaskItem = {
  id: string;
  title: string;
  done: boolean;
  createdAt: string;
  className?: string | null;
};

type ClassItem = {
  id: string;
  name: string;
  createdAt: string;
};

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const toDateKey = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatTime = (value: string) =>
  new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const toDateInput = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const classColorPalette = [
  "bg-[#1E1E1E]",
  "bg-[#C79AA5]",
  "bg-[#8b5cf6]",
  "bg-[#2563eb]",
  "bg-[#16a34a]",
  "bg-[#d97706]",
  "bg-[#0891b2]",
  "bg-[#9333ea]",
];

const getClassColor = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) % classColorPalette.length;
  }
  return classColorPalette[Math.abs(hash) % classColorPalette.length];
};

const truncateLabel = (value: string, max = 36) => {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
};

export default function Home() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isErrorMessage, setIsErrorMessage] = useState(false);
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [taskTitle, setTaskTitle] = useState("");
  const [taskClass, setTaskClass] = useState("");
  const [newClassName, setNewClassName] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState(() => toDateInput(new Date()));
  const [eventTime, setEventTime] = useState("09:00");
  const [eventEndTime, setEventEndTime] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventClass, setEventClass] = useState("");
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [isClassManagerOpen, setIsClassManagerOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarMode, setSidebarMode] = useState<"day" | "tasks" | "classes">(
    "day"
  );
  const [expandedClassIds, setExpandedClassIds] = useState<Set<string>>(
    () => new Set()
  );
  const [isEventPopupOpen, setIsEventPopupOpen] = useState(false);
  const [activeEvent, setActiveEvent] = useState<EventItem | null>(null);
  const [hoveredWeekIndex, setHoveredWeekIndex] = useState<number | null>(null);
  const [isDayPopupOpen, setIsDayPopupOpen] = useState(false);
  const [dayPopupDate, setDayPopupDate] = useState<Date | null>(null);
  const [dayPopupEvents, setDayPopupEvents] = useState<EventItem[]>([]);
  const [classFilter, setClassFilter] = useState("");
  const [expandedEventIds, setExpandedEventIds] = useState<Set<string>>(
    () => new Set()
  );
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const classesStorageKey = "d2lPlannerClasses";
  const blockedClassesStorageKey = "d2lPlannerBlockedClasses";
  const sidebarStorageKey = "d2lPlannerSidebarOpen";
  const lastSyncStorageKey = "d2lPlannerLastSyncAt";
  const [blockedClassNames, setBlockedClassNames] = useState<Set<string>>(
    () => new Set()
  );

  const fetchEvents = async () => {
    setIsLoading(true);
    setMessage(null);
    setIsErrorMessage(false);
    try {
      const res = await fetch("/api/events");
      if (!res.ok) {
        throw new Error("Failed to load events.");
      }
      const data = (await res.json()) as { events: EventItem[] };
      setEvents(data.events ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
      setIsErrorMessage(true);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTasks = async () => {
    try {
      const res = await fetch("/api/tasks");
      if (!res.ok) {
        throw new Error("Failed to load tasks.");
      }
      const data = (await res.json()) as { tasks: TaskItem[] };
      setTasks(data.tasks ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load tasks.");
      setIsErrorMessage(true);
    }
  };

  const fetchClasses = () => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(classesStorageKey);
      if (!raw) {
        setClasses([]);
        return;
      }
      const parsed = JSON.parse(raw) as ClassItem[];
      setClasses(Array.isArray(parsed) ? parsed : []);
    } catch {
      setClasses([]);
    }
  };

  const fetchBlockedClasses = () => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(blockedClassesStorageKey);
      if (!raw) {
        setBlockedClassNames(new Set());
        return;
      }
      const parsed = JSON.parse(raw) as string[];
      setBlockedClassNames(new Set(Array.isArray(parsed) ? parsed : []));
    } catch {
      setBlockedClassNames(new Set());
    }
  };

  const persistClasses = (next: ClassItem[]) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(classesStorageKey, JSON.stringify(next));
  };

  const persistBlockedClasses = (next: Set<string>) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      blockedClassesStorageKey,
      JSON.stringify(Array.from(next))
    );
  };

  const syncClassesFromItems = (items: Array<{ className?: string | null }>) => {
    const names = new Set(
      items
        .map((item) => item.className?.trim())
        .filter((value): value is string => Boolean(value))
    );
    if (names.size === 0) return;

    setClasses((prev) => {
      const blocked = new Set(
        Array.from(blockedClassNames).map((name) => name.toLowerCase())
      );
      const existingNames = new Set(prev.map((item) => item.name.toLowerCase()));
      const next = [...prev];
      let changed = false;

      names.forEach((name) => {
        if (
          !existingNames.has(name.toLowerCase()) &&
          !blocked.has(name.toLowerCase())
        ) {
          next.push({
            id: crypto.randomUUID(),
            name,
            createdAt: new Date().toISOString(),
          });
          changed = true;
        }
      });

      if (!changed) {
        return prev;
      }
      persistClasses(next);
      return next;
    });
  };

  const addClass = () => {
    const name = newClassName.trim();
    if (!name) return;
    const existing = classes.find(
      (item) => item.name.toLowerCase() === name.toLowerCase()
    );
    if (existing) {
      setTaskClass(existing.name);
      setEventClass(existing.name);
      setNewClassName("");
      return;
    }
    const created: ClassItem = {
      id: crypto.randomUUID(),
      name,
      createdAt: new Date().toISOString(),
    };
    const next = [created, ...classes];
    setClasses(next);
    persistClasses(next);
    setNewClassName("");
  };

  const removeClass = (id: string) => {
    const removed = classes.find((item) => item.id === id);
    if (!removed) return;
    const next = classes.filter((item) => item.id !== id);
    setClasses(next);
    persistClasses(next);
    setBlockedClassNames((prev) => {
      const updated = new Set(prev);
      updated.add(removed.name);
      persistBlockedClasses(updated);
      return updated;
    });
    if (classFilter === removed.name) {
      setClassFilter("");
    }
    setTasks((prev) =>
      prev.map((task) =>
        task.className === removed.name ? { ...task, className: null } : task
      )
    );
    setEvents((prev) =>
      prev.map((event) =>
        event.className === removed.name ? { ...event, className: null } : event
      )
    );
  };

  const syncCalendar = async () => {
    setIsSyncing(true);
    setMessage(null);
    setIsErrorMessage(false);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Sync failed.");
      }
      setMessage(`Synced ${data.synced ?? 0} event(s) from D2L.`);
      setIsErrorMessage(false);
      const now = new Date().toISOString();
      setLastSyncAt(now);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(lastSyncStorageKey, now);
      }
      await fetchEvents();
      await fetchTasks();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sync failed.");
      setIsErrorMessage(true);
    } finally {
      setIsSyncing(false);
    }
  };

  const addTask = async () => {
    const title = taskTitle.trim();
    if (!title) return;
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, className: taskClass.trim() || null }),
      });
      const data = (await res.json()) as { task?: TaskItem; error?: string };
      if (!res.ok || !data.task) {
        throw new Error(data.error ?? "Failed to add task.");
      }
      setTasks((prev) => [data.task!, ...prev]);
      setTaskTitle("");
      setTaskClass("");
      setMessage(null);
      setIsErrorMessage(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to add task.");
      setIsErrorMessage(true);
    }
  };


  const toggleTask = async (id: string) => {
    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = (await res.json()) as { task?: TaskItem; error?: string };
      if (!res.ok || !data.task) {
        throw new Error(data.error ?? "Failed to update task.");
      }
      setTasks((prev) =>
        prev.map((task) => (task.id === id ? data.task! : task))
      );
      setMessage(null);
      setIsErrorMessage(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to update task.");
      setIsErrorMessage(true);
    }
  };

  const removeTask = async (id: string) => {
    try {
      const res = await fetch(`/api/tasks?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { task?: TaskItem; error?: string };
      if (!res.ok || !data.task) {
        throw new Error(data.error ?? "Failed to remove task.");
      }
      setTasks((prev) => prev.filter((task) => task.id !== id));
      setMessage(null);
      setIsErrorMessage(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to remove task.");
      setIsErrorMessage(true);
    }
  };

  const addEvent = async () => {
    const title = eventTitle.trim();
    if (!title || !eventDate) {
      setMessage("Event title and date are required.");
      setIsErrorMessage(true);
      return;
    }
    const startAt = `${eventDate}T${eventTime || "09:00"}:00`;
    const endAt = eventEndTime ? `${eventDate}T${eventEndTime}:00` : null;
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: eventDescription.trim() || null,
          startAt,
          endAt,
          className: eventClass.trim() || null,
        }),
      });
      const data = (await res.json()) as { event?: EventItem; error?: string };
      if (!res.ok || !data.event) {
        throw new Error(data.error ?? "Failed to add event.");
      }
      setEvents((prev) => [data.event!, ...prev]);
      setEventTitle("");
      setEventDescription("");
      setEventEndTime("");
      setEventClass("");
      setIsAddEventOpen(false);
      setMessage("Event added.");
      setIsErrorMessage(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to add event.");
      setIsErrorMessage(true);
    }
  };

  const removeEvent = async (id: string) => {
    try {
      const res = await fetch(`/api/events?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { event?: EventItem; error?: string };
      if (!res.ok || !data.event) {
        throw new Error(data.error ?? "Failed to remove event.");
      }
      setEvents((prev) => prev.filter((event) => event.id !== id));
      setMessage(null);
      setIsErrorMessage(false);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed to remove event."
      );
      setIsErrorMessage(true);
    }
  };

  const openEventPopup = (event: EventItem) => {
    setSelectedDate(new Date(event.startAt));
    setSidebarMode("day");
    setIsSidebarOpen(true);
    setActiveEvent(event);
    setIsEventPopupOpen(true);
  };

  const openDayPopup = (day: Date, events: EventItem[]) => {
    setSelectedDate(day);
    setSidebarMode("day");
    setIsSidebarOpen(true);
    setDayPopupDate(day);
    setDayPopupEvents(events);
    setIsDayPopupOpen(true);
  };

  const toggleClassExpand = (id: string) => {
    setExpandedClassIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleEventDetails = (id: string) => {
    setExpandedEventIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const copyEventLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Link copied to clipboard.");
      setIsErrorMessage(false);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed to copy link."
      );
      setIsErrorMessage(true);
    }
  };

  useEffect(() => {
    const load = async () => {
      await syncCalendar();
    };
    load();
  }, []);

  useEffect(() => {
    fetchTasks();
  }, []);

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    fetchBlockedClasses();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(sidebarStorageKey);
    if (saved !== null) {
      setIsSidebarOpen(saved === "true");
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(sidebarStorageKey, String(isSidebarOpen));
  }, [isSidebarOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(lastSyncStorageKey);
    if (saved) {
      setLastSyncAt(saved);
    }
  }, []);


  useEffect(() => {
    syncClassesFromItems(events);
  }, [events, blockedClassNames]);

  useEffect(() => {
    syncClassesFromItems(tasks);
  }, [tasks, blockedClassNames]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      if (tagName === "input" || tagName === "textarea" || tagName === "select") {
        return;
      }
      if (event.key === "s" || event.key === "S") {
        event.preventDefault();
        syncCalendar();
      }
      if (event.key === "a" || event.key === "A") {
        event.preventDefault();
        setIsAddEventOpen(true);
      }
      if (event.key === "t" || event.key === "T") {
        event.preventDefault();
        const today = new Date();
        setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
        setSelectedDate(today);
        setSidebarMode("day");
        setIsSidebarOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    setEventDate(toDateInput(selectedDate));
  }, [selectedDate]);

  const days = useMemo(() => {
    const startOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    const startOfGrid = new Date(startOfMonth);
    startOfGrid.setDate(startOfGrid.getDate() - startOfGrid.getDay());

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(startOfGrid);
      date.setDate(startOfGrid.getDate() + index);
      return date;
    });
  }, [viewDate]);

  const filteredEvents = useMemo(() => {
    if (!classFilter) return events;
    if (classFilter === "__none__") {
      return events.filter((event) => !event.className);
    }
    return events.filter((event) => event.className === classFilter);
  }, [classFilter, events]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, EventItem[]>();
    for (const event of filteredEvents) {
      const startKey = toDateKey(new Date(event.startAt));
      const list = map.get(startKey) ?? [];
      list.push(event);
      map.set(startKey, list);
    }
    for (const [, list] of map) {
      list.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    }
    return map;
  }, [filteredEvents]);

  const selectedKey = toDateKey(selectedDate);
  const selectedEvents = eventsByDay.get(selectedKey) ?? [];
  const totalEventCount = events.length;
  const filteredEventCount = filteredEvents.length;

  const sortedClasses = useMemo(
    () =>
      [...classes].sort((a, b) =>
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      ),
    [classes]
  );

  const eventsByClassName = useMemo(() => {
    const map = new Map<string, EventItem[]>();
    events.forEach((event) => {
      if (!event.className) return;
      const list = map.get(event.className) ?? [];
      list.push(event);
      map.set(event.className, list);
    });
    for (const [, list] of map) {
      list.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    }
    return map;
  }, [events]);

  const upcomingByClass = useMemo(() => {
    const now = Date.now();
    const map = new Map<string, EventItem | null>();
    sortedClasses.forEach((item) => {
      const list = eventsByClassName.get(item.name) ?? [];
      const next = list.find((event) => new Date(event.startAt).getTime() >= now) ?? null;
      map.set(item.name, next);
    });
    return map;
  }, [eventsByClassName, sortedClasses]);

  const goToPreviousMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const monthLabel = `${monthNames[viewDate.getMonth()]} ${viewDate.getFullYear()}`;

  return (
    <div
      className="relative h-screen overflow-hidden bg-[#C8BDD6] text-[#1E1E1E]"
      style={{
        fontFamily:
          '"Segoe UI", "Segoe UI Emoji", "Segoe UI Symbol", "Apple Color Emoji", "Noto Color Emoji", sans-serif',
      }}
    >
      <div className="pointer-events-none absolute -top-28 right-[-12%] h-80 w-80 rounded-full bg-[#C79AA5]/50 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-20%] left-[-10%] h-96 w-96 rounded-full bg-[#B9AFC8]/50 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1200px_circle_at_10%_10%,rgba(255,255,255,0.7),transparent)]" />

      <main
        className={`relative mx-auto grid h-full w-full max-w-[1700px] grid-cols-1 gap-6 px-4 pb-6 pt-6 sm:px-8 ${
          isSidebarOpen
            ? "lg:grid-cols-[320px_minmax(0,1fr)]"
            : "lg:grid-cols-[88px_minmax(0,1fr)]"
        }`}
      >
        <aside className="hidden lg:flex min-w-[300px] flex-col gap-5 rounded-3xl border border-[#E6E6E2] bg-[#F4F3EF]/85 p-5 shadow-[0_16px_40px_rgba(15,27,29,0.08)] backdrop-blur overflow-hidden">
          {!isSidebarOpen ? (
            <div className="flex h-full flex-col items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1E1E1E] text-xs font-semibold uppercase tracking-[0.2em] text-[#F4F3EF]">
                D2L
              </div>
              <div className="mt-4 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSidebarMode("day");
                    setIsSidebarOpen(true);
                  }}
                  className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#E6E6E2] bg-[#F4F3EF] text-xl text-[#1E1E1E] hover:border-[#1E1E1E]"
                  aria-label="Calendar"
                >
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="4" width="18" height="18" rx="3" />
                    <path d="M8 2v4M16 2v4M3 10h18" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSidebarMode("tasks");
                    setIsSidebarOpen(true);
                  }}
                  className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#E6E6E2] bg-[#F4F3EF] text-xl text-[#1E1E1E] hover:border-[#1E1E1E]"
                  aria-label="Tasks"
                >
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="4" />
                    <path d="m7 12 3 3 7-7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSidebarMode("classes");
                    setIsSidebarOpen(true);
                  }}
                  className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#E6E6E2] bg-[#F4F3EF] text-xl text-[#1E1E1E] hover:border-[#1E1E1E]"
                  aria-label="Classes"
                >
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M22 10 12 4 2 10l10 6 10-6Z" />
                    <path d="M6 12v5c0 2 3 3 6 3s6-1 6-3v-5" />
                  </svg>
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#1E1E1E] text-xs font-semibold uppercase tracking-[0.2em] text-[#F4F3EF]">
                    D2L
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[#8C8C8C]">
                      Planner
                    </p>
                    <p className="text-lg font-semibold text-[#1E1E1E] font-[var(--font-display)]">
                      Calendar
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E6E6E2] text-[#4A4A4A] transition hover:-translate-y-0.5 hover:border-[#1E1E1E] hover:text-[#1E1E1E]"
                  onClick={() => setIsSidebarOpen(false)}
                  aria-label="Collapse sidebar"
                >
                  X
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSidebarMode("day")}
                  className={`flex-1 rounded-full border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] ${
                    sidebarMode === "day"
                      ? "border-[#1E1E1E] bg-[#1E1E1E] text-[#F4F3EF]"
                      : "border-[#E6E6E2] text-[#4A4A4A] hover:border-[#1E1E1E]"
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className="h-3.5 w-3.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="4" width="18" height="18" rx="3" />
                      <path d="M8 2v4M16 2v4M3 10h18" />
                    </svg>
                    Day
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setSidebarMode("tasks")}
                  className={`flex-1 rounded-full border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] ${
                    sidebarMode === "tasks"
                      ? "border-[#1E1E1E] bg-[#1E1E1E] text-[#F4F3EF]"
                      : "border-[#E6E6E2] text-[#4A4A4A] hover:border-[#1E1E1E]"
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className="h-3.5 w-3.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="3" width="18" height="18" rx="4" />
                      <path d="m7 12 3 3 7-7" />
                    </svg>
                    Tasks
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setSidebarMode("classes")}
                  className={`flex-1 rounded-full border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] ${
                    sidebarMode === "classes"
                      ? "border-[#1E1E1E] bg-[#1E1E1E] text-[#F4F3EF]"
                      : "border-[#E6E6E2] text-[#4A4A4A] hover:border-[#1E1E1E]"
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className="h-3.5 w-3.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M22 10 12 4 2 10l10 6 10-6Z" />
                      <path d="M6 12v5c0 2 3 3 6 3s6-1 6-3v-5" />
                    </svg>
                    Classes
                  </span>
                </button>
              </div>

              {sidebarMode === "day" && (
                <div className="rounded-3xl border border-[#E6E6E2] bg-[#F4F3EF]/95 p-5 shadow-[0_18px_45px_rgba(15,27,29,0.1)] backdrop-blur">
                  <div className="mb-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-[#8C8C8C]">
                      {selectedDate.toLocaleDateString([], { weekday: "short" })} ·{" "}
                      {selectedDate.toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                    <h3 className="text-lg font-semibold text-[#1E1E1E] font-[var(--font-display)]">
                      Day Details
                    </h3>
                  </div>
                  {selectedEvents.length === 0 && (
                    <p className="text-sm text-[#8C8C8C]">No events for this day.</p>
                  )}
                  <div className="flex flex-col gap-3">
                    {selectedEvents.map((event) => (
                      <div
                        key={event.id}
                        className="rounded-2xl border border-[#E6E6E2] bg-[#F4F3EF] px-4 py-3 text-sm text-[#4A4A4A]"
                      >
                        <div className="flex flex-col gap-2">
                          <p
                            className="font-semibold leading-snug"
                            title={event.title}
                            style={{
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            {event.title}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-[#8C8C8C]">
                            <span className="rounded-full border border-[#C79AA5] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-[#C79AA5]">
                              Due
                            </span>
                            <span>•</span>
                            <span>
                              {event.endAt
                                ? `${formatTime(event.startAt)} - ${formatTime(event.endAt)}`
                                : formatTime(event.startAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className="rounded-full border border-[#1E1E1E] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#1E1E1E] transition hover:-translate-y-0.5 hover:bg-[#1E1E1E] hover:text-[#F4F3EF]"
                      onClick={syncCalendar}
                      disabled={isSyncing}
                    >
                      {isSyncing ? "Syncing..." : "Sync D2L"}
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-[#8C8C8C] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#4A4A4A] transition hover:-translate-y-0.5 hover:border-[#1E1E1E] hover:text-[#1E1E1E]"
                      onClick={fetchEvents}
                      disabled={isLoading}
                    >
                      {isLoading ? "Refreshing..." : "Refresh"}
                    </button>
                  </div>
                </div>
              )}

              {sidebarMode === "tasks" && (
                <div className="rounded-3xl border border-[#E6E6E2] bg-[#F4F3EF]/95 p-5 shadow-[0_18px_45px_rgba(15,27,29,0.1)] backdrop-blur">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold text-[#1E1E1E] font-[var(--font-display)]">
                      Checklist
                    </h3>
                    <button
                      type="button"
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-[#1E1E1E] text-sm font-semibold text-[#1E1E1E] transition hover:-translate-y-0.5 hover:bg-[#1E1E1E] hover:text-[#F4F3EF]"
                      onClick={addTask}
                      aria-label="Add task"
                    >
                      +
                    </button>
                  </div>
                  <div className="mt-4 flex flex-col gap-3">
                    <input
                      value={taskTitle}
                      onChange={(event) => setTaskTitle(event.target.value)}
                      placeholder="Add a task..."
                      className="w-full rounded-full border border-[#E6E6E2] bg-[#F4F3EF] px-4 py-3 text-sm text-[#4A4A4A] focus:border-[#1E1E1E] focus:outline-none"
                    />
                    <select
                      value={taskClass}
                      onChange={(event) => setTaskClass(event.target.value)}
                      className="w-full rounded-full border border-[#E6E6E2] bg-[#F4F3EF] px-4 py-2 text-sm text-[#4A4A4A] focus:border-[#1E1E1E] focus:outline-none"
                    >
                      <option value="">No class</option>
                      {sortedClasses.map((item) => (
                        <option key={item.id} value={item.name} title={item.name}>
                          {truncateLabel(item.name)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-4 flex flex-col gap-3">
                    {tasks.length === 0 && (
                      <p className="text-sm text-[#8C8C8C]">Nothing on the list yet.</p>
                    )}
                    {tasks.map((task) => (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.setData("text/plain", task.id);
                        }}
                        className="flex items-start gap-3 rounded-2xl border border-[#E6E6E2] bg-[#F4F3EF] px-4 py-3 text-sm text-[#4A4A4A] hover:border-[#1E1E1E]"
                      >
                        <button
                          type="button"
                          onClick={() => toggleTask(task.id)}
                          aria-label={task.done ? "Mark incomplete" : "Mark complete"}
                          className={`mt-1 flex h-5 w-5 items-center justify-center rounded border text-[10px] ${
                            task.done
                              ? "border-[#1E1E1E] bg-[#1E1E1E] text-[#F4F3EF]"
                              : "border-[#E6E6E2] text-transparent"
                          }`}
                        >
                          ?
                        </button>
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span
                            className={`font-semibold ${
                              task.done ? "line-through text-[#8C8C8C]" : ""
                            }`}
                          >
                            {task.title}
                          </span>
                          <span className="text-[10px] uppercase tracking-[0.2em] text-[#8C8C8C]">
                            {task.className || "Personal task"}
                          </span>
                        </div>
                        <button
                          onClick={() => removeTask(task.id)}
                          className="shrink-0 text-[10px] uppercase tracking-[0.2em] text-[#C79AA5] hover:text-[#1E1E1E]"
                          aria-label="Remove task"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {sidebarMode === "classes" && (
                <div className="rounded-3xl border border-[#E6E6E2] bg-[#F4F3EF]/95 p-5 shadow-[0_18px_45px_rgba(15,27,29,0.1)] backdrop-blur">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-[#1E1E1E] font-[var(--font-display)]">
                      Classes
                    </h3>
                    <button
                      type="button"
                      className="rounded-full border border-[#E6E6E2] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#4A4A4A] hover:border-[#1E1E1E] hover:text-[#1E1E1E]"
                      onClick={() => setIsClassManagerOpen(true)}
                    >
                      Manage
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.2em]">
                    <span className="text-[#8C8C8C]">Filter:</span>
                    <button
                      type="button"
                      onClick={() => setClassFilter("")}
                      className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${
                        classFilter === ""
                          ? "border-[#1E1E1E] bg-[#1E1E1E] text-[#F4F3EF]"
                          : "border-[#E6E6E2] text-[#4A4A4A] hover:border-[#1E1E1E]"
                      }`}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setClassFilter("__none__")}
                      className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${
                        classFilter === "__none__"
                          ? "border-[#1E1E1E] bg-[#1E1E1E] text-[#F4F3EF]"
                          : "border-[#E6E6E2] text-[#4A4A4A] hover:border-[#1E1E1E]"
                      }`}
                    >
                      None
                    </button>
                  </div>
                  <div className="mt-4 max-h-[570px] flex flex-col gap-3 overflow-y-auto pr-1">
                    {sortedClasses.length === 0 && (
                      <p className="text-sm text-[#8C8C8C]">No classes yet.</p>
                    )}
                    {sortedClasses.map((item) => {
                      const next = upcomingByClass.get(item.name);
                      const isExpanded = expandedClassIds.has(item.id);
                      const list = eventsByClassName.get(item.name) ?? [];
                      const upcomingList = list.filter(
                        (event) => new Date(event.startAt).getTime() >= Date.now()
                      );
                      return (
                        <div
                          key={item.id}
                          className="rounded-2xl border border-[#E6E6E2] bg-[#F4F3EF] px-4 py-3"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              toggleClassExpand(item.id);
                              setClassFilter(item.name);
                            }}
                            className="flex w-full items-center justify-between text-left text-sm font-semibold text-[#1E1E1E]"
                          >
                            <span>{item.name}</span>
                            <span className="text-xs text-[#8C8C8C]">
                              {isExpanded ? "−" : "+"}
                            </span>
                          </button>
                          {!isExpanded && (
                            <div className="mt-3 flex items-start gap-3 text-sm text-[#4A4A4A]">
                              <div className="mt-1 h-2 w-2 rounded-full bg-[#C79AA5]" />
                              <div>
                                {next ? (
                                  <>
                                    <p className="font-semibold">{next.title}</p>
                                    <p className="text-[10px] uppercase tracking-[0.2em] text-[#8C8C8C]">
                                      {formatTime(next.startAt)}
                                    </p>
                                  </>
                                ) : (
                                  <p className="text-sm text-[#8C8C8C]">
                                    No upcoming items
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                          {isExpanded && (
                            <div className="mt-3 flex flex-col gap-2 border-l border-[#E6E6E2] pl-4">
                              {upcomingList.slice(0, 4).map((event) => (
                                <div key={event.id} className="text-sm text-[#4A4A4A]">
                                  <p className="font-semibold">{event.title}</p>
                                  <p className="text-[10px] uppercase tracking-[0.2em] text-[#8C8C8C]">
                                    {formatTime(event.startAt)}
                                  </p>
                                </div>
                              ))}
                              {upcomingList.length === 0 && (
                                <p className="text-sm text-[#8C8C8C]">
                                  No upcoming items
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </aside>

        <div className="flex h-full flex-col gap-4 overflow-hidden">
          <section className="grid flex-1 gap-4 overflow-hidden">
            <div className="h-full overflow-hidden rounded-3xl border border-[#E6E6E2] bg-[linear-gradient(180deg,#FAF9F6_0%,#F2F0EA_100%)] p-6 shadow-[0_20px_60px_rgba(15,27,29,0.12)] backdrop-blur xl:p-7">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  className="rounded-full border border-[#E6E6E2] px-3 py-2 text-xs font-semibold text-[#4A4A4A] transition hover:border-[#1E1E1E] hover:text-[#1E1E1E]"
                  onClick={() => {
                    const today = new Date();
                    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
                    setSelectedDate(today);
                    setSidebarMode("day");
                    setIsSidebarOpen(true);
                  }}
                >
                  Today
                </button>
                <div className="flex items-center gap-2">
                  <div className="flex flex-col">
                    <h2 className="text-[22px] font-semibold text-[#1E1E1E] font-[var(--font-display)]">
                      {monthLabel}
                    </h2>
                    <div className="mt-2 h-[3px] w-[60px] rounded-full bg-[#B9AFC8]" />
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-[#E6E6E2] text-xs font-semibold text-[#4A4A4A] transition hover:border-[#1E1E1E] hover:text-[#1E1E1E]"
                      onClick={goToPreviousMonth}
                    >
                      {"<"}
                    </button>
                    <button
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-[#E6E6E2] text-xs font-semibold text-[#4A4A4A] transition hover:border-[#1E1E1E] hover:text-[#1E1E1E]"
                      onClick={goToNextMonth}
                    >
                      {">"}
                    </button>
                  </div>
                </div>
              </div>
              <div className="text-[11px] text-[#8C8C8C]">
                {filteredEventCount} event(s)
                {classFilter && (
                  <span className="text-[#8C8C8C]"> · {totalEventCount} total</span>
                )}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-7 gap-2.5 text-[11px] uppercase tracking-[0.2em] text-[#8C8C8C]">
              {weekDays.map((day) => (
                <div key={day} className="text-center">
                  {day}
                </div>
              ))}
            </div>

            <div className="mt-3.5 grid grid-cols-7 gap-2.5">
              {days.map((day, index) => {
                const key = toDateKey(day);
                const dayEvents = eventsByDay.get(key) ?? [];
                const isCurrentMonth = day.getMonth() === viewDate.getMonth();
                const isSelected = key === selectedKey;
                const isToday = key === toDateKey(new Date());
                const weekIndex = Math.floor(index / 7);

                return (
                  <button
                    key={`${key}-${index}`}
                    className={`group relative flex min-h-[122px] flex-col gap-2 rounded-2xl border p-4 text-left transition-all duration-200 cursor-pointer hover:scale-[1.02] ${
                      isSelected
                        ? "border-[#1E1E1E] bg-[#1E1E1E] text-[#F4F3EF] ring-1 ring-[#B9AFC8]"
                        : isToday
                          ? "border-[#1E1E1E] bg-[#1E1E1E] text-[#F4F3EF] shadow-[0_8px_24px_rgba(0,0,0,0.25)]"
                          : "border-[#E6E6E2] bg-[#F7F6F2] text-[#1E1E1E] hover:border-[#1E1E1E]"
                    } ${isCurrentMonth ? "opacity-100" : "opacity-40"} ${
                      hoveredWeekIndex === weekIndex && !isSelected
                        ? "bg-[#C8BDD6]/5"
                        : ""
                    } shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_1px_2px_rgba(0,0,0,0.04)] hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(0,0,0,0.06)] animate-[rise_0.6s_ease-out]`}
                    style={{ animationDelay: `${index * 12}ms` }}
                    onClick={() => {
                      openDayPopup(day, dayEvents);
                    }}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      const taskId = event.dataTransfer.getData("text/plain");
                      const task = tasks.find((item) => item.id === taskId);
                      if (task) {
                        setEventTitle(task.title);
                        setEventDate(toDateInput(day));
                        setIsAddEventOpen(true);
                      }
                    }}
                    onMouseEnter={() => setHoveredWeekIndex(weekIndex)}
                    onMouseLeave={() => setHoveredWeekIndex(null)}
                  >
                    <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.2em]">
                      <span>{day.getDate()}</span>
                      {isToday && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] ${
                            isSelected || isToday
                              ? "bg-[#F4F3EF] text-[#1E1E1E]"
                              : "bg-[#1E1E1E] text-[#F4F3EF]"
                          }`}
                        >
                          Today
                        </span>
                      )}
                    </div>
                    {dayEvents.length > 2 && (
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={(eventClick) => {
                          eventClick.stopPropagation();
                          openDayPopup(day, dayEvents);
                        }}
                        onKeyDown={(eventKey) => {
                          if (eventKey.key === "Enter" || eventKey.key === " ") {
                            eventKey.preventDefault();
                            eventKey.stopPropagation();
                            openDayPopup(day, dayEvents);
                          }
                        }}
                        className="absolute right-2 top-2 flex items-center gap-1 rounded-full border border-[#E6E6E2] bg-[#F4F3EF]/90 px-2 py-0.5 text-[9px] font-semibold text-[#4A4A4A] shadow-[0_2px_6px_rgba(0,0,0,0.08)]"
                      >
                        <span className="flex gap-0.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#C79AA5]" />
                          <span className="h-1.5 w-1.5 rounded-full bg-[#C79AA5]" />
                          <span className="h-1.5 w-1.5 rounded-full bg-[#C79AA5]" />
                        </span>
                        +{dayEvents.length - 2}
                      </div>
                    )}
                    <div className="flex flex-1 flex-col gap-2">
                      {dayEvents.slice(0, 2).map((event) => (
                        <div
                          role="button"
                          tabIndex={0}
                          key={event.id}
                          onClick={(eventClick) => {
                            eventClick.stopPropagation();
                            openEventPopup(event);
                          }}
                          onKeyDown={(eventKey) => {
                            if (eventKey.key === "Enter" || eventKey.key === " ") {
                              eventKey.preventDefault();
                              eventKey.stopPropagation();
                              openEventPopup(event);
                            }
                          }}
                          className={`rounded-lg border-l-4 border-[#C79AA5] px-2 py-1 pl-2.5 text-left text-[11px] transition ${
                            isSelected
                              ? "bg-[#C8BDD6]/20 text-[#F4F3EF]"
                              : "bg-[#F4F3EF] text-[#4A4A4A]"
                          }`}
                        >
                          <p className="truncate font-semibold">{event.title}</p>
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <p className="text-[10px] uppercase tracking-[0.2em] opacity-70">
                          +{dayEvents.length - 2} more
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          </section>
        </div>

      </main>

      {isAddEventOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-10">
          <button
            className="absolute inset-0 bg-[#1E1E1E]/50 backdrop-blur-sm"
            aria-label="Close add event popup"
            onClick={() => setIsAddEventOpen(false)}
          />
          <div className="relative w-full max-w-lg rounded-3xl border border-[#E6E6E2] bg-[#F4F3EF]/97 p-6 shadow-[0_30px_80px_rgba(15,27,29,0.25)] backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-2xl font-semibold text-[#1E1E1E] font-[var(--font-display)]">
                  Add to Calendar
                </h3>
                <p className="text-sm uppercase tracking-[0.2em] text-[#8C8C8C]">
                  Personal events stay local
                </p>
              </div>
              <button
                className="rounded-full border border-[#E6E6E2] px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#4A4A4A] transition hover:border-[#1E1E1E] hover:text-[#1E1E1E]"
                onClick={() => setIsAddEventOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="mt-5 flex flex-col gap-3">
              <input
                value={eventTitle}
                onChange={(event) => setEventTitle(event.target.value)}
                placeholder="Event title"
                className="w-full rounded-full border border-[#E6E6E2] bg-[#F4F3EF] px-4 py-2 text-sm text-[#4A4A4A] focus:border-[#1E1E1E] focus:outline-none"
              />
              <select
                value={eventClass}
                onChange={(event) => setEventClass(event.target.value)}
                className="w-full rounded-full border border-[#E6E6E2] bg-[#F4F3EF] px-4 py-2 text-sm text-[#4A4A4A] focus:border-[#1E1E1E] focus:outline-none"
              >
                <option value="">No class</option>
                {sortedClasses.map((item) => (
                  <option key={item.id} value={item.name} title={item.name}>
                    {truncateLabel(item.name)}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="date"
                  value={eventDate}
                  onChange={(event) => setEventDate(event.target.value)}
                  className="rounded-full border border-[#E6E6E2] bg-[#F4F3EF] px-4 py-2 text-sm text-[#4A4A4A] focus:border-[#1E1E1E] focus:outline-none"
                />
                <input
                  type="time"
                  value={eventTime}
                  onChange={(event) => setEventTime(event.target.value)}
                  className="rounded-full border border-[#E6E6E2] bg-[#F4F3EF] px-4 py-2 text-sm text-[#4A4A4A] focus:border-[#1E1E1E] focus:outline-none"
                />
              </div>
              <input
                type="time"
                value={eventEndTime}
                onChange={(event) => setEventEndTime(event.target.value)}
                placeholder="End time (optional)"
                className="w-full rounded-full border border-[#E6E6E2] bg-[#F4F3EF] px-4 py-2 text-sm text-[#4A4A4A] focus:border-[#1E1E1E] focus:outline-none"
              />
              <textarea
                value={eventDescription}
                onChange={(event) => setEventDescription(event.target.value)}
                placeholder="Notes (optional)"
                rows={3}
                className="w-full rounded-2xl border border-[#E6E6E2] bg-[#F4F3EF] px-4 py-2 text-sm text-[#4A4A4A] focus:border-[#1E1E1E] focus:outline-none"
              />
              <button
                className="rounded-full border border-[#1E1E1E] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#1E1E1E] transition hover:-translate-y-0.5 hover:bg-[#1E1E1E] hover:text-[#F4F3EF]"
                onClick={addEvent}
              >
                Add event
              </button>
            </div>
          </div>
        </div>
      )}

      {isErrorMessage && message && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-6">
          <div className="w-full max-w-lg rounded-2xl border border-[#C79AA5] bg-[#F4F3EF] px-5 py-4 text-sm text-[#4A4A4A] shadow-[0_20px_60px_rgba(15,27,29,0.18)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#C79AA5]">
                  Error
                </p>
                <p className="mt-1">{message}</p>
              </div>
              <button
                type="button"
                className="rounded-full border border-[#E6E6E2] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#4A4A4A] transition hover:border-[#1E1E1E] hover:text-[#1E1E1E]"
                onClick={() => {
                  setIsErrorMessage(false);
                  setMessage(null);
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {isEventPopupOpen && activeEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-10">
          <button
            className="absolute inset-0 bg-[#1E1E1E]/50 backdrop-blur-sm"
            aria-label="Close event popup"
            onClick={() => setIsEventPopupOpen(false)}
          />
          <div className="relative w-full max-w-lg rounded-3xl border border-[#E6E6E2] bg-[#F4F3EF]/97 p-6 shadow-[0_30px_80px_rgba(15,27,29,0.25)] backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-2xl font-semibold text-[#1E1E1E] font-[var(--font-display)]">
                  {activeEvent.title}
                </h3>
                <p className="text-sm uppercase tracking-[0.2em] text-[#8C8C8C]">
                  {activeEvent.className || "Calendar event"}
                </p>
              </div>
              <button
                className="rounded-full border border-[#E6E6E2] px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#4A4A4A] transition hover:border-[#1E1E1E] hover:text-[#1E1E1E]"
                onClick={() => setIsEventPopupOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="mt-4 flex flex-col gap-2 text-sm text-[#4A4A4A]">
              <p className="font-semibold">
                {activeEvent.endAt
                  ? `${formatTime(activeEvent.startAt)} - ${formatTime(
                      activeEvent.endAt
                    )}`
                  : formatTime(activeEvent.startAt)}
              </p>
              <p className="text-xs uppercase tracking-[0.2em] text-[#8C8C8C]">
                {new Date(activeEvent.startAt).toLocaleDateString([], {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
              {activeEvent.description && (
                <p className="mt-2 text-sm text-[#5c6b6f] whitespace-pre-line">
                  {activeEvent.description}
                </p>
              )}
              {activeEvent.url && (
                <div className="mt-2 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => copyEventLink(activeEvent.url!)}
                    className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1E1E1E] underline decoration-[#C79AA5] underline-offset-4"
                  >
                    Copy link
                  </button>
                  <a
                    href={activeEvent.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1E1E1E] underline decoration-[#C79AA5] underline-offset-4"
                  >
                    Open link
                  </a>
                </div>
              )}
            </div>
            {activeEvent.source === "manual" && (
              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    removeEvent(activeEvent.id);
                    setIsEventPopupOpen(false);
                  }}
                  className="rounded-full border border-[#C79AA5] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#C79AA5] transition hover:-translate-y-0.5 hover:bg-[#C79AA5] hover:text-white"
                >
                  Remove event
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {isDayPopupOpen && dayPopupDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-10">
          <button
            className="absolute inset-0 bg-[#1E1E1E]/50 backdrop-blur-sm"
            aria-label="Close day popup"
            onClick={() => setIsDayPopupOpen(false)}
          />
          <div className="relative w-full max-w-2xl rounded-3xl border border-[#E6E6E2] bg-[#F4F3EF]/97 p-6 shadow-[0_30px_80px_rgba(15,27,29,0.25)] backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-2xl font-semibold text-[#1E1E1E] font-[var(--font-display)]">
                  {dayPopupDate.toLocaleDateString([], {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </h3>
                <p className="text-sm uppercase tracking-[0.2em] text-[#8C8C8C]">
                  {dayPopupEvents.length} event(s)
                </p>
              </div>
              <button
                className="rounded-full border border-[#E6E6E2] px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#4A4A4A] transition hover:border-[#1E1E1E] hover:text-[#1E1E1E]"
                onClick={() => setIsDayPopupOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="mt-4 max-h-[70vh] overflow-y-auto pr-1">
              {dayPopupEvents.length === 0 && (
                <div className="rounded-2xl border border-dashed border-[#D6D1C8] bg-[#F8F7F4] px-4 py-6 text-center text-sm text-[#8C8C8C]">
                  No events scheduled for this day.
                </div>
              )}
              <div className="flex flex-col gap-3">
                {dayPopupEvents.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-2xl border border-[#E6E6E2] bg-[#F4F3EF] px-4 py-4 text-left text-sm text-[#4A4A4A]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold leading-snug text-[#1E1E1E]">
                          {event.title}
                        </p>
                        <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-[#8C8C8C]">
                          {event.className || "Calendar event"}
                        </p>
                      </div>
                      <span className="shrink-0 text-[10px] uppercase tracking-[0.2em] text-[#8C8C8C]">
                        {event.endAt
                          ? `${formatTime(event.startAt)} - ${formatTime(event.endAt)}`
                          : formatTime(event.startAt)}
                      </span>
                    </div>
                    {event.description && (
                      <p className="mt-3 whitespace-pre-line text-sm text-[#5c6b6f]">
                        {event.description}
                      </p>
                    )}
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          openEventPopup(event);
                          setIsDayPopupOpen(false);
                        }}
                        className="rounded-full border border-[#1E1E1E] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#1E1E1E] transition hover:-translate-y-0.5 hover:bg-[#1E1E1E] hover:text-[#F4F3EF]"
                      >
                        View event
                      </button>
                      {event.url && (
                        <a
                          href={event.url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border border-[#E6E6E2] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#4A4A4A] transition hover:border-[#1E1E1E] hover:text-[#1E1E1E]"
                        >
                          Open link
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {isClassManagerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-10">
          <button
            className="absolute inset-0 bg-[#1E1E1E]/50 backdrop-blur-sm"
            aria-label="Close class manager"
            onClick={() => setIsClassManagerOpen(false)}
          />
          <div className="relative w-full max-w-lg rounded-3xl border border-[#E6E6E2] bg-[#F4F3EF]/97 p-6 shadow-[0_30px_80px_rgba(15,27,29,0.25)] backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-2xl font-semibold text-[#1E1E1E] font-[var(--font-display)]">
                  Class categories
                </h3>
                <p className="text-sm uppercase tracking-[0.2em] text-[#8C8C8C]">
                  Add or remove class labels
                </p>
              </div>
              <button
                className="rounded-full border border-[#E6E6E2] px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#4A4A4A] transition hover:border-[#1E1E1E] hover:text-[#1E1E1E]"
                onClick={() => setIsClassManagerOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="mt-5 flex gap-2">
              <input
                value={newClassName}
                onChange={(event) => setNewClassName(event.target.value)}
                placeholder="Add a class (e.g., BIO 110)"
                className="flex-1 rounded-full border border-[#E6E6E2] bg-[#F4F3EF] px-4 py-2 text-sm text-[#4A4A4A] focus:border-[#1E1E1E] focus:outline-none"
              />
              <button
                className="rounded-full border border-[#1E1E1E] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#1E1E1E] transition hover:-translate-y-0.5 hover:bg-[#1E1E1E] hover:text-[#F4F3EF]"
                onClick={addClass}
              >
                Add
              </button>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              {sortedClasses.length === 0 && (
                <p className="text-sm text-[#8C8C8C]">
                  No classes yet. Add one to start tagging assignments.
                </p>
              )}
              {sortedClasses.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-full border border-[#E6E6E2] bg-[#F4F3EF] px-4 py-2 text-sm text-[#4A4A4A]"
                >
                  <span className="font-semibold">{item.name}</span>
                  <button
                    onClick={() => removeClass(item.id)}
                    className="text-xs uppercase tracking-[0.2em] text-[#C79AA5] hover:text-[#1E1E1E]"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
