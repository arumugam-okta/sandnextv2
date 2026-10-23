import { db } from "@/lib/db";
import { asJson, handleError, json, parseBody } from "@/lib/api";
import { templateInput } from "@/lib/schemas";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const template = await db.template.findUnique({ where: { id }, include: { targetApp: true } });
    return template ? json(template) : json({ error: "Not found" }, 404);
  } catch (e) {
    return handleError(e);
  }
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = await parseBody(req, templateInput);
  if ("error" in parsed) return parsed.error;
  const { files, configSchema, ...rest } = parsed.data;
  try {
    const updated = await db.template.update({
      where: { id },
      data: { ...rest, files: asJson(files), configSchema: asJson(configSchema) },
    });
    return json(updated);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    // sessions reference templates without cascade, so clear them first
    await db.$transaction([
      db.testSession.deleteMany({ where: { templateId: id } }),
      db.template.delete({ where: { id } }),
    ]);
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
