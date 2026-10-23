import { z } from "zod";
import { isFileSystemTree } from "@/lib/file-tree";

export const configFieldSchema = z.object({
  key: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "Key must be an identifier"),
  label: z.string().min(1),
  type: z.enum(["text", "password"]),
  placeholder: z.string().optional(),
  required: z.boolean().optional(),
});

const filesSchema = z.custom<Record<string, unknown>>(
  (v) => isFileSystemTree(v),
  "files must be a valid WebContainer FileSystemTree"
);

export const targetAppInput = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/, "lowercase letters, digits and dashes only"),
  name: z.string().min(1),
  runtime: z.enum(["webcontainer", "docker"]).default("webcontainer"),
});

export const templateInput = z.object({
  targetAppId: z.string().min(1),
  sdkVersion: z.string().min(1),
  authFlow: z.string().min(1),
  identityProvider: z.string().min(1).default("Okta"),
  files: filesSchema,
  configSchema: z.array(configFieldSchema),
});

export const credentialsInput = z.object({
  name: z.string().min(1),
  configValues: z.record(z.string(), z.string()),
});

export const sessionInput = z.object({
  templateId: z.string().min(1),
  credentialsId: z.string().nullish(),
  fileOverrides: z.record(z.string(), z.string()).nullish(),
});
