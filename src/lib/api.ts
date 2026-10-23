import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";

export const json = <T>(data: T, status = 200) => NextResponse.json(data, { status });

/** Parse a request body with zod; returns [data] or [undefined, errorResponse] */
export async function parseBody<S extends z.ZodType>(req: Request, schema: S) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { error: json({ error: "Invalid JSON body" }, 400) } as const;
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    return { error: json({ error: "Validation failed", issues: result.error.issues }, 400) } as const;
  }
  return { data: result.data as z.infer<S> } as const;
}

/** Map common Prisma errors to HTTP responses */
export function handleError(err: unknown) {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") return json({ error: "Already exists" }, 409);
    if (err.code === "P2025") return json({ error: "Not found" }, 404);
    if (err.code === "P2003") return json({ error: "Referenced record does not exist" }, 400);
  }
  console.error(err);
  return json({ error: "Internal server error" }, 500);
}

export const asJson = (v: unknown) => v as Prisma.InputJsonValue;
