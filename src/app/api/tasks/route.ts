import { NextResponse } from "next/server";
import { addTask, getTasks, removeTask, toggleTask } from "@/lib/taskStore";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ tasks: getTasks() });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { title?: string; className?: string };
  const title = body.title?.trim();
  if (!title) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }

  const task = addTask(title, body.className);
  return NextResponse.json({ task }, { status: 201 });
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as { id?: string };
  const id = body.id?.trim();
  if (!id) {
    return NextResponse.json({ error: "Task id is required." }, { status: 400 });
  }

  const task = toggleTask(id);
  if (!task) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  return NextResponse.json({ task });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "Task id is required." }, { status: 400 });
  }

  const removed = removeTask(id);
  if (!removed) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  return NextResponse.json({ task: removed });
}
