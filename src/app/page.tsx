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
  "bg-[#0f1b1d]",
  "bg-[#c1735f]",
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
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
    try {
      const res = await fetch("/api/events");
      if (!res.ok) {
        throw new Error("Failed to load events.");
      }
      const data = (await res.json()) as { events: EventItem[] };
      setEvents(data.events ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
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
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Sync failed.");
      }
      setMessage(`Synced ${data.synced ?? 0} event(s) from D2L.`);
      const now = new Date().toISOString();
      setLastSyncAt(now);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(lastSyncStorageKey, now);
      }
      await fetchEvents();
      await fetchTasks();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sync failed.");
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
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to add task.");
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
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to update task.");
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
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to remove task.");
    }
  };

  const addEvent = async () => {
    const title = eventTitle.trim();
    if (!title || !eventDate) {
      setMessage("Event title and date are required.");
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
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to add event.");
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
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed to remove event."
      );
    }
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
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed to copy link."
      );
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

  const filteredTasks = useMemo(() => {
    if (!classFilter) return tasks;
    if (classFilter === "__none__") {
      return tasks.filter((task) => !task.className);
    }
    return tasks.filter((task) => task.className === classFilter);
  }, [classFilter, tasks]);

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
  const checklistItems = [
    ...selectedEvents.map((event) => ({
      id: `event-${event.id}`,
      title: event.title,
      done: false,
      source: "event" as const,
      time: event.startAt,
      className: event.className ?? null,
    })),
    ...filteredTasks.map((task) => ({
      id: task.id,
      title: task.title,
      done: task.done,
      source: "task" as const,
      time: task.createdAt,
      className: task.className ?? null,
    })),
  ];

  const sortedClasses = useMemo(
    () =>
      [...classes].sort((a, b) =>
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      ),
    [classes]
  );

  const goToPreviousMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const monthLabel = `${monthNames[viewDate.getMonth()]} ${viewDate.getFullYear()}`;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f7f1e6] text-[#0f1b1d]">
      <div className="pointer-events-none absolute -top-28 right-[-12%] h-80 w-80 rounded-full bg-[#ffd18b]/50 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-20%] left-[-10%] h-96 w-96 rounded-full bg-[#8fd3c8]/50 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1200px_circle_at_10%_10%,rgba(255,255,255,0.7),transparent)]" />

      <main
        className={`relative mx-auto flex min-h-screen w-full max-w-[1200px] flex-col gap-10 px-6 pb-20 pt-16 sm:px-10 xl:max-w-[1400px] 2xl:max-w-[1600px] ${
          isSidebarOpen ? "xl:pr-[440px]" : ""
        }`}
      >
        <header className="relative z-10 flex flex-col gap-4 rounded-3xl border border-[#e2d8c8] bg-white/70 px-6 py-5 shadow-[0_16px_40px_rgba(15,27,29,0.08)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#0f1b1d] text-xs font-semibold uppercase tracking-[0.2em] text-[#f7f1e6]">
              D2L
            </div>
            <h1 className="text-2xl font-semibold text-[#0f1b1d] font-[var(--font-display)] sm:text-3xl">
              D2L Calendar
            </h1>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[#d1c2ae] text-[#3d4b4f] transition hover:-translate-y-0.5 hover:border-[#0f1b1d] hover:text-[#0f1b1d]"
              onClick={() => setIsSidebarOpen((prev) => !prev)}
              aria-label="Toggle sidebar"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M4 6h16" />
                <path d="M4 12h16" />
                <path d="M4 18h16" />
              </svg>
            </button>
            <button
              type="button"
              className="rounded-full border border-[#0f1b1d] px-5 py-3 text-sm font-semibold uppercase tracking-[0.2em] transition hover:-translate-y-0.5 hover:bg-[#0f1b1d] hover:text-[#f7f1e6]"
              onClick={syncCalendar}
              disabled={isSyncing}
            >
              {isSyncing ? "Syncing..." : "Sync D2L"}
            </button>
            <button
              type="button"
              className="rounded-full border border-[#8c9a9e] px-5 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-[#3d4b4f] transition hover:-translate-y-0.5 hover:border-[#0f1b1d] hover:text-[#0f1b1d]"
              onClick={fetchEvents}
              disabled={isLoading}
            >
              {isLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </header>

        <section className="grid gap-8">
          <div className="rounded-3xl border border-[#e2d8c8] bg-white/80 p-7 shadow-[0_20px_60px_rgba(15,27,29,0.12)] backdrop-blur xl:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <button
                  className="rounded-full border border-[#d1c2ae] px-3 py-2 text-sm font-semibold text-[#3d4b4f] transition hover:border-[#0f1b1d] hover:text-[#0f1b1d]"
                  onClick={goToPreviousMonth}
                >
                  Prev
                </button>
                <button
                  className="rounded-full border border-[#d1c2ae] px-3 py-2 text-sm font-semibold text-[#3d4b4f] transition hover:border-[#0f1b1d] hover:text-[#0f1b1d]"
                  onClick={() => {
                    const today = new Date();
                    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
                    setSelectedDate(today);
                  }}
                >
                  Today
                </button>
                <h2 className="text-2xl font-semibold text-[#0f1b1d] font-[var(--font-display)]">
                  {monthLabel}
                </h2>
                <button
                  className="rounded-full border border-[#d1c2ae] px-3 py-2 text-sm font-semibold text-[#3d4b4f] transition hover:border-[#0f1b1d] hover:text-[#0f1b1d]"
                  onClick={goToNextMonth}
                >
                  Next
                </button>
              </div>
              <div className="text-sm text-[#516164]">
                {filteredEventCount} event(s)
                {classFilter && (
                  <span className="text-[#8c9a9e]"> · {totalEventCount} total</span>
                )}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-7 gap-2 text-xs uppercase tracking-[0.2em] text-[#748286]">
              {weekDays.map((day) => (
                <div key={day} className="text-center">
                  {day}
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-7 gap-2">
              {days.map((day, index) => {
                const key = toDateKey(day);
                const dayEvents = eventsByDay.get(key) ?? [];
                const isCurrentMonth = day.getMonth() === viewDate.getMonth();
                const isSelected = key === selectedKey;
                const isToday = key === toDateKey(new Date());

                return (
                  <button
                    key={`${key}-${index}`}
                    className={`group flex min-h-[128px] flex-col gap-2 rounded-2xl border p-3 text-left transition ${
                      isSelected
                        ? "border-[#0f1b1d] bg-[#0f1b1d] text-[#f7f1e6]"
                        : "border-[#efe6d9] bg-white/60 text-[#0f1b1d] hover:border-[#0f1b1d]"
                    } ${isCurrentMonth ? "opacity-100" : "opacity-45"} animate-[rise_0.6s_ease-out]`}
                    style={{ animationDelay: `${index * 12}ms` }}
                    onClick={() => setSelectedDate(day)}
                  >
                    <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em]">
                      <span>{day.getDate()}</span>
                      {isToday && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] ${
                            isSelected
                              ? "bg-[#f7f1e6] text-[#0f1b1d]"
                              : "bg-[#0f1b1d] text-[#f7f1e6]"
                          }`}
                        >
                          Today
                        </span>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-2">
                      {dayEvents.slice(0, 2).map((event) => (
                        <div
                          key={event.id}
                          className={`rounded-lg px-2 py-1 text-xs ${
                            isSelected
                              ? "bg-[#f7f1e6]/20 text-[#f7f1e6]"
                              : "bg-[#f0e6d6] text-[#2c3a3d]"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {event.className && (
                              <span
                                className={`h-2 w-2 rounded-full ${getClassColor(
                                  event.className
                                )}`}
                              />
                            )}
                            <p className="truncate font-semibold">{event.title}</p>
                          </div>
                          <p className="text-[10px] opacity-70">
                            {formatTime(event.startAt)}
                          </p>
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <p className="text-[10px] uppercase tracking-[0.2em] opacity-70">
                          +{dayEvents.length - 2} more
                        </p>
                      )}
                      {dayEvents.length === 0 && (
                        <p className="text-[10px] uppercase tracking-[0.2em] opacity-50">
                          Open
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="hidden" />
        </section>
      </main>

      {isSidebarOpen && (
        <div className="fixed right-0 top-0 z-40 hidden h-full w-full max-w-[420px] overflow-y-auto border-l border-[#e2d8c8] bg-[#f7f1e6] p-6 xl:block">
          <div className="flex items-center justify-between">
            <p className="text-sm uppercase tracking-[0.3em] text-[#6b7a7e]">
              Sidebar
            </p>
            <button
              className="rounded-full border border-[#d1c2ae] px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#3d4b4f] transition hover:border-[#0f1b1d] hover:text-[#0f1b1d]"
              onClick={() => setIsSidebarOpen(false)}
            >
              Close
            </button>
          </div>

          <div className="mt-4 rounded-2xl border border-[#efe6d9] bg-white/80 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[#6b7a7e]">
              Filter by class
            </p>
            <select
              value={classFilter}
              onChange={(event) => setClassFilter(event.target.value)}
              className="mt-2 w-full rounded-full border border-[#d1c2ae] bg-white px-4 py-2 text-sm text-[#2c3a3d] focus:border-[#0f1b1d] focus:outline-none"
            >
              <option value="">All classes</option>
              <option value="__none__">No class</option>
              {sortedClasses.map((item) => (
                <option key={item.id} value={item.name} title={item.name}>
                  {truncateLabel(item.name)}
                </option>
              ))}
            </select>
            <button
              className="mt-3 w-full rounded-full border border-[#0f1b1d] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#0f1b1d] transition hover:-translate-y-0.5 hover:bg-[#0f1b1d] hover:text-[#f7f1e6]"
              onClick={() => setIsClassManagerOpen(true)}
            >
              Manage classes
            </button>
          </div>

          <div className="mt-6 flex flex-col gap-4">
              <div className="rounded-3xl border border-[#e2d8c8] bg-white/80 p-6 shadow-[0_18px_45px_rgba(15,27,29,0.1)] backdrop-blur">
              <h3 className="text-xl font-semibold text-[#0f1b1d] font-[var(--font-display)]">
                {monthNames[selectedDate.getMonth()]} {selectedDate.getDate()}
              </h3>
              <p className="text-sm uppercase tracking-[0.2em] text-[#6b7a7e]">
                {selectedEvents.length} event(s) selected
              </p>
              <div className="mt-4 flex flex-col gap-3">
                {selectedEvents.length === 0 && (
                  <p className="text-sm text-[#5a6a6e]">
                    No events for this day. Perfect time to breathe.
                  </p>
                )}
                {selectedEvents.map((event, index) => (
                  <div
                    key={event.id}
                    className="rounded-2xl border border-[#efe6d9] bg-white px-4 py-3 text-sm text-[#2c3a3d] animate-[rise_0.6s_ease-out]"
                    style={{ animationDelay: `${index * 40}ms` }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                          <div className="flex items-center gap-2">
                            {event.className && (
                              <span
                                className={`h-2.5 w-2.5 rounded-full ${getClassColor(
                                  event.className
                                )}`}
                              />
                            )}
                            <p className="font-semibold">
                              {event.title} -{" "}
                              {event.endAt
                                ? `${formatTime(event.startAt)} - ${formatTime(event.endAt)}`
                                : formatTime(event.startAt)}
                            </p>
                          </div>
                        <p className="text-xs uppercase tracking-[0.2em] text-[#6b7a7e]">
                          {event.className || "Calendar event"}
                        </p>
                      </div>
                      {event.source === "manual" && (
                        <button
                          onClick={() => removeEvent(event.id)}
                          className="text-xs uppercase tracking-[0.2em] text-[#c1735f] hover:text-[#0f1b1d]"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    {event.description && (
                      <p
                        className={`mt-2 text-xs text-[#5c6b6f] ${
                          expandedEventIds.has(event.id)
                            ? "whitespace-pre-line"
                            : "max-h-16 overflow-hidden"
                        }`}
                      >
                        {event.description}
                      </p>
                    )}
                    {(event.description || event.url) && (
                      <button
                        type="button"
                        onClick={() => toggleEventDetails(event.id)}
                        className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#0f1b1d] underline decoration-[#ffd18b] underline-offset-4"
                      >
                        {expandedEventIds.has(event.id) ? "Show less" : "Show more"}
                      </button>
                    )}
                      {event.url && (
                        <div className="mt-2 flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => copyEventLink(event.url!)}
                            className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0f1b1d] underline decoration-[#ffd18b] underline-offset-4"
                          >
                            Copy link
                          </button>
                          <a
                            href={event.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0f1b1d] underline decoration-[#ffd18b] underline-offset-4"
                          >
                            Open link
                          </a>
                        </div>
                      )}
                  </div>
                ))}
              </div>
            </div>

              <div className="rounded-3xl border border-[#e2d8c8] bg-white/90 p-6 shadow-[0_18px_45px_rgba(15,27,29,0.1)] backdrop-blur">
                <h3 className="text-xl font-semibold text-[#0f1b1d] font-[var(--font-display)]">
                  Checklist
                </h3>
              <p className="text-sm uppercase tracking-[0.2em] text-[#6b7a7e]">
                Calendar items appear automatically
              </p>

              <div className="mt-4 flex gap-2">
                <input
                  value={taskTitle}
                  onChange={(event) => setTaskTitle(event.target.value)}
                  placeholder="Add a task..."
                  className="flex-1 rounded-full border border-[#d1c2ae] bg-white px-4 py-2 text-sm text-[#2c3a3d] focus:border-[#0f1b1d] focus:outline-none"
                />
                <button
                  className="rounded-full border border-[#0f1b1d] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#0f1b1d] transition hover:-translate-y-0.5 hover:bg-[#0f1b1d] hover:text-[#f7f1e6]"
                  onClick={addTask}
                >
                  Add
                </button>
              </div>
                <div className="mt-2">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <select
                      value={taskClass}
                      onChange={(event) => setTaskClass(event.target.value)}
                      className="w-full flex-1 rounded-full border border-[#d1c2ae] bg-white px-4 py-2 text-sm text-[#2c3a3d] focus:border-[#0f1b1d] focus:outline-none"
                    >
                      <option value="">No class</option>
                      {sortedClasses.map((item) => (
                        <option key={item.id} value={item.name} title={item.name}>
                          {truncateLabel(item.name)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

              <div className="mt-4 flex flex-col gap-3">
                {checklistItems.length === 0 && (
                  <p className="text-sm text-[#5a6a6e]">
                    Nothing on the list yet.
                  </p>
                )}
                {checklistItems.map((item) => (
                  <div
                    key={item.id}
                    role={item.source === "task" ? "button" : undefined}
                    tabIndex={item.source === "task" ? 0 : undefined}
                    onClick={() =>
                      item.source === "task" ? toggleTask(item.id) : null
                    }
                    onKeyDown={(event) => {
                      if (item.source !== "task") return;
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        toggleTask(item.id);
                      }
                    }}
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition ${
                      item.source === "event"
                        ? "border-[#efe6d9] bg-[#f8f2e9] text-[#2c3a3d]"
                        : "border-[#efe6d9] bg-white text-[#2c3a3d] hover:border-[#0f1b1d]"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full border text-xs ${
                        item.source === "event"
                          ? "border-[#c9b79f] text-transparent"
                          : item.done
                            ? "border-[#0f1b1d] bg-[#0f1b1d] text-[#f7f1e6]"
                            : "border-[#c9b79f] text-transparent"
                      }`}
                    >
                      x
                    </span>
                    <div className="flex flex-1 flex-col">
                      <span
                        className={`flex items-center gap-2 ${
                          item.source === "task" && item.done
                            ? "line-through text-[#8c9a9e]"
                            : ""
                        }`}
                      >
                        {item.className && (
                          <span
                            className={`h-2 w-2 rounded-full ${getClassColor(
                              item.className
                            )}`}
                          />
                        )}
                        <span className="font-semibold">{item.title}</span>
                      </span>
                      <span className="text-[10px] uppercase tracking-[0.2em] text-[#6b7a7e]">
                        {item.source === "event"
                          ? `${item.className || "Calendar"} - ${formatTime(item.time)}`
                          : item.className || "Personal task"}
                      </span>
                    </div>
                    {item.source === "task" && (
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          removeTask(item.id);
                        }}
                        className="text-xs uppercase tracking-[0.2em] text-[#c1735f] hover:text-[#0f1b1d]"
                        aria-label="Remove task"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <button
              className="rounded-full border border-[#0f1b1d] px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#0f1b1d] transition hover:-translate-y-0.5 hover:bg-[#0f1b1d] hover:text-[#f7f1e6]"
              onClick={() => setIsAddEventOpen(true)}
            >
              Add to Calendar
            </button>

          </div>
        </div>
      )}

      <footer className="mx-auto w-full max-w-[1200px] px-6 pb-12 sm:px-10 xl:max-w-[1400px] 2xl:max-w-[1600px]">
        <div className="rounded-3xl border border-[#e2d8c8] bg-[#0f1b1d] p-6 text-[#f7f1e6]">
          <p className="text-xs uppercase tracking-[0.3em] text-[#ffd18b]">
            Sync Status
          </p>
          <p className="mt-2 text-sm text-[#f7f1e6]">
            {message ?? "Ready when you are."}
          </p>
          <p className="mt-2 text-xs text-[#c8d4d1]">
            Last sync: {lastSyncAt ? formatDateTime(lastSyncAt) : "Not yet"}
          </p>
          <p className="mt-4 text-xs text-[#c8d4d1]">
            Feed: <span className="text-[#ffd18b]">.ics</span> via server
          </p>
        </div>
      </footer>

      {isAddEventOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-10">
          <button
            className="absolute inset-0 bg-[#0f1b1d]/50 backdrop-blur-sm"
            aria-label="Close add event popup"
            onClick={() => setIsAddEventOpen(false)}
          />
          <div className="relative w-full max-w-lg rounded-3xl border border-[#e2d8c8] bg-white/95 p-6 shadow-[0_30px_80px_rgba(15,27,29,0.25)] backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-2xl font-semibold text-[#0f1b1d] font-[var(--font-display)]">
                  Add to Calendar
                </h3>
                <p className="text-sm uppercase tracking-[0.2em] text-[#6b7a7e]">
                  Personal events stay local
                </p>
              </div>
              <button
                className="rounded-full border border-[#d1c2ae] px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#3d4b4f] transition hover:border-[#0f1b1d] hover:text-[#0f1b1d]"
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
                className="w-full rounded-full border border-[#d1c2ae] bg-white px-4 py-2 text-sm text-[#2c3a3d] focus:border-[#0f1b1d] focus:outline-none"
              />
              <select
                value={eventClass}
                onChange={(event) => setEventClass(event.target.value)}
                className="w-full rounded-full border border-[#d1c2ae] bg-white px-4 py-2 text-sm text-[#2c3a3d] focus:border-[#0f1b1d] focus:outline-none"
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
                  className="rounded-full border border-[#d1c2ae] bg-white px-4 py-2 text-sm text-[#2c3a3d] focus:border-[#0f1b1d] focus:outline-none"
                />
                <input
                  type="time"
                  value={eventTime}
                  onChange={(event) => setEventTime(event.target.value)}
                  className="rounded-full border border-[#d1c2ae] bg-white px-4 py-2 text-sm text-[#2c3a3d] focus:border-[#0f1b1d] focus:outline-none"
                />
              </div>
              <input
                type="time"
                value={eventEndTime}
                onChange={(event) => setEventEndTime(event.target.value)}
                placeholder="End time (optional)"
                className="w-full rounded-full border border-[#d1c2ae] bg-white px-4 py-2 text-sm text-[#2c3a3d] focus:border-[#0f1b1d] focus:outline-none"
              />
              <textarea
                value={eventDescription}
                onChange={(event) => setEventDescription(event.target.value)}
                placeholder="Notes (optional)"
                rows={3}
                className="w-full rounded-2xl border border-[#d1c2ae] bg-white px-4 py-2 text-sm text-[#2c3a3d] focus:border-[#0f1b1d] focus:outline-none"
              />
              <button
                className="rounded-full border border-[#0f1b1d] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#0f1b1d] transition hover:-translate-y-0.5 hover:bg-[#0f1b1d] hover:text-[#f7f1e6]"
                onClick={addEvent}
              >
                Add event
              </button>
            </div>
          </div>
        </div>
      )}

      {isClassManagerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-10">
          <button
            className="absolute inset-0 bg-[#0f1b1d]/50 backdrop-blur-sm"
            aria-label="Close class manager"
            onClick={() => setIsClassManagerOpen(false)}
          />
          <div className="relative w-full max-w-lg rounded-3xl border border-[#e2d8c8] bg-white/95 p-6 shadow-[0_30px_80px_rgba(15,27,29,0.25)] backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-2xl font-semibold text-[#0f1b1d] font-[var(--font-display)]">
                  Class categories
                </h3>
                <p className="text-sm uppercase tracking-[0.2em] text-[#6b7a7e]">
                  Add or remove class labels
                </p>
              </div>
              <button
                className="rounded-full border border-[#d1c2ae] px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#3d4b4f] transition hover:border-[#0f1b1d] hover:text-[#0f1b1d]"
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
                className="flex-1 rounded-full border border-[#d1c2ae] bg-white px-4 py-2 text-sm text-[#2c3a3d] focus:border-[#0f1b1d] focus:outline-none"
              />
              <button
                className="rounded-full border border-[#0f1b1d] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#0f1b1d] transition hover:-translate-y-0.5 hover:bg-[#0f1b1d] hover:text-[#f7f1e6]"
                onClick={addClass}
              >
                Add
              </button>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              {sortedClasses.length === 0 && (
                <p className="text-sm text-[#5a6a6e]">
                  No classes yet. Add one to start tagging assignments.
                </p>
              )}
              {sortedClasses.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-full border border-[#efe6d9] bg-white px-4 py-2 text-sm text-[#2c3a3d]"
                >
                  <span className="font-semibold">{item.name}</span>
                  <button
                    onClick={() => removeClass(item.id)}
                    className="text-xs uppercase tracking-[0.2em] text-[#c1735f] hover:text-[#0f1b1d]"
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


