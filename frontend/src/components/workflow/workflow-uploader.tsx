"use client";

import { useCallback, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, FileJson, AlertCircle } from "lucide-react";

interface WorkflowUploaderProps {
  onUpload: (json: Record<string, unknown>, filename: string) => void;
}

export function WorkflowUploader({ onUpload }: WorkflowUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { setNodeRef, isOver } = useDroppable({
    id: "workflow-drop-zone",
  });

  const parseJsonFile = useCallback(
    (file: File) => {
      setError(null);
      if (!file.name.endsWith(".json")) {
        setError("请上传 JSON 格式的工作流文件");
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target?.result as string);

          const isComfyUIApiFormat =
            Object.values(json).some(
              (node) =>
                typeof node === "object" &&
                node !== null &&
                "class_type" in (node as Record<string, unknown>) &&
                "inputs" in (node as Record<string, unknown>)
            );

          const isComfyUIFrontendFormat =
            "nodes" in json && Array.isArray(json.nodes);

          if (!isComfyUIApiFormat && !isComfyUIFrontendFormat) {
            setError("这不是有效的 ComfyUI 工作流 JSON 文件");
            return;
          }

          onUpload(json, file.name);
        } catch {
          setError("JSON 解析失败，请检查文件格式");
        }
      };
      reader.readAsText(file);
    },
    [onUpload]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) {
        parseJsonFile(file);
      }
    },
    [parseJsonFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        parseJsonFile(file);
      }
    },
    [parseJsonFile]
  );

  return (
    <div
      ref={setNodeRef}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`relative border-2 border-dashed rounded-xl transition-all duration-200 ${
        isDragOver || isOver
          ? "border-primary bg-primary/5 scale-[1.02]"
          : "border-muted-foreground/25 hover:border-muted-foreground/50"
      }`}
    >
      <Card className="border-0 shadow-none">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div
            className={`rounded-full p-4 mb-4 transition-colors ${
              isDragOver || isOver ? "bg-primary/10" : "bg-muted"
            }`}
          >
            {isDragOver || isOver ? (
              <FileJson className="h-10 w-10 text-primary" />
            ) : (
              <Upload className="h-10 w-10 text-muted-foreground" />
            )}
          </div>
          <h3 className="text-lg font-medium mb-2">
            {isDragOver || isOver ? "释放以上传工作流" : "拖拽 ComfyUI 工作流 JSON 文件到此处"}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            支持 ComfyUI 导出的工作流 JSON 文件（API Format 或前端格式均可）
          </p>
          <label className="cursor-pointer">
            <span className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
              <Upload className="h-4 w-4" />
              选择文件
            </span>
            <input
              type="file"
              accept=".json"
              onChange={handleFileInput}
              className="hidden"
            />
          </label>
          {error && (
            <div className="mt-4 flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
