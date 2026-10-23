"use client";

import { useForm } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface ConfigField {
  key: string;
  label: string;
  type: "text" | "password";
  placeholder?: string;
  required?: boolean;
}

interface Props {
  fields: ConfigField[];
  defaultValues?: Record<string, string>;
  onSubmit: (values: Record<string, string>) => void;
  isLoading?: boolean;
}

export function DynamicCredentialForm({ fields, defaultValues, onSubmit, isLoading }: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Record<string, string>>({ defaultValues });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Environment Credentials</CardTitle>
      </CardHeader>
      <CardContent>
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {fields.map((field) => (
        <div key={field.key} className="space-y-1.5">
          <Label htmlFor={field.key}>{field.label}</Label>
          <Input
            id={field.key}
            type={field.type}
            placeholder={field.placeholder}
            {...register(field.key, {
              required: field.required ? `${field.label} is required` : false,
            })}
          />
          {errors[field.key] && (
            <p className="text-sm text-destructive">{errors[field.key]?.message}</p>
          )}
        </div>
      ))}
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Starting Environment..." : "Run Test Instance"}
      </Button>
    </form>
      </CardContent>
    </Card>
  );
}
