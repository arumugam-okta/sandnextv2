import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildTree } from "../src/lib/file-tree";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../src/generated/prisma/client";

const TEMPLATE_DIR = join(__dirname, "templates", "angular-spa");

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

async function main() {
  const angularApp = await prisma.targetApp.upsert({
    where: { slug: "angular-spa" },
    update: {},
    create: {
      slug: "angular-spa",
      name: "Angular Single Page Application",
      runtime: "webcontainer",
    },
  });

  // keep the same row (and its saved credentials) when the SDK version label changes
  await prisma.template.updateMany({
    where: { targetAppId: angularApp.id, sdkVersion: "@okta/okta-angular@6.3.0", authFlow: "PKCE", identityProvider: "Okta" },
    data: { sdkVersion: "@okta/okta-angular@8.0.0" },
  });

  await prisma.template.upsert({
    where: {
      targetAppId_sdkVersion_authFlow_identityProvider: {
        targetAppId: angularApp.id,
        sdkVersion: "@okta/okta-angular@8.0.0",
        authFlow: "PKCE",
        identityProvider: "Okta",
      },
    },
    update: { files: buildTree(readDir(TEMPLATE_DIR)) as unknown as Prisma.InputJsonValue, configSchema: CONFIG_SCHEMA },
    create: {
      targetAppId: angularApp.id,
      sdkVersion: "@okta/okta-angular@8.0.0",
      authFlow: "PKCE",
      identityProvider: "Okta",
      configSchema: CONFIG_SCHEMA,
      files: buildTree(readDir(TEMPLATE_DIR)) as unknown as Prisma.InputJsonValue,
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
