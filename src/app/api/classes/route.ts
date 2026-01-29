import { NextResponse } from "next/server";
import { addClass, getClasses, removeClass } from "@/lib/classStore";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ classes: getClasses() });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { name?: string };
  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Class name is required." }, { status: 400 });
  }

  const created = addClass(name);
  if (!created) {
    return NextResponse.json({ error: "Class name is required." }, { status: 400 });
  }

  return NextResponse.json({ class: created }, { status: 201 });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "Class id is required." }, { status: 400 });
  }

  const removed = removeClass(id);
  if (!removed) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }

  return NextResponse.json({ class: removed });
}
