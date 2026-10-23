import type { SandpackTemplate } from "@codesandbox/sandpack-client";
import type { FlatFiles } from "@/lib/file-tree";

export interface PreviewPayload {
  files: FlatFiles;
  template: SandpackTemplate;
}

const keyFor = (key: string) => `preview:${key}`;

/**
 * Hand the current sandbox to a new tab. window.open() (without `noopener`) copies sessionStorage
 * into the new tab, so the files, which include the entered credentials, never touch
 * persistent storage and disappear when the tab closes.
 */
export function openPreviewTab(payload: PreviewPayload): boolean {
  const key = crypto.randomUUID();
  sessionStorage.setItem(keyFor(key), JSON.stringify(payload));
  const tab = window.open(`/preview/${key}`, "_blank");
  if (!tab) sessionStorage.removeItem(keyFor(key));
  return !!tab;
}

export function readPreviewPayload(key: string): PreviewPayload | null {
  const raw = sessionStorage.getItem(keyFor(key));
  return raw ? (JSON.parse(raw) as PreviewPayload) : null;
}
