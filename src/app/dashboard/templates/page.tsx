"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface TargetApp {
  id: string;
  slug: string;
  name: string;
  runtime: string;
  _count: { templates: number };
}
interface TemplateRow {
  id: string;
  sdkVersion: string;
  authFlow: string;
  identityProvider: string;
  targetApp: { name: string };
}

export default function TemplatesDashboard() {
  const [apps, setApps] = useState<TargetApp[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");

  const load = useCallback(async () => {
    try {
      const [a, t] = await Promise.all([fetch("/api/target-apps"), fetch("/api/templates")]);
      if (!a.ok || !t.ok) throw new Error("Failed to load data — is DATABASE_URL configured and the schema pushed?");
      setApps(await a.json());
      setTemplates(await t.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const addApp = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/target-apps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, name, runtime: "nodepod" }),
    });
    if (res.ok) {
      toast.success("Target app created");
      setSlug("");
      setName("");
      load();
    } else {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Failed to create target app");
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this template, its saved credentials and sessions?")) return;
    const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Template deleted");
      load();
    } else toast.error("Delete failed");
  };

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">SDK Test Bench</h1>
          <p className="text-sm text-muted-foreground">Templates run entirely in your browser via WebContainers.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/runner/demo" className={cn(buttonVariants({ variant: "outline" }))}>Demo runner</Link>
          <Link href="/dashboard/templates/new" className={cn(buttonVariants())}>New template</Link>
        </div>
      </header>

      {error && <p className="rounded-md border border-destructive/50 p-3 text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Target apps</CardTitle>
          <CardDescription>The kinds of sample app a template can belong to.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
        <form onSubmit={addApp} className="flex gap-2">
          <Input placeholder="slug (angular-spa)" value={slug} onChange={(e) => setSlug(e.target.value)} required pattern="[a-z0-9-]+" />
          <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <Button type="submit">Add</Button>
        </form>
        <div className="flex flex-wrap gap-2">
          {apps.map((a) => (
            <Badge key={a.id} variant="secondary">{a.name} · {a._count.templates} templates</Badge>
          ))}
          {!loading && apps.length === 0 && <span className="text-sm text-muted-foreground">None yet.</span>}
        </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Templates</CardTitle></CardHeader>
        <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Target app</TableHead>
              <TableHead>SDK</TableHead>
              <TableHead>Auth flow</TableHead>
              <TableHead>IdP</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((t) => (
              <TableRow key={t.id}>
                <TableCell>{t.targetApp.name}</TableCell>
                <TableCell className="font-mono text-xs">{t.sdkVersion}</TableCell>
                <TableCell>{t.authFlow}</TableCell>
                <TableCell>{t.identityProvider}</TableCell>
                <TableCell className="space-x-2 text-right">
                  <Link href={`/runner/${t.id}`} className={cn(buttonVariants({ size: "sm" }))}>Run</Link>
                  <Link href={`/dashboard/templates/${t.id}`} className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>Edit</Link>
                  <Button size="sm" variant="ghost" onClick={() => remove(t.id)}>Delete</Button>
                </TableCell>
              </TableRow>
            ))}
            {!loading && templates.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No templates yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
        </CardContent>
      </Card>
    </main>
  );
}
