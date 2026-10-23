import { Suspense } from "react";
import Runner from "./Runner";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading runner…</div>}>
      <Runner />
    </Suspense>
  );
}
