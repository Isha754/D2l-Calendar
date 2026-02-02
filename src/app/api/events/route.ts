import { NextResponse } from "next/server";
import { addManualEvent, getEvents, removeManualEvent } from "@/lib/eventStore";

export async function GET() {
  return NextResponse.json({ events: getEvents() });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    title?: string;
    description?: string;
    startAt?: string;
    endAt?: string | null;
    className?: string | null;
  };

  const title = body.title?.trim();
  const startAt = body.startAt ? new Date(body.startAt) : null;
  const endAt = body.endAt ? new Date(body.endAt) : null;

  if (!title || !startAt || Number.isNaN(startAt.getTime())) {
    return NextResponse.json(
      { error: "Title and start date/time are required." },
      { status: 400 }
    );
  }

  const event = addManualEvent({
    id: crypto.randomUUID(),
    title,
    description: body.description?.trim() || null,
    startAt: startAt.toISOString(),
    endAt: endAt && !Number.isNaN(endAt.getTime()) ? endAt.toISOString() : null,
    url: null,
    className: body.className?.trim() || null,
    source: "manual",
  });

  return NextResponse.json({ event }, { status: 201 });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "Event id is required." }, { status: 400 });
  }

  const removed = removeManualEvent(id);
  if (!removed) {
    return NextResponse.json(
      { error: "Only manual events can be removed." },
      { status: 404 }
    );
  }

  return NextResponse.json({ event: removed });
}
