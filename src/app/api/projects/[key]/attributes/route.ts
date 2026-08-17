import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { initDb } from "@/lib/initDb";
import { auditLog, getIp } from "@/lib/audit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    await initDb();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { key } = await params;
    const projectKey = key.toUpperCase();

    const project = await prisma.project.findUnique({
      where: { key: projectKey },
      select: {
        id: true,
        key: true,
        name: true,
        attributes: {
          orderBy: { created_at: "asc" },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const attributesMap: Record<string, string> = {};
    for (const attr of project.attributes) {
      attributesMap[attr.key] = attr.value;
    }

    return NextResponse.json({
      projectKey: project.key,
      projectName: project.name,
      attributes: project.attributes,
      attributesMap,
    });
  } catch (error) {
    console.error("[GET /api/projects/[key]/attributes] error:", error);
    return NextResponse.json({ error: "Failed to fetch project attributes" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    await initDb();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { key } = await params;
    const projectKey = key.toUpperCase();
    const body = await req.json();

    const attrKey = String(body.key || "").trim().toUpperCase();
    const attrValue = String(body.value ?? "").trim();

    if (!attrKey) {
      return NextResponse.json({ error: "Attribute key is required (e.g. REPO)" }, { status: 400 });
    }

    const project = await prisma.project.findUnique({
      where: { key: projectKey },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const attribute = await prisma.projectAttribute.upsert({
      where: {
        project_id_key: {
          project_id: project.id,
          key: attrKey,
        },
      },
      create: {
        project_id: project.id,
        key: attrKey,
        value: attrValue,
      },
      update: {
        value: attrValue,
      },
    });

    await auditLog({
      userId: session.sub ? Number(session.sub) : null,
      action: "PROJECT_ATTRIBUTE_SET",
      resource: "project_attribute",
      resourceId: `${projectKey}/${attrKey}`,
      details: { projectKey, key: attrKey, value: attrValue },
      ip: getIp(req),
    });

    return NextResponse.json(attribute, { status: 200 });
  } catch (error) {
    console.error("[POST /api/projects/[key]/attributes] error:", error);
    return NextResponse.json({ error: "Failed to save project attribute" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    await initDb();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { key } = await params;
    const projectKey = key.toUpperCase();

    const { searchParams } = new URL(req.url);
    const attrKey = searchParams.get("key")?.trim().toUpperCase();
    const attrId = searchParams.get("id");

    if (!attrKey && !attrId) {
      return NextResponse.json({ error: "Provide ?key=... or ?id=... to delete attribute" }, { status: 400 });
    }

    const project = await prisma.project.findUnique({
      where: { key: projectKey },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (attrId) {
      await prisma.projectAttribute.deleteMany({
        where: {
          id: Number(attrId),
          project_id: project.id,
        },
      });
    } else if (attrKey) {
      await prisma.projectAttribute.deleteMany({
        where: {
          project_id: project.id,
          key: attrKey,
        },
      });
    }

    await auditLog({
      userId: session.sub ? Number(session.sub) : null,
      action: "PROJECT_ATTRIBUTE_DELETED",
      resource: "project_attribute",
      resourceId: `${projectKey}/${attrKey || attrId}`,
      details: { projectKey, key: attrKey, id: attrId },
      ip: getIp(req),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/projects/[key]/attributes] error:", error);
    return NextResponse.json({ error: "Failed to delete project attribute" }, { status: 500 });
  }
}
