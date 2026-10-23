"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { WebContainer, type FileSystemTree, type WebContainerProcess } from "@webcontainer/api";

export type ContainerStatus = "IDLE" | "BOOTING" | "INSTALLING" | "RUNNING" | "ERROR";

export function useWebContainer() {
  const [logs, setLogs] = useState<string[]>([]);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<ContainerStatus>("IDLE");
  const containerRef = useRef<WebContainer | null>(null);
  const bootRef = useRef<Promise<WebContainer> | null>(null);
  const portListenerRef = useRef(false);
  const procsRef = useRef<WebContainerProcess[]>([]);
  const runIdRef = useRef(0);

  const appendLog = useCallback((msg: string) => setLogs((prev) => [...prev, msg]), []);
  const sink = useCallback(() => new WritableStream<string>({ write: appendLog }), [appendLog]);

  const killProcesses = () => {
    for (const p of procsRef.current) {
      try {
        p.kill();
      } catch {
        /* already exited */
      }
    }
    procsRef.current = [];
  };

  // WebContainer.boot() may only be called once per page; share the promise
  const getContainer = () => {
    bootRef.current ??= WebContainer.boot().then((wc) => (containerRef.current = wc));
    return bootRef.current;
  };

  const launch = useCallback(
    async (fileTree: FileSystemTree, startCmd = "npm", startArgs = ["start"]) => {
      const runId = ++runIdRef.current;
      const stale = () => runId !== runIdRef.current;
      try {
        killProcesses();
        setLogs([]);
        setServerUrl(null);
        setStatus("BOOTING");
        appendLog("\x1b[36m[System]\x1b[0m Booting WebContainer instance...\n");

        if (typeof SharedArrayBuffer === "undefined" || !window.crossOriginIsolated) {
          throw new Error(
            "Page is not cross-origin isolated (COOP/COEP headers missing), so WebContainer cannot start."
          );
        }

        const instance = await getContainer();
        if (stale()) return;

        if (!portListenerRef.current) {
          portListenerRef.current = true;
          instance.on("port", (port, type, url) => {
            if (type === "open") {
              appendLog(`\x1b[36m[System]\x1b[0m Port ${port} ready at: ${url}\n`);
              setServerUrl(url);
            }
          });
          instance.on("error", (e) => appendLog(`\x1b[31m[WebContainer error]\x1b[0m ${e.message}\n`));
        }

        appendLog("\x1b[36m[System]\x1b[0m Mounting hydrated filesystem...\n");
        await instance.mount(fileTree);

        setStatus("INSTALLING");
        appendLog("\x1b[36m[System]\x1b[0m Running npm install...\n");
        const install = await instance.spawn("npm", ["install"]);
        procsRef.current.push(install);
        install.output.pipeTo(sink());
        const code = await install.exit;
        if (stale()) return;
        if (code !== 0) throw new Error(`npm install exited with code ${code}.`);

        setStatus("RUNNING");
        appendLog(`\x1b[36m[System]\x1b[0m Executing ${startCmd} ${startArgs.join(" ")}...\n`);
        const server = await instance.spawn(startCmd, startArgs);
        procsRef.current.push(server);
        server.output.pipeTo(sink());
        server.exit.then((c) => {
          if (stale()) return;
          appendLog(`\x1b[33m[System]\x1b[0m Process exited with code ${c}\n`);
          if (c !== 0) setStatus("ERROR");
        });
      } catch (err) {
        if (stale()) return;
        setStatus("ERROR");
        appendLog(`\x1b[31m[Error]\x1b[0m ${err instanceof Error ? err.message : String(err)}\n`);
      }
    },
    [appendLog, sink]
  );

  /** Write a single file into the running container (dev server hot-reloads it) */
  const writeFile = useCallback(async (path: string, contents: string) => {
    const wc = containerRef.current;
    if (!wc) throw new Error("Container is not running");
    const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
    if (dir) await wc.fs.mkdir(dir, { recursive: true });
    await wc.fs.writeFile(path, contents);
  }, []);

  const stop = useCallback(() => {
    runIdRef.current++;
    killProcesses();
    setServerUrl(null);
    setStatus("IDLE");
  }, []);

  useEffect(
    () => () => {
      runIdRef.current++;
      killProcesses();
    },
    []
  );

  return { launch, writeFile, stop, logs, serverUrl, status };
}
