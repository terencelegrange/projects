import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { initDb } from "@/lib/initDb";

export async function GET(req: NextRequest) {
  try {
    await initDb();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    const labels = await prisma.label.findMany({
      where: projectId ? { OR: [{ project_id: Number(projectId) }, { project_id: null }] } : {},
      orderBy: { name: "asc" },
    });

    return NextResponse.json(labels);
  } catch (error) {
    console.error("[GET /api/labels] error:", error);
    return NextResponse.json({ error: "Failed to fetch labels" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await initDb();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { name, color, project_id } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Label name is required" }, { status: 400 });
    }

    const label = await prisma.label.create({
      data: {
        name: name.trim(),
        color: color || "#64748b",
        project_id: project_id ? Number(project_id) : null,
      },
    });

    return NextResponse.json(label, { status: 201 });
  } catch (error) {
    console.error("[POST /api/labels] error:", error);
    return NextResponse.json({ error: "Failed to create label" }, { status: 500 });
  }
}
