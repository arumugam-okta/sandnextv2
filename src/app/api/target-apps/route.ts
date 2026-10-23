import { db } from "@/lib/db";
import { handleError, json, parseBody } from "@/lib/api";
import { targetAppInput } from "@/lib/schemas";

export async function GET() {
  try {
    const apps = await db.targetApp.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { templates: true } } },
    });
    return json(apps);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  const parsed = await parseBody(req, targetAppInput);
  if ("error" in parsed) return parsed.error;
  try {
    return json(await db.targetApp.create({ data: parsed.data }), 201);
  } catch (e) {
    return handleError(e);
  }
}
