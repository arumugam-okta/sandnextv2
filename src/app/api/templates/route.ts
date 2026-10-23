import { db } from "@/lib/db";
import { asJson, handleError, json, parseBody } from "@/lib/api";
import { templateInput } from "@/lib/schemas";

export async function GET() {
  try {
    // omit the heavy `files` blob from list responses
    const templates = await db.template.findMany({
      orderBy: { createdAt: "desc" },
      omit: { files: true },
      include: { targetApp: true },
    });
    return json(templates);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  const parsed = await parseBody(req, templateInput);
  if ("error" in parsed) return parsed.error;
  const { files, configSchema, ...rest } = parsed.data;
  try {
    const created = await db.template.create({
      data: { ...rest, files: asJson(files), configSchema: asJson(configSchema) },
    });
    return json(created, 201);
  } catch (e) {
    return handleError(e);
  }
}
