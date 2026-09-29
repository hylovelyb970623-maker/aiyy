"use client";

import { useWorkflowRunStore } from "@/stores/workflow-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Cpu,
  Send,
} from "lucide-react";

interface RunProgressProps {
  compact?: boolean;
}

export function RunProgress({ compact = false }: RunProgressProps) {
  const { status, progress, currentNode, errorMessage } = useWorkflowRunStore();

  if (status === "idle") return null;

  const progressPercent =
    progress && progress.max > 0
      ? Math.round((progress.value / progress.max) * 100)
      : 0;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {status === "running" && (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm">
              {currentNode ? `执行中: ${currentNode}` : "运行中..."}
              {progress && ` (${progressPercent}%)`}
            </span>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-sm text-green-600">执行完成</span>
          </>
        )}
        {status === "failed" && (
          <>
            <XCircle className="h-4 w-4 text-destructive" />
            <span className="text-sm text-destructive">执行失败</span>
          </>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {status === "pending" && (
              <>
                <Clock className="h-4 w-4" />
                等待执行
              </>
            )}
            {status === "running" && !currentNode && !progress && (
              <>
                <Send className="h-4 w-4 animate-pulse" />
                提交中
              </>
            )}
            {status === "running" && (currentNode || progress) && (
              <>
                <Cpu className="h-4 w-4 animate-pulse" />
                执行中
              </>
            )}
            {status === "success" && (
              <>
                <CheckCircle className="h-4 w-4 text-green-500" />
                执行完成
              </>
            )}
            {status === "failed" && (
              <>
                <XCircle className="h-4 w-4 text-destructive" />
                执行失败
              </>
            )}
          </CardTitle>
          <Badge
            variant={
              status === "success"
                ? "default"
                : status === "failed"
                ? "destructive"
                : "secondary"
            }
          >
            {status === "pending" && "等待中"}
            {status === "running" && !currentNode && !progress && "提交中"}
            {status === "running" && (currentNode || progress) && "运行中"}
            {status === "success" && "成功"}
            {status === "failed" && "失败"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {status === "running" && progress && (
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>进度</span>
              <span className="text-muted-foreground">
                {progress.value}/{progress.max} ({progressPercent}%)
              </span>
            </div>
            <Progress value={progressPercent} />
          </div>
        )}
        {status === "running" && currentNode && (
          <div className="flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">
              正在执行: {currentNode === "processing" ? "处理中..." : currentNode}
            </span>
          </div>
        )}
        {status === "running" && !currentNode && !progress && (
          <div className="flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">
              正在提交到 ComfyUI...
            </span>
          </div>
        )}
        {status === "failed" && errorMessage && (
          <p className="text-sm text-destructive">{errorMessage}</p>
        )}
      </CardContent>
    </Card>
  );
}
