"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { FileSystemTree } from "@webcontainer/api";
import { useWebContainer } from "@/hooks/useWebContainer";
import { DynamicCredentialForm, type ConfigField } from "@/components/DynamicCredentialForm";
import { CodeWorkspace } from "@/components/CodeWorkspace";
import { TerminalView } from "@/components/TerminalView";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SimpleSelect } from "@/components/SimpleSelect";
import { cn } from "@/lib/utils";
import { hydrateVirtualFileSystem } from "@/lib/template-hydrator";
import { buildTree, flattenTree, type FlatFiles } from "@/lib/file-tree";
import { DEMO_TEMPLATE } from "@/lib/demo-template";

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
type Tab = "terminal" | "preview" | "code";

export default function Runner() {
  const { templateId } = useParams<{ templateId: string }>();
  const { launch, writeFile, stop, logs, serverUrl, status } = useWebContainer();

  const [template, setTemplate] = useState<LoadedTemplate | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedCredentials[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("terminal");
  const [edited, setEdited] = useState<FlatFiles>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState<FlatFiles | null>(null);
  const [credentialsId, setCredentialsId] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<Record<string, string>>({});
  const [formKey, setFormKey] = useState(0);
  const [lastValues, setLastValues] = useState<Record<string, string>>({});

  // Client-side navigation keeps the previous (non-isolated) document; reload once to pick up COOP/COEP.
  useEffect(() => {
    if (!window.crossOriginIsolated && !sessionStorage.getItem("coi-reload")) {
      sessionStorage.setItem("coi-reload", "1");
      window.location.reload();
    } else if (window.crossOriginIsolated) {
      sessionStorage.removeItem("coi-reload");
    }
  }, []);

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
      setActiveTab("terminal");
      if (templateId !== "demo") {
        // fire-and-forget audit record; never block the run on it
        fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateId, credentialsId, fileOverrides: Object.keys(edited).length ? edited : null }),
        }).catch(() => {});
      }
      await launch(buildTree({ ...flat, ...edited }), "npm", ["start"]);
    },
    [template, templateId, credentialsId, edited, launch]
  );

  useEffect(() => {
    if (status === "RUNNING" && serverUrl) setActiveTab("preview");
  }, [status, serverUrl]);

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

  const applyLive = async () => {
    for (const [p, c] of Object.entries(edited)) await writeFile(p, c);
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
    <div className="flex h-screen w-full flex-col lg:flex-row">
      <div className="flex w-full flex-col gap-4 overflow-auto border-r bg-background p-4 lg:w-1/3">
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
          {status === "RUNNING" && <Button size="sm" variant="outline" onClick={stop}>Stop</Button>}
          {templateId !== "demo" && Object.keys(lastValues).length > 0 && (
            <Button size="sm" variant="outline" onClick={saveCredentials}>Save credentials</Button>
          )}
        </div>
      </div>

      <div className="flex min-h-0 w-full flex-col lg:w-2/3">
        <div className="flex items-center gap-2 border-b bg-muted/40 p-2">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Tab)}>
            <TabsList>
              <TabsTrigger value="terminal">Terminal</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="code">
                Code{Object.keys(edited).length > 0 && ` (${Object.keys(edited).length})`}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {serverUrl && (
            <a
              href={serverUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ size: "sm", variant: "outline" }), "ml-auto")}
            >
              Open preview in new tab ↗
            </a>
          )}
          {activeTab === "code" && status === "RUNNING" && Object.keys(edited).length > 0 && (
            <Button size="sm" onClick={applyLive}>Apply to running app</Button>
          )}
        </div>

        <div className="min-h-0 flex-1 bg-black">
          {/* keep terminal mounted so its buffer survives tab switches */}
          <div className={activeTab === "terminal" ? "h-full" : "hidden"}>
            <TerminalView logs={logs} />
          </div>
          {activeTab === "preview" &&
            (serverUrl ? (
              <iframe src={serverUrl} title="preview" className="h-full w-full border-none bg-white" />
            ) : (
              <div className="p-4 text-sm text-white">Server not running yet…</div>
            ))}
          {activeTab === "code" && (
            <CodeWorkspace
              files={files}
              original={baseFiles}
              selected={selected}
              onSelect={setSelected}
              onChange={onEdit}
            />
          )}
        </div>
      </div>
    </div>
  );
}
