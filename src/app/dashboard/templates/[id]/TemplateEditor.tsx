"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SimpleSelect } from "@/components/SimpleSelect";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CodeWorkspace } from "@/components/CodeWorkspace";
import { ConfigSchemaBuilder } from "@/components/ConfigSchemaBuilder";
import type { ConfigField } from "@/components/DynamicCredentialForm";
import { buildTree, flattenTree, isFileSystemTree, type FlatFiles } from "@/lib/file-tree";

interface TargetApp { id: string; name: string }

export default function TemplateEditor() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const isNew = id === "new";

  const [apps, setApps] = useState<TargetApp[]>([]);
  const [targetAppId, setTargetAppId] = useState("");
  const [sdkVersion, setSdkVersion] = useState("");
  const [authFlow, setAuthFlow] = useState("PKCE");
  const [identityProvider, setIdentityProvider] = useState("Okta");
  const [schema, setSchema] = useState<ConfigField[]>([]);
  const [files, setFiles] = useState<FlatFiles>({
    "package.json": JSON.stringify({ name: "sample", scripts: { start: "http-server -p 4200" }, dependencies: { "http-server": "^14.1.1" } }, null, 2),
    "index.html": "<h1>Hello {{issuer}}</h1>",
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);

  useEffect(() => {
    (async () => {
      const a = await fetch("/api/target-apps");
      if (a.ok) {
        const list = (await a.json()) as TargetApp[];
        setApps(list);
        if (isNew && list[0]) setTargetAppId(list[0].id);
      }
      if (!isNew) {
        const res = await fetch(`/api/templates/${id}`);
        if (!res.ok) {
          toast.error("Template not found");
          router.push("/dashboard/templates");
          return;
        }
        const t = await res.json();
        setTargetAppId(t.targetAppId);
        setSdkVersion(t.sdkVersion);
        setAuthFlow(t.authFlow);
        setIdentityProvider(t.identityProvider);
        setSchema(t.configSchema);
        setFiles(flattenTree(t.files));
        setLoading(false);
      }
    })();
  }, [id, isNew, router]);

  const paths = useMemo(() => Object.keys(files), [files]);

  const addFile = () => {
    const path = window.prompt("New file path (e.g. src/app/auth.config.ts)")?.trim().replace(/^\/+/, "");
    if (!path) return;
    if (path in files) return toast.error("File already exists");
    setFiles((f) => ({ ...f, [path]: "" }));
    setSelected(path);
  };

  const deleteFile = () => {
    const target = selected ?? paths[0];
    if (!target || !window.confirm(`Delete ${target}?`)) return;
    setFiles(({ [target]: _drop, ...rest }) => {
      void _drop;
      return rest;
    });
    setSelected(null);
  };

  const importJson = () => {
    const raw = window.prompt("Paste a WebContainer FileSystemTree JSON");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (!isFileSystemTree(parsed)) throw new Error("Not a valid FileSystemTree");
      setFiles(flattenTree(parsed));
      setSelected(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invalid JSON");
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(isNew ? "/api/templates" : `/api/templates/${id}`, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetAppId,
          sdkVersion,
          authFlow,
          identityProvider,
          configSchema: schema,
          files: buildTree(files),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = body.issues?.[0] ? `: ${body.issues[0].path?.join(".")} ${body.issues[0].message}` : "";
        throw new Error((body.error ?? "Save failed") + detail);
      }
      toast.success("Template saved");
      router.push("/dashboard/templates");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <Link href="/dashboard/templates" className="text-xs text-muted-foreground underline">← Templates</Link>
          <h1 className="text-2xl font-bold">{isNew ? "New template" : "Edit template"}</h1>
        </div>
        <div className="flex gap-2">
          {!isNew && <Link href={`/runner/${id}`} className={cn(buttonVariants({ variant: "outline" }))}>Open runner</Link>}
          <Button onClick={save} disabled={saving || !targetAppId || !sdkVersion || !authFlow}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </header>

      <Card>
        <CardHeader><CardTitle>Template details</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="app">Target app</Label>
          <SimpleSelect
            id="app"
            value={targetAppId}
            onValueChange={setTargetAppId}
            placeholder="Create a target app first"
            options={apps.map((a) => ({ value: a.id, label: a.name }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sdk">SDK version</Label>
          <Input id="sdk" value={sdkVersion} onChange={(e) => setSdkVersion(e.target.value)} placeholder="@okta/okta-angular@6.3.0" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="flow">Auth flow</Label>
          <Input id="flow" value={authFlow} onChange={(e) => setAuthFlow(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="idp">Identity provider</Label>
          <Input id="idp" value={identityProvider} onChange={(e) => setIdentityProvider(e.target.value)} />
        </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Credential form fields</CardTitle></CardHeader>
        <CardContent><ConfigSchemaBuilder value={schema} onChange={setSchema} /></CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Files</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={addFile}>+ File</Button>
            <Button size="sm" variant="outline" onClick={deleteFile}>Delete selected</Button>
            <Button size="sm" variant="outline" onClick={importJson}>Import JSON</Button>
          </div>
        </CardHeader>
        <CardContent>
        <div className="h-[28rem] overflow-hidden rounded-md border">
          <CodeWorkspace
            files={files}
            selected={selected}
            onSelect={setSelected}
            onChange={(p, c) => setFiles((f) => ({ ...f, [p]: c }))}
          />
        </div>
        </CardContent>
      </Card>
    </main>
  );
}
