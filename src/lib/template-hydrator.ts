import type { FileSystemTree } from "@webcontainer/api";

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function hydrateVirtualFileSystem(
  fileSystemTree: FileSystemTree,
  configValues: Record<string, unknown>
): FileSystemTree {
  const clonedTree: FileSystemTree = JSON.parse(JSON.stringify(fileSystemTree));

  function processNode(node: FileSystemTree) {
    for (const key in node) {
      const item = node[key];
      if ("directory" in item) {
        processNode(item.directory);
      } else if ("file" in item && "contents" in item.file && typeof item.file.contents === "string") {
        let content = item.file.contents;
        for (const [confKey, confValue] of Object.entries(configValues)) {
          const placeholder = new RegExp(`{{${escapeRegExp(confKey)}}}`, "g");
          // function replacer avoids "$&" style patterns in user values
          content = content.replace(placeholder, () => String(confValue ?? ""));
        }
        item.file.contents = content;
      }
    }
  }

  processNode(clonedTree);
  return clonedTree;
}
