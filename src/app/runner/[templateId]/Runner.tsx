"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { FileSystemTree } from "@/lib/file-tree";
import { useSandpack } from "@/hooks/useSandpack";
import type { SandpackTemplate } from "@codesandbox/sandpack-client";
import { DynamicCredentialForm, type ConfigField } from "@/components/DynamicCredentialForm";
import { CodeWorkspace } from "@/components/CodeWorkspace";
import { TerminalView } from "@/components/TerminalView";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SimpleSelect } from "@/components/SimpleSelect";
import { hydrateVirtualFileSystem } from "@/lib/template-hydrator";
import { flattenTree, type FlatFiles } from "@/lib/file-tree";
import { DEMO_TEMPLATE } from "@/lib/demo-template";
import { openPreviewTab } from "@/lib/preview-handoff";
import { toast } from "sonner";

interface LoadedTemplate {
  id: string;
  sdkVersion: string;
  authFlow: string;
  identityProvider: string;
  files: FileSystemTree;
  configSchema: ConfigField[];
}
interface SavedCredentials {
  id: string;
  name: string;
  configValues: Record<string, string>;
}
/** Pick the Sandpack bundler environment from the template's package.json */
function detectTemplate(files: FlatFiles): SandpackTemplate {
  const pkg = files["package.json"] ? JSON.parse(files["package.json"]) : {};
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (deps["@angular/core"]) return "angular-cli";
  if (deps["react-scripts"]) return deps["typescript"] ? "create-react-app-typescript" : "create-react-app";
  return "static";
}

export default function Runner() {
  const { templateId } = useParams<{ templateId: string }>();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { launch, update, stop, logs, serverUrl, status } = useSandpack(iframeRef);

  const [template, setTemplate] = useState<LoadedTemplate | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedCredentials[]>([]);
  const [showConsole, setShowConsole] = useState(true);
  const [split, setSplit] = useState(50); // editor width, % of the workspace
  const [dragging, setDragging] = useState(false);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [edited, setEdited] = useState<FlatFiles>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState<FlatFiles | null>(null);
  const [credentialsId, setCredentialsId] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<Record<string, string>>({});
  const [formKey, setFormKey] = useState(0);
  const [lastValues, setLastValues] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (templateId === "demo") {
        setTemplate(DEMO_TEMPLATE);
        return;
      }
      try {
        const res = await fetch(`/api/templates/${templateId}`);
        if (!res.ok) throw new Error(res.status === 404 ? "Template not found" : `Failed to load template (${res.status})`);
        const t = (await res.json()) as LoadedTemplate;
        const creds = await fetch(`/api/templates/${templateId}/credentials`);
        if (!cancelled) {
          setTemplate(t);
          if (creds.ok) setSaved(await creds.json());
        }
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [templateId]);

  // Editor shows the hydrated files once a run starts, otherwise the raw template
  const baseFiles = useMemo(() => hydrated ?? (template ? flattenTree(template.files) : {}), [hydrated, template]);
  const files = useMemo(() => ({ ...baseFiles, ...edited }), [baseFiles, edited]);

  const handleStart = useCallback(
    async (values: Record<string, string>) => {
      if (!template) return;
      setLastValues(values);
      const flat = flattenTree(hydrateVirtualFileSystem(template.files, values));
      setHydrated(flat);
      setShowConsole(true);
      if (templateId !== "demo") {
        // fire-and-forget audit record; never block the run on it
        fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateId, credentialsId, fileOverrides: Object.keys(edited).length ? edited : null }),
        }).catch(() => {});
      }
      await launch({ ...flat, ...edited }, detectTemplate(flat));
    },
    [template, templateId, credentialsId, edited, launch]
  );

  // Recompile the running sandbox shortly after the last edit
  useEffect(() => {
    if (status !== "RUNNING" || Object.keys(edited).length === 0) return;
    const t = setTimeout(() => {
      try {
        update({ ...(hydrated ?? {}), ...edited });
      } catch {
        /* sandbox was stopped in the meantime */
      }
    }, 700);
    return () => clearTimeout(t);
  }, [edited, hydrated, status, update]);

  // Draggable divider between editor and preview
  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => {
      const box = workspaceRef.current?.getBoundingClientRect();
      if (!box) return;
      setSplit(Math.min(80, Math.max(20, ((e.clientX - box.left) / box.width) * 100)));
    };
    const up = () => setDragging(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [dragging]);

  const onEdit = (path: string, contents: string) => {
    setEdited((prev) => {
      if (contents === baseFiles[path]) {
        const { [path]: _drop, ...rest } = prev;
        void _drop;
        return rest;
      }
      return { ...prev, [path]: contents };
    });
  };

  const saveCredentials = async () => {
    const name = window.prompt("Name for these credentials?");
    if (!name || !Object.keys(lastValues).length) return;
    const res = await fetch(`/api/templates/${templateId}/credentials`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, configValues: lastValues }),
    });
    if (res.ok) {
      const created = (await res.json()) as SavedCredentials;
      setSaved((s) => [created, ...s]);
    }
  };

  const busy = status === "BOOTING" || status === "INSTALLING";

  if (loadError)
    return (
      <div className="p-8">
        <p className="text-destructive">{loadError}</p>
        <Link href="/dashboard/templates" className="underline">Back to templates</Link>
      </div>
    );
  if (!template) return <div className="p-8 text-sm text-muted-foreground">Loading template…</div>;

  return (
    <div className="flex h-screen w-full">
      <div className="flex w-72 shrink-0 flex-col gap-4 overflow-auto border-r bg-background p-4">
        <div>
          <Link href="/dashboard/templates" className="text-xs text-muted-foreground underline">← Templates</Link>
          <h2 className="text-xl font-bold">SDK Test Harness</h2>
          <div className="mt-1 flex flex-wrap gap-1">
            <Badge variant="secondary">{template.sdkVersion}</Badge>
            <Badge variant="outline">{template.authFlow}</Badge>
            <Badge variant="outline">{template.identityProvider}</Badge>
          </div>
        </div>

        {saved.length > 0 && (
          <div className="space-y-1">
            <Label htmlFor="saved-creds">Saved credentials</Label>
            <SimpleSelect
              id="saved-creds"
              value={credentialsId ?? "none"}
              onValueChange={(v) => {
                const c = saved.find((s) => s.id === v);
                setCredentialsId(c?.id ?? null);
                setPrefill(c?.configValues ?? {});
                setFormKey((k) => k + 1);
              }}
              options={[{ value: "none", label: "— none —" }, ...saved.map((s) => ({ value: s.id, label: s.name }))]}
            />
          </div>
        )}

        <DynamicCredentialForm
          key={formKey}
          fields={template.configSchema}
          defaultValues={prefill}
          onSubmit={handleStart}
          isLoading={busy}
        />

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>Status: <span className="font-bold">{status}</span></span>
          {status !== "IDLE" && <Button size="sm" variant="outline" onClick={stop}>Stop</Button>}
          {hydrated && status !== "IDLE" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const merged = { ...hydrated, ...edited };
                if (!openPreviewTab({ files: merged, template: detectTemplate(merged) })) {
                  toast.error("The browser blocked the new tab; allow pop-ups for this site.");
                }
              }}
            >
              Open in new tab ↗
            </Button>
          )}
          {templateId !== "demo" && Object.keys(lastValues).length > 0 && (
            <Button size="sm" variant="outline" onClick={saveCredentials}>Save credentials</Button>
          )}
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div ref={workspaceRef} className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-col" style={{ width: `${split}%` }}>
            <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-1.5 text-xs">
              <span className="font-medium">Code</span>
              {Object.keys(edited).length > 0 && (
                <Badge variant="secondary">
                  {Object.keys(edited).length} edited{status === "RUNNING" ? " · auto-applied" : ""}
                </Badge>
              )}
            </div>
            <div className="min-h-0 flex-1">
              <CodeWorkspace
                files={files}
                original={baseFiles}
                selected={selected}
                onSelect={setSelected}
                onChange={onEdit}
              />
            </div>
          </div>

          <div
            role="separator"
            aria-orientation="vertical"
            onPointerDown={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            className="w-1.5 shrink-0 cursor-col-resize bg-border hover:bg-primary/40"
          />

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-1.5 text-xs">
              <span className="font-medium">Preview</span>
              <span className="truncate text-muted-foreground">{serverUrl ?? ""}</span>
            </div>
            <div className="relative min-h-0 flex-1 bg-white">
              {/* the bundler mounts into this iframe, so it is never unmounted */}
              <iframe
                ref={iframeRef}
                title="preview"
                className={`h-full w-full border-none bg-white ${dragging ? "pointer-events-none" : ""}`}
              />
              {status === "IDLE" && (
                <div className="absolute inset-0 grid place-items-center bg-muted/30 text-sm text-muted-foreground">
                  Fill in the form and click “Run Test Instance”
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="border-t bg-black">
          <button
            onClick={() => setShowConsole((v) => !v)}
            className="flex w-full items-center justify-between bg-muted/40 px-3 py-1 text-left text-xs"
          >
            <span className="font-medium">Console</span>
            <span>{showConsole ? "▼" : "▲"}</span>
          </button>
          {/* kept mounted so the terminal buffer survives collapsing */}
          <div className={showConsole ? "h-48" : "hidden"}>
            <TerminalView logs={logs} />
          </div>
        </div>
      </div>
    </div>
  );
}
