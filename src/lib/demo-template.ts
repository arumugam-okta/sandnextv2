import type { FileSystemTree } from "@webcontainer/api";
import type { ConfigField } from "@/components/DynamicCredentialForm";

/** Database-free template for smoke-testing the runner at /runner/demo */
export const DEMO_TEMPLATE = {
  id: "demo",
  sdkVersion: "http-server demo",
  authFlow: "n/a",
  identityProvider: "n/a",
  configSchema: [
    { key: "issuer", label: "Okta Issuer", type: "text", required: true, placeholder: "https://dev.okta.com/oauth2/default" },
    { key: "clientId", label: "Client ID", type: "text", required: true, placeholder: "0oa..." },
  ] as ConfigField[],
  files: {
    "package.json": {
      file: {
        contents: JSON.stringify(
          { name: "demo", scripts: { start: "http-server -p 4200 -c-1" }, dependencies: { "http-server": "^14.1.1" } },
          null,
          2
        ),
      },
    },
    "index.html": {
      file: {
        contents: `<html><body><h1>SDK Active</h1><p>Issuer: {{issuer}}</p><p>Client: {{clientId}}</p></body></html>`,
      },
    },
  } as FileSystemTree,
};
