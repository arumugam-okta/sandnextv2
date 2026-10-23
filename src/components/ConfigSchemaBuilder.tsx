"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SimpleSelect } from "@/components/SimpleSelect";
import type { ConfigField } from "@/components/DynamicCredentialForm";

interface Props {
  value: ConfigField[];
  onChange: (next: ConfigField[]) => void;
}

export function ConfigSchemaBuilder({ value, onChange }: Props) {
  const update = (i: number, patch: Partial<ConfigField>) =>
    onChange(value.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));

  return (
    <div className="space-y-2">
      {value.map((f, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_1fr_7rem_auto_auto] items-center gap-2">
          <Input placeholder="key (issuer)" value={f.key} onChange={(e) => update(i, { key: e.target.value })} aria-label="Field key" />
          <Input placeholder="Label" value={f.label} onChange={(e) => update(i, { label: e.target.value })} aria-label="Field label" />
          <Input placeholder="Placeholder" value={f.placeholder ?? ""} onChange={(e) => update(i, { placeholder: e.target.value })} aria-label="Field placeholder" />
          <SimpleSelect
            aria-label="Field type"
            value={f.type}
            onValueChange={(v) => update(i, { type: v as ConfigField["type"] })}
            options={[
              { value: "text", label: "text" },
              { value: "password", label: "password" },
            ]}
          />
          <Label className="flex items-center gap-1.5 text-xs">
            <Checkbox checked={!!f.required} onCheckedChange={(c) => update(i, { required: c === true })} />
            required
          </Label>
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange(value.filter((_, idx) => idx !== i))}>
            ✕
          </Button>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => onChange([...value, { key: "", label: "", type: "text", required: true }])}
      >
        + Add field
      </Button>
      <p className="text-xs text-muted-foreground">
        Reference a field in any file as <code>{"{{key}}"}</code>; it is replaced with the value entered at run time.
      </p>
    </div>
  );
}
