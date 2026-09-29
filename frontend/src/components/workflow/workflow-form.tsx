"use client";

import type { FormField } from "@/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Shuffle, Upload } from "lucide-react";
import { useCallback, useState } from "react";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

interface WorkflowFormProps {
  formSchema: FormField[];
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
}

export function WorkflowForm({
  formSchema,
  values,
  onChange,
}: WorkflowFormProps) {
  const handleChange = useCallback(
    (nodeId: string, field: string, value: unknown) => {
      onChange({ ...values, [`${nodeId}.${field}`]: value });
    },
    [values, onChange]
  );

  const basicFields = formSchema.filter((f) => f.group !== "advanced" && f.visible !== false);
  const advancedFields = formSchema.filter((f) => f.group === "advanced" && f.visible !== false);

  const renderField = (field: FormField) => {
    const fieldKey = `${field.node_id}.${field.field}`;
    const currentValue = values[fieldKey] ?? field.default;

    switch (field.type) {
      case "textarea":
        return (
          <div key={fieldKey} className="space-y-2">
            <Label htmlFor={fieldKey}>{field.label}</Label>
            <Textarea
              id={fieldKey}
              value={String(currentValue)}
              onChange={(e) =>
                handleChange(field.node_id, field.field, e.target.value)
              }
              rows={3}
              required={field.required}
            />
          </div>
        );

      case "text":
        return (
          <div key={fieldKey} className="space-y-2">
            <Label htmlFor={fieldKey}>{field.label}</Label>
            <Input
              id={fieldKey}
              value={String(currentValue)}
              onChange={(e) =>
                handleChange(field.node_id, field.field, e.target.value)
              }
              required={field.required}
            />
          </div>
        );

      case "slider":
        return (
          <div key={fieldKey} className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{field.label}</Label>
              <span className="text-sm text-muted-foreground">
                {Number(currentValue)}
              </span>
            </div>
            <Slider
              value={[Number(currentValue)]}
              onValueChange={(value) => {
                const v = Array.isArray(value) ? value[0] : value;
                handleChange(field.node_id, field.field, v);
              }}
              min={field.min ?? 0}
              max={field.max ?? 100}
              step={field.step ?? 1}
            />
          </div>
        );

      case "select":
        return (
          <div key={fieldKey} className="space-y-2">
            <Label>{field.label}</Label>
            <Select
              value={String(currentValue)}
              onValueChange={(v) =>
                handleChange(field.node_id, field.field, v)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((opt) => (
                  <SelectItem key={String(opt)} value={String(opt)}>
                    {String(opt)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case "seed":
        return (
          <div key={fieldKey} className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor={fieldKey}>{field.label}</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  handleChange(
                    field.node_id,
                    field.field,
                    Math.floor(Math.random() * 2147483647)
                  )
                }
              >
                <Shuffle className="h-3 w-3 mr-1" />
                随机
              </Button>
            </div>
            <Input
              id={fieldKey}
              type="number"
              value={Number(currentValue)}
              onChange={(e) =>
                handleChange(
                  field.node_id,
                  field.field,
                  parseInt(e.target.value) || 0
                )
              }
            />
          </div>
        );

      case "image_upload":
        return (
          <ImageUploadField
            key={fieldKey}
            field={field}
            fieldKey={fieldKey}
            currentValue={currentValue}
            handleChange={handleChange}
          />
        );

      case "number":
        return (
          <div key={fieldKey} className="space-y-2">
            <Label htmlFor={fieldKey}>{field.label}</Label>
            <Input
              id={fieldKey}
              type="number"
              value={Number(currentValue)}
              onChange={(e) =>
                handleChange(
                  field.node_id,
                  field.field,
                  parseFloat(e.target.value) || 0
                )
              }
              min={field.min}
              max={field.max}
              step={field.step}
              required={field.required}
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {basicFields.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">基本参数</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {basicFields.map(renderField)}
          </CardContent>
        </Card>
      )}

      {advancedFields.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">高级参数</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {advancedFields.map(renderField)}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ImageUploadField({
  field,
  fieldKey,
  currentValue,
  handleChange,
}: {
  field: FormField;
  fieldKey: string;
  currentValue: unknown;
  handleChange: (nodeId: string, field: string, value: unknown) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await apiClient.upload<{
        name: string;
        subfolder: string;
        type: string;
      }>("/upload/image", formData);
      handleChange(field.node_id, field.field, result.name);
      toast.success("图片上传成功");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "图片上传失败";
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={fieldKey}>{field.label}</Label>
      <div className="flex items-center gap-3">
        <Input
          id={fieldKey}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={uploading}
          required={field.required}
          className="flex-1"
        />
        {uploading && (
          <span className="text-sm text-muted-foreground animate-pulse">
            上传中...
          </span>
        )}
      </div>
      {preview && (
        <div className="mt-2">
          <img
            src={preview}
            alt="预览"
            className="h-20 w-20 object-cover rounded border"
          />
        </div>
      )}
      {typeof currentValue === "string" && currentValue && (
        <p className="text-xs text-muted-foreground">
          当前文件: {currentValue}
        </p>
      )}
    </div>
  );
}
