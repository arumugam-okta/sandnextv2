"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { languageFor, type FlatFiles } from "@/lib/file-tree";
import { cn } from "@/lib/utils";

const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className="p-4 text-sm text-muted-foreground">Loading editor…</div>,
});

interface Props {
  files: FlatFiles;
  original?: FlatFiles;
  selected: string | null;
  onSelect: (path: string) => void;
  onChange: (path: string, contents: string) => void;
  readOnly?: boolean;
}

/** File list + Monaco editor. Modified files (vs `original`) get a dot marker. */
export function CodeWorkspace({ files, original, selected, onSelect, onChange, readOnly }: Props) {
  const paths = useMemo(() => Object.keys(files).sort(), [files]);
  const current = selected && selected in files ? selected : paths[0] ?? null;

  return (
    <div className="flex h-full min-h-0">
      <ul className="w-56 shrink-0 overflow-auto border-r bg-muted/30 py-1 text-xs">
        {paths.map((p) => {
          const dirty = original ? original[p] !== files[p] : false;
          return (
            <li key={p}>
              <button
                onClick={() => onSelect(p)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 px-3 py-1 text-left font-mono hover:bg-muted",
                  p === current && "bg-muted font-semibold"
                )}
                title={p}
              >
                <span className="truncate">{p}</span>
                {dirty && <span className="size-1.5 shrink-0 rounded-full bg-amber-500" aria-label="modified" />}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="min-w-0 flex-1">
        {current ? (
          <Editor
            height="100%"
            theme="vs-dark"
            path={current}
            language={languageFor(current)}
            value={files[current]}
            onChange={(v) => onChange(current, v ?? "")}
            options={{ minimap: { enabled: false }, fontSize: 13, readOnly, scrollBeyondLastLine: false }}
          />
        ) : (
          <div className="p-4 text-sm text-muted-foreground">No files</div>
        )}
      </div>
    </div>
  );
}
