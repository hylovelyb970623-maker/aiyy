"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type { WorkflowRun, PaginatedResponse } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  History,
  Download,
  Image as ImageIcon,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  ZoomIn,
  X,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  FileText,
  Coins,
} from "lucide-react";

export default function HistoryPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const { data: runs, refetch } = useQuery({
    queryKey: ["runs"],
    queryFn: () =>
      apiClient.get<PaginatedResponse<WorkflowRun>>("/runs", {
        page: 1,
        page_size: 50,
      }),
  });

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      toast.error("下载失败");
    }
  };

  const handleDownloadAll = async (images: { url: string; filename: string }[]) => {
    for (const img of images) {
      await handleDownload(img.url, img.filename);
    }
  };

  const statusIcon = (status: WorkflowRun["status"]) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      case "running":
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case "success":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-destructive" />;
    }
  };

  const statusLabel = (status: WorkflowRun["status"]) => {
    switch (status) {
      case "pending":
        return "等待中";
      case "running":
        return "运行中";
      case "success":
        return "成功";
      case "failed":
        return "失败";
    }
  };

  const statusVariant = (status: WorkflowRun["status"]) => {
    if (status === "success") return "default" as const;
    if (status === "failed") return "destructive" as const;
    return "secondary" as const;
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">运行历史</h1>
            <p className="text-muted-foreground">查看所有工作流的运行记录</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            刷新
          </Button>
        </div>

        <div className="space-y-3">
          {runs?.items?.map((run) => {
            const isExpanded = expandedId === run.id;
            const hasImages = run.result_data?.images && run.result_data.images.length > 0;
            const hasError = run.error_message;

            return (
              <Card
                key={run.id}
                className={
                  run.status === "success"
                    ? "border-green-100 dark:border-green-900"
                    : run.status === "failed"
                    ? "border-red-100 dark:border-red-900"
                    : ""
                }
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      {statusIcon(run.status)}
                      {run.template_name || `运行 #${run.id.slice(0, 8)}`}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {run.credits_consumed > 0 && (
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Coins className="h-3 w-3" />
                          -{run.credits_consumed}
                        </Badge>
                      )}
                      <Badge variant={statusVariant(run.status)}>
                        {statusLabel(run.status)}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      {run.created_at &&
                        new Date(run.created_at).toLocaleString("zh-CN")}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : run.id)
                      }
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                      {isExpanded ? "收起" : "详情"}
                    </Button>
                  </div>

                  {hasImages && !isExpanded && (
                    <div className="flex items-center gap-2 mt-3">
                      {run.result_data!.images!.slice(0, 4).map((img, i) => (
                        <div
                          key={i}
                          className="relative group h-14 w-14 rounded-md overflow-hidden border cursor-zoom-in"
                          onClick={() => setPreviewImage(img.url)}
                        >
                          <img
                            src={img.url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                        </div>
                      ))}
                      {run.result_data!.images!.length > 4 && (
                        <span className="text-xs text-muted-foreground">
                          +{run.result_data!.images!.length - 4} 张
                        </span>
                      )}
                    </div>
                  )}

                  {hasError && !isExpanded && (
                    <div className="flex items-center gap-1 text-sm text-destructive mt-2">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      <span className="truncate">{run.error_message}</span>
                    </div>
                  )}

                  {isExpanded && (
                    <div className="mt-3 space-y-4">
                      <Separator />

                      {hasImages && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <ImageIcon className="h-4 w-4" />
                              <span className="text-sm font-medium">
                                生成结果
                              </span>
                              <Badge variant="secondary" className="text-xs">
                                {run.result_data!.images!.length} 张
                              </Badge>
                            </div>
                            {run.result_data!.images!.length > 1 && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  handleDownloadAll(
                                    run.result_data!.images!
                                  )
                                }
                              >
                                <Download className="h-3.5 w-3.5 mr-1" />
                                全部下载
                              </Button>
                            )}
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {run.result_data!.images!.map((img, i) => (
                              <div
                                key={i}
                                className="relative group rounded-lg overflow-hidden border bg-muted"
                              >
                                <img
                                  src={img.url}
                                  alt={`结果 ${i + 1}`}
                                  className="w-full aspect-square object-cover cursor-zoom-in hover:opacity-90 transition-opacity"
                                  onClick={() => setPreviewImage(img.url)}
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors pointer-events-none" />
                                <div className="absolute bottom-0 left-0 right-0 p-1.5 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-black/60 to-transparent">
                                  <span className="text-[10px] text-white truncate max-w-[60%]">
                                    {img.filename}
                                  </span>
                                  <div className="flex gap-1">
                                    <Button
                                      size="icon"
                                      variant="secondary"
                                      className="h-6 w-6"
                                      onClick={() =>
                                        setPreviewImage(img.url)
                                      }
                                    >
                                      <ZoomIn className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="secondary"
                                      className="h-6 w-6"
                                      onClick={() =>
                                        handleDownload(img.url, img.filename)
                                      }
                                    >
                                      <Download className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {hasError && (
                        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900">
                          <div className="flex items-start gap-2">
                            <XCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                                错误信息
                              </p>
                              <p className="text-sm text-red-600 dark:text-red-400 mt-1 break-all">
                                {run.error_message}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {run.result_data?.outputs &&
                        Object.keys(run.result_data.outputs).length > 0 &&
                        !hasImages && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              <span className="text-sm font-medium">
                                输出数据
                              </span>
                            </div>
                            <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-40">
                              {JSON.stringify(
                                run.result_data.outputs,
                                null,
                                2
                              )}
                            </pre>
                          </div>
                        )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {(!runs?.items || runs.items.length === 0) && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <History className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">暂无运行记录</h3>
              <p className="text-muted-foreground">
                运行工作流后，记录将显示在这里
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <img
              src={previewImage}
              alt="预览"
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <Button
              size="icon"
              variant="secondary"
              className="absolute top-2 right-2"
              onClick={() => setPreviewImage(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
