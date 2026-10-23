"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useSandpack } from "@/hooks/useSandpack";
import { readPreviewPayload } from "@/lib/preview-handoff";

/** Full-window preview of a sandbox handed over from the runner tab. */
export default function Preview() {
  const { key } = useParams<{ key: string }>();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { launch, logs, status } = useSandpack(iframeRef);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    const payload = readPreviewPayload(key);
    if (!payload) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMissing(true);
      return;
    }
    launch(payload.files, payload.template);
  }, [key, launch]);

  if (missing)
    return (
      <div className="grid h-screen place-items-center p-8 text-center text-sm text-muted-foreground">
        <p>
          This preview has expired. Previews are tied to the tab that opened them, so open it again with
          “Open in new tab” in the runner.
        </p>
      </div>
    );

  const lastError = status === "ERROR" ? logs.filter((l) => l.includes("[Error]")).at(-1) : null;

  return (
    <div className="relative h-screen w-screen bg-white">
      <iframe ref={iframeRef} title="preview" className="h-full w-full border-none bg-white" />
      {lastError && (
        <pre className="absolute inset-x-0 bottom-0 max-h-40 overflow-auto bg-red-950 p-3 text-xs text-red-100">
          {lastError.replace(/\x1b\[[0-9;]*m/g, "")}
        </pre>
      )}
    </div>
  );
}
