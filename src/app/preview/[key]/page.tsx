import { Suspense } from "react";
import Preview from "./Preview";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading preview…</div>}>
      <Preview />
    </Suspense>
  );
}
