import { Suspense } from "react";
import TemplateEditor from "./TemplateEditor";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading…</div>}>
      <TemplateEditor />
    </Suspense>
  );
}
