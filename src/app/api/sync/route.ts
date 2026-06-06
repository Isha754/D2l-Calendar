import { NextResponse } from "next/server";
import ICAL from "ical.js";
import { setD2lEvents, type EventItem } from "@/lib/eventStore";

export const runtime = "nodejs";

const normalizeLabel = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const extractClassFromSummary = (summary: string) => {
  const separators = [" - ", ": "];
  for (const separator of separators) {
    if (summary.includes(separator)) {
      const [left, right] = summary.split(separator);
      const className = normalizeLabel(left);
      const title = normalizeLabel(right);
      if (className && title) {
        return { className, title };
      }
    }
  }

  const match = summary.match(/\b[A-Z]{2,4}\s?\d{3}[A-Z]?\b/);
  if (match) {
    return { className: match[0].replace(/\s+/g, " ").trim(), title: summary };
  }

  return { className: null, title: summary };
};

const stripClassPrefix = (summary: string, className: string) => {
  const separators = [" - ", ": "];
  for (const separator of separators) {
    const prefix = `${className}${separator}`;
    if (summary.startsWith(prefix)) {
      return normalizeLabel(summary.slice(prefix.length)) ?? summary;
    }
  }
  return summary;
};

export async function POST() {
  try {
    const icsUrl = process.env.D2L_ICS_URL;
    if (!icsUrl) {
      return NextResponse.json(
        { error: "Missing D2L_ICS_URL" },
        { status: 500 }
      );
    }

    // Fetch the ICS text
    const res = await fetch(icsUrl);
    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch ICS: ${res.status} ${res.statusText}` },
        { status: 502 }
      );
    }
    const icsText = await res.text();

    if (!icsText.includes("BEGIN:VCALENDAR")) {
      const sample = icsText.slice(0, 200).replace(/\s+/g, " ");
      return NextResponse.json(
        {
          error:
            "ICS feed does not look like a calendar. Check the D2L link/token.",
          sample,
        },
        { status: 502 }
      );
    }

    // Parse ICS
    const jcalData = ICAL.parse(icsText);
    const comp = new ICAL.Component(jcalData);
    const vevents = comp.getAllSubcomponents("vevent");

    const events: EventItem[] = [];

    for (const ve of vevents) {
      const ev = new ICAL.Event(ve);

      const uid = ev.uid;
      const rawTitle = ev.summary || "Untitled";
      const description = ev.description || null;

      const startAt = ev.startDate ? ev.startDate.toJSDate() : null;
      const endAt = ev.endDate ? ev.endDate.toJSDate() : null;

      if (!uid || !startAt) continue;

      const categories = ev.component.getFirstPropertyValue("categories") as
        | string
        | string[]
        | null;
      const classFromCategories = Array.isArray(categories)
        ? normalizeLabel(String(categories[0]))
        : normalizeLabel(categories);
      const classFromLocation = normalizeLabel(
        (ev.component.getFirstPropertyValue("location") as string | null) ??
          ev.location
      );

      let className = classFromCategories ?? classFromLocation;
      let title = rawTitle;

      if (className) {
        title = stripClassPrefix(rawTitle, className);
      } else {
        const extracted = extractClassFromSummary(rawTitle);
        className = extracted.className;
        title = extracted.title;
      }

      // Some feeds store URLs in "url"
      const url =
        (ev.component.getFirstPropertyValue("url") as string | null) ?? null;

      events.push({
        id: uid,
        title,
        description,
        startAt: startAt.toISOString(),
        endAt: endAt ? endAt.toISOString() : null,
        url,
        className,
        source: "d2l",
      });
    }

    events.sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
    );
    setD2lEvents(events);

    return NextResponse.json({ ok: true, synced: events.length });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected sync error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
