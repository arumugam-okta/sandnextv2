"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Option {
  value: string;
  label: string;
}

interface Props {
  value: string;
  onValueChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  id?: string;
  className?: string;
  "aria-label"?: string;
}

/** Thin wrapper over the shadcn Select for flat option lists */
export function SimpleSelect({ value, onValueChange, options, placeholder, id, className, ...rest }: Props) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onValueChange(v ?? "")}
      items={options}
    >
      <SelectTrigger id={id} className={className ?? "w-full"} aria-label={rest["aria-label"]}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
