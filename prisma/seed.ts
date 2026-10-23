import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildTree } from "../src/lib/file-tree";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../src/generated/prisma/client";

const CONFIG_SCHEMA = [
        { key: "issuer", label: "Okta Issuer URL", type: "text", required: true, placeholder: "https://dev-12345.okta.com/oauth2/default" },
        { key: "clientId", label: "Client ID", type: "text", required: true, placeholder: "0oa123456789" },
];

/** Recursively read a directory into { "relative/path": contents } (dotfiles included) */
function readDir(root: string, rel = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const entry of readdirSync(join(root, rel), { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "package-lock.json") continue;
    const path = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) Object.assign(out, readDir(root, path));
    else out[path] = readFileSync(join(root, path), "utf8");
  }
  return out;
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

interface TemplateDef {
  targetSlug: string;
  targetName: string;
  dir: string;
  sdkVersion: string;
  /** previous labels for this template; renamed in place so ids and saved credentials survive */
  renamedFrom?: string[];
}

const TEMPLATES: TemplateDef[] = [
  {
    targetSlug: "angular-spa",
    targetName: "Angular Single Page Application",
    dir: "angular-spa",
    sdkVersion: "@okta/okta-angular@4.1.0",
    renamedFrom: ["@okta/okta-angular@8.0.0", "@okta/okta-angular@6.3.0"],
  },
  {
    targetSlug: "react-spa",
    targetName: "React Single Page Application",
    dir: "react-spa",
    sdkVersion: "@okta/okta-react@6.9.0",
    renamedFrom: ["@okta/okta-react@6.11.0"],
  },
];

async function main() {
  for (const def of TEMPLATES) {
    const files = buildTree(readDir(join(__dirname, "templates", def.dir))) as unknown as Prisma.InputJsonValue;

    const app = await prisma.targetApp.upsert({
      where: { slug: def.targetSlug },
      update: { runtime: "nodepod" },
      create: { slug: def.targetSlug, name: def.targetName, runtime: "nodepod" },
    });

    for (const old of def.renamedFrom ?? []) {
      await prisma.template.updateMany({
        where: { targetAppId: app.id, sdkVersion: old, authFlow: "PKCE", identityProvider: "Okta" },
        data: { sdkVersion: def.sdkVersion },
      });
    }

    await prisma.template.upsert({
      where: {
        targetAppId_sdkVersion_authFlow_identityProvider: {
          targetAppId: app.id,
          sdkVersion: def.sdkVersion,
          authFlow: "PKCE",
          identityProvider: "Okta",
        },
      },
      update: { files, configSchema: CONFIG_SCHEMA },
      create: {
        targetAppId: app.id,
        sdkVersion: def.sdkVersion,
        authFlow: "PKCE",
        identityProvider: "Okta",
        configSchema: CONFIG_SCHEMA,
        files,
      },
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
