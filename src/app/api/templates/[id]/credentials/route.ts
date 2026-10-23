import { db } from "@/lib/db";
import { asJson, handleError, json, parseBody } from "@/lib/api";
import { credentialsInput } from "@/lib/schemas";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    return json(await db.appCredentials.findMany({ where: { templateId: id }, orderBy: { createdAt: "desc" } }));
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = await parseBody(req, credentialsInput);
  if ("error" in parsed) return parsed.error;
  try {
    const created = await db.appCredentials.create({
      data: { templateId: id, name: parsed.data.name, configValues: asJson(parsed.data.configValues) },
    });
    return json(created, 201);
  } catch (e) {
    return handleError(e);
  }
}
