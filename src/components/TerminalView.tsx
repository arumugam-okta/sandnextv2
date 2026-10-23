"use client";

import { useEffect, useRef } from "react";
import type { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";

/** Streams the `logs` chunk array into an xterm instance (append-only; resets when logs shrink). */
export function TerminalView({ logs }: { logs: string[] }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const writtenRef = useRef(0);
  const logsRef = useRef(logs);
  useEffect(() => {
    logsRef.current = logs;
  });

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    (async () => {
      const [{ Terminal }, { FitAddon }] = await Promise.all([import("@xterm/xterm"), import("@xterm/addon-fit")]);
      if (disposed || !hostRef.current) return;
      const term = new Terminal({
        convertEol: true,
        fontSize: 12,
        disableStdin: true,
        theme: { background: "#0a0a0a" },
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(hostRef.current);
      fit.fit();
      termRef.current = term;
      writtenRef.current = 0;
      logsRef.current.forEach((l) => term.write(l));
      writtenRef.current = logsRef.current.length;

      const ro = new ResizeObserver(() => {
        try {
          fit.fit();
        } catch {
          /* host hidden */
        }
      });
      ro.observe(hostRef.current);
      cleanup = () => {
        ro.disconnect();
        term.dispose();
        termRef.current = null;
      };
    })();
    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    if (logs.length < writtenRef.current) {
      term.reset();
      writtenRef.current = 0;
    }
    for (let i = writtenRef.current; i < logs.length; i++) term.write(logs[i]);
    writtenRef.current = logs.length;
  }, [logs]);

  return <div ref={hostRef} className="h-full w-full bg-[#0a0a0a] p-2" />;
}
