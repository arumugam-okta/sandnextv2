"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SandpackRuntime } from "@codesandbox/sandpack-client/clients/runtime";
import type { SandboxSetup, SandpackTemplate } from "@codesandbox/sandpack-client";
import type { FlatFiles } from "@/lib/file-tree";

export type RunStatus = "IDLE" | "BOOTING" | "INSTALLING" | "RUNNING" | "ERROR";

export const BUNDLER_URL = process.env.NEXT_PUBLIC_BUNDLER_URL ?? "http://localhost:8090";

const toBundlerFiles = (files: FlatFiles): SandboxSetup["files"] =>
  Object.fromEntries(Object.entries(files).map(([p, code]) => [p.startsWith("/") ? p : `/${p}`, { code }]));

/**
 * Runs a template through a self-hosted Sandpack bundler. `iframeRef` is the preview iframe the
 * bundler mounts into. Logs mirror what the bundler reports (status, console, errors).
 */
export function useSandpack(iframeRef: React.RefObject<HTMLIFrameElement | null>) {
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<RunStatus>("IDLE");
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const clientRef = useRef<SandpackRuntime | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const templateRef = useRef<SandpackTemplate | undefined>(undefined);
  const runIdRef = useRef(0);

  const log = useCallback((msg: string) => setLogs((prev) => [...prev, msg]), []);
  const sys = useCallback((msg: string) => log(`\x1b[36m[System]\x1b[0m ${msg}\n`), [log]);

  const destroy = () => {
    unsubRef.current?.();
    unsubRef.current = null;
    clientRef.current?.destroy();
    clientRef.current = null;
  };

  const launch = useCallback(
    async (files: FlatFiles, template: SandpackTemplate) => {
      const runId = ++runIdRef.current;
      try {
        destroy();
        setLogs([]);
        setServerUrl(null);
        setStatus("BOOTING");
        templateRef.current = template;
        sys(`Using bundler ${BUNDLER_URL} (template: ${template})`);

        const iframe = iframeRef.current;
        if (!iframe) throw new Error("Preview iframe is not mounted");

        // fail early with a useful message if the bundler isn't being served
        await fetch(BUNDLER_URL, { mode: "no-cors" }).catch(() => {
          throw new Error(`Cannot reach the Sandpack bundler at ${BUNDLER_URL}. Start it with: npm run bundler`);
        });

        const pkg = files["package.json"] ? JSON.parse(files["package.json"]) : {};
        const setup: SandboxSetup = {
          files: toBundlerFiles(files),
          dependencies: pkg.dependencies ?? {},
          devDependencies: pkg.devDependencies ?? {},
          entry: pkg.main,
          template,
        };

        const { SandpackRuntime } = await import("@codesandbox/sandpack-client/clients/runtime");
        const client = new SandpackRuntime(iframe, setup, {
          bundlerURL: BUNDLER_URL,
          // the overlay button POSTs every file (incl. credentials) to codesandbox.io
          showOpenInCodeSandbox: false,
          showLoadingScreen: true,
          showErrorScreen: true,
        });
        clientRef.current = client;

        unsubRef.current = client.listen((msg) => {
          if (runId !== runIdRef.current) return;
          switch (msg.type) {
            case "status":
              sys(`status: ${msg.status}`);
              if (msg.status === "installing-dependencies") setStatus("INSTALLING");
              break;
            case "start":
              sys("compiling…");
              break;
            case "done":
              if (msg.compilatonError) {
                setStatus("ERROR");
              } else {
                setStatus("RUNNING");
                sys("Compiled successfully");
              }
              break;
            case "urlchange":
              setServerUrl(msg.url);
              break;
            case "action":
              if ("action" in msg && msg.action === "show-error") {
                setStatus("ERROR");
                log(`\x1b[31m[Error]\x1b[0m ${msg.title}: ${msg.message}${msg.path ? ` (${msg.path}:${msg.line})` : ""}\n`);
              }
              break;
            case "console":
              for (const entry of msg.log) {
                if (entry.method === "clear") continue;
                log(`[console.${entry.method}] ${entry.data.join(" ")}\n`);
              }
              break;
          }
        });
        setStatus("INSTALLING");
      } catch (err) {
        if (runId !== runIdRef.current) return;
        setStatus("ERROR");
        log(`\x1b[31m[Error]\x1b[0m ${err instanceof Error ? err.message : String(err)}\n`);
      }
    },
    [iframeRef, log, sys]
  );

  /** Recompile the running sandbox with edited files */
  const update = useCallback((files: FlatFiles) => {
    const client = clientRef.current;
    if (!client) throw new Error("Sandbox is not running");
    const pkg = files["package.json"] ? JSON.parse(files["package.json"]) : {};
    client.updateSandbox({
      files: toBundlerFiles(files),
      dependencies: pkg.dependencies ?? {},
      devDependencies: pkg.devDependencies ?? {},
      entry: pkg.main,
      template: templateRef.current,
    });
  }, []);

  const stop = useCallback(() => {
    runIdRef.current++;
    destroy();
    setServerUrl(null);
    setStatus("IDLE");
  }, []);

  useEffect(
    () => () => {
      runIdRef.current++;
      destroy();
    },
    []
  );

  return { launch, update, stop, logs, status, serverUrl };
}
