import type { FileSystemTree } from "@/lib/file-tree";
import type { ConfigField } from "@/components/DynamicCredentialForm";

/** Database-free template for smoke-testing the runner at /runner/demo (Sandpack create-react-app) */
export const DEMO_TEMPLATE = {
  id: "demo",
  sdkVersion: "create-react-app demo",
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
          { main: "/src/index.js", dependencies: { react: "^18.2.0", "react-dom": "^18.2.0", "react-scripts": "^5.0.0" } },
          null,
          2
        ),
      },
    },
    public: {
      directory: {
        "index.html": {
          file: { contents: `<!DOCTYPE html><html><head><title>Demo</title></head><body><div id="root"></div></body></html>` },
        },
      },
    },
    src: {
      directory: {
        "index.js": {
          file: {
            contents: `import React from "react";
import { createRoot } from "react-dom/client";

createRoot(document.getElementById("root")).render(
  <div style={{ fontFamily: "system-ui", padding: 24 }}>
    <h1>SDK Active</h1>
    <p>Issuer: {{issuer}}</p>
    <p>Client: {{clientId}}</p>
  </div>
);
`,
          },
        },
      },
    },
  } as FileSystemTree,
};
