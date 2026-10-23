export type FileSystemTree = {
  [name: string]: { file: { contents: string } } | { directory: FileSystemTree };
};

export type FlatFiles = Record<string, string>;

/** FileSystemTree -> { "src/app/x.ts": "contents" } (binary/symlink entries are skipped) */
export function flattenTree(tree: FileSystemTree, prefix = ""): FlatFiles {
  const out: FlatFiles = {};
  for (const [name, node] of Object.entries(tree)) {
    const path = prefix ? `${prefix}/${name}` : name;
    if ("directory" in node) {
      Object.assign(out, flattenTree(node.directory, path));
    } else if ("file" in node && "contents" in node.file && typeof node.file.contents === "string") {
      out[path] = node.file.contents;
    }
  }
  return out;
}

/** Inverse of flattenTree */
export function buildTree(files: FlatFiles): FileSystemTree {
  const root: FileSystemTree = {};
  for (const [path, contents] of Object.entries(files)) {
    const parts = path.split("/").filter(Boolean);
    let cursor = root;
    parts.forEach((part, i) => {
      if (i === parts.length - 1) {
        cursor[part] = { file: { contents } };
      } else {
        const existing = cursor[part];
        if (!existing || !("directory" in existing)) cursor[part] = { directory: {} };
        cursor = (cursor[part] as { directory: FileSystemTree }).directory;
      }
    });
  }
  return root;
}

/** Structural check used by the API before persisting a tree */
export function isFileSystemTree(value: unknown, depth = 0): value is FileSystemTree {
  if (depth > 20 || typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return Object.entries(value).every(([name, node]) => {
    if (!name || name.includes("..") || name.includes("/")) return false;
    if (typeof node !== "object" || node === null) return false;
    const n = node as Record<string, unknown>;
    if ("directory" in n) return isFileSystemTree(n.directory, depth + 1);
    if ("file" in n) {
      const f = n.file as Record<string, unknown> | null;
      return !!f && typeof f === "object" && typeof f.contents === "string";
    }
    return false;
  });
}

export function languageFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript", mjs: "javascript",
    json: "json", html: "html", css: "css", scss: "scss", md: "markdown", yml: "yaml", yaml: "yaml",
  };
  return (ext && map[ext]) || "plaintext";
}
