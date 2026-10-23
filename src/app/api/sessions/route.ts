import { db } from "@/lib/db";
import { asJson, handleError, json, parseBody } from "@/lib/api";
import { sessionInput } from "@/lib/schemas";

export async function POST(req: Request) {
  const parsed = await parseBody(req, sessionInput);
  if ("error" in parsed) return parsed.error;
  const { fileOverrides, credentialsId, templateId } = parsed.data;
  try {
    const session = await db.testSession.create({
      data: {
        templateId,
        credentialsId: credentialsId ?? null,
        fileOverrides: fileOverrides ? asJson(fileOverrides) : undefined,
        status: "RUNNING",
      },
    });
    return json(session, 201);
  } catch (e) {
    return handleError(e);
  }
}
