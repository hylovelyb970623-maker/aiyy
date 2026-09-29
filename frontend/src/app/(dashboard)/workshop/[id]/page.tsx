"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useCreditStore } from "@/stores/credit-store";
import { useWorkflowRunStore } from "@/stores/workflow-store";
import type { WorkflowTemplate, WorkflowRun, SSEEvent, CreditAccount } from "@/types";
import { WorkflowVisualizer } from "@/components/workflow/workflow-visualizer";
import { WorkflowForm } from "@/components/workflow/workflow-form";
import { RunProgress } from "@/components/workflow/run-progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Play,
  ArrowLeft,
  Coins,
  Download,
  Image as ImageIcon,
  CheckCircle2,
  XCircle,
  ZoomIn,
  X,
  RotateCcw,
  FileText,
  Wifi,
  WifiOff,
  RefreshCw,
  Cpu,
} from "lucide-react";

export default function WorkflowDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { balance, loadFromAccount } = useCreditStore();
  const { startRun, setProgress, setExecutingNode, setSuccess, setFailed, reset, status, resultData, errorMessage } = useWorkflowRunStore();

  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [formInitialized, setFormInitialized] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const isRunningRef = useRef(false);

  const { data: workflow } = useQuery({
    queryKey: ["workflow", id],
    queryFn: () => apiClient.get<WorkflowTemplate>(`/workflows/${id}`),
  });

  const { data: comfyuiStatus, refetch: refetchComfyUI } = useQuery({
    queryKey: ["comfyui-status"],
    queryFn: () => apiClient.get<{ connected: boolean; data?: { system?: Record<string, unknown>; devices?: Array<Record<string, unknown>> }; error?: string }>("/workflows/comfyui/status"),
    refetchInterval: 15000,
  });

  useEffect(() => {
    if (workflow?.form_schema && !formInitialized) {
      const defaults: Record<string, unknown> = {};
      workflow.form_schema.forEach((field) => {
        if (field.visible !== false) {
          defaults[`${field.node_id}.${field.field}`] = field.default;
        }
      });
      setFormValues(defaults);
      setFormInitialized(true);
    }
  }, [workflow?.form_schema, formInitialized]);

  useEffect(() => {
    return () => {
      reset();
      isRunningRef.current = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [reset]);

  const handleRun = useCallback(async () => {
    if (!workflow) return;

    try {
      const visibleKeys = new Set(
        workflow.form_schema
          .filter((f) => f.visible !== false)
          .map((f) => `${f.node_id}.${f.field}`)
      );

      const numericTypes = new Set(["slider", "seed", "number"]);
      const numericFields = new Set(
        workflow.form_schema
          .filter((f) => numericTypes.has(f.type))
          .map((f) => `${f.node_id}.${f.field}`)
      );

      const submitData: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(formValues)) {
        if (visibleKeys.has(key)) {
          if (numericFields.has(key) && typeof value === "string") {
            const num = Number(value);
            submitData[key] = isNaN(num) ? value : num;
          } else {
            submitData[key] = value;
          }
        }
      }

      const run = await apiClient.post<WorkflowRun>(`/workflows/${id}/run`, {
        input_data: submitData,
      });

      startRun(run.id);
      isRunningRef.current = true;
      toast.success("工作流已提交执行");

      const token = localStorage.getItem("access_token") || undefined;
      if (!token) {
        setFailed("未找到认证令牌，请重新登录");
        return;
      }
      const streamUrl = apiClient.getStreamUrl(`/runs/${run.id}/stream`, token);

      const es = new EventSource(streamUrl);
      eventSourceRef.current = es;

      let connected = false;

      es.addEventListener("open", () => {
        connected = true;
      });

      es.addEventListener("message", (e) => {
        connected = true;
        const event: SSEEvent = JSON.parse(e.data);
        switch (event.type) {
          case "connected":
            break;
          case "progress":
            const progressData = event.data as { value: number; max: number };
            setProgress(progressData.value, progressData.max);
            break;
          case "executing":
            const execData = event.data as { node: string | null };
            setExecutingNode(execData.node);
            break;
          case "execution_success":
            isRunningRef.current = false;
            setSuccess(event.data as Record<string, unknown>);
            apiClient.get<CreditAccount>("/credits/balance").then((account) => {
              loadFromAccount(account);
            }).catch(() => {});
            es.close();
            eventSourceRef.current = null;
            break;
          case "execution_error":
            isRunningRef.current = false;
            setFailed((event.data as { message: string }).message || "执行失败");
            es.close();
            eventSourceRef.current = null;
            break;
          case "waiting":
            isRunningRef.current = false;
            setFailed("工作流正在等待执行，请稍后查看运行历史");
            es.close();
            eventSourceRef.current = null;
            break;
        }
      });

      es.addEventListener("error", () => {
        if (isRunningRef.current) {
          isRunningRef.current = false;
          if (!connected) {
            setFailed("无法连接到执行状态服务，请检查网络连接");
          } else {
            setFailed("连接中断，请查看运行历史获取结果");
          }
        }
        es.close();
        eventSourceRef.current = null;
      });
    } catch (err: unknown) {
      isRunningRef.current = false;
      const message = err instanceof Error ? err.message : "执行失败";
      setFailed(message);
      toast.error(message);
    }
  }, [workflow, id, formValues, startRun, setProgress, setExecutingNode, setSuccess, setFailed, loadFromAccount]);

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

  const handleDownloadAll = async () => {
    if (!runResult?.images) return;
    for (const img of runResult.images) {
      await handleDownload(img.url, img.filename);
    }
  };

  if (!workflow) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  const runResult = resultData as WorkflowRun["result_data"];
  const hasImages = runResult?.images && runResult.images.length > 0;
  const hasOutputs = runResult?.outputs && Object.keys(runResult.outputs).length > 0;

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{workflow.name}</h1>
              {workflow.description && (
                <p className="text-muted-foreground">{workflow.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ComfyUIStatusBadge
              connected={comfyuiStatus?.connected ?? false}
              data={comfyuiStatus?.data}
              error={comfyuiStatus?.error}
              onRefresh={() => refetchComfyUI()}
            />
            <Badge variant="secondary" className="flex items-center gap-1">
              <Coins className="h-3 w-3" />
              {balance} 积分
            </Badge>
            <Button
              onClick={handleRun}
              disabled={status === "running" || !comfyuiStatus?.connected}
              size="lg"
            >
              {status === "running" ? (
                <>
                  <RotateCcw className="mr-2 h-4 w-4 animate-spin" />
                  执行中...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  运行
                  <span className="ml-1 text-xs opacity-70">
                    (-{workflow?.credits_per_run ?? 1}积分)
                  </span>
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Tabs defaultValue="form">
              <TabsList>
                <TabsTrigger value="form">参数配置</TabsTrigger>
                <TabsTrigger value="visual">工作流可视化</TabsTrigger>
              </TabsList>
              <TabsContent value="form" className="mt-4">
                <WorkflowForm
                  formSchema={workflow.form_schema}
                  values={formValues}
                  onChange={setFormValues}
                />
              </TabsContent>
              <TabsContent value="visual" className="mt-4">
                <WorkflowVisualizer workflowJson={workflow.workflow_json} />
              </TabsContent>
            </Tabs>
          </div>

          <div className="space-y-4">
            <RunStatusCard
              status={status}
              errorMessage={errorMessage}
              onRetry={() => handleRun()}
            />

            {status === "success" && hasImages && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <ImageIcon className="h-4 w-4" />
                      生成结果
                      <Badge variant="secondary" className="ml-1">
                        {runResult.images!.length} 张
                      </Badge>
                    </CardTitle>
                    {runResult.images!.length > 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDownloadAll}
                      >
                        <Download className="h-3.5 w-3.5 mr-1" />
                        全部下载
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-3">
                    {runResult.images!.map((img, i) => (
                      <div
                        key={i}
                        className="relative group rounded-lg overflow-hidden border bg-muted"
                      >
                        <img
                          src={img.url}
                          alt={`结果 ${i + 1}`}
                          className="w-full cursor-zoom-in hover:opacity-90 transition-opacity"
                          onClick={() => setPreviewImage(img.url)}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors pointer-events-none" />
                        <div className="absolute bottom-0 left-0 right-0 p-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-black/60 to-transparent">
                          <span className="text-xs text-white truncate">
                            {img.filename}
                          </span>
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="secondary"
                              className="h-7 w-7"
                              onClick={() => setPreviewImage(img.url)}
                            >
                              <ZoomIn className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="secondary"
                              className="h-7 w-7"
                              onClick={() => handleDownload(img.url, img.filename)}
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {status === "success" && !hasImages && hasOutputs && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    输出结果
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-60">
                    {JSON.stringify(runResult.outputs, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
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

function RunStatusCard({
  status,
  errorMessage,
  onRetry,
}: {
  status: string;
  errorMessage: string | null;
  onRetry: () => void;
}) {
  if (status === "idle") return null;

  if (status === "success") {
    return (
      <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-green-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-green-800 dark:text-green-200">
                执行成功
              </p>
              <p className="text-sm text-green-600 dark:text-green-400">
                工作流已成功完成，结果已生成
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (status === "failed") {
    return (
      <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="flex items-center gap-3">
            <XCircle className="h-8 w-8 text-red-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-red-800 dark:text-red-200">
                执行失败
              </p>
              {errorMessage && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-1 break-all">
                  {errorMessage}
                </p>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="w-full border-red-300 text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            重新运行
          </Button>
        </CardContent>
      </Card>
    );
  }

  return <RunProgress />;
}

function ComfyUIStatusBadge({
  connected,
  data,
  error,
  onRefresh,
}: {
  connected: boolean;
  data?: { system?: Record<string, unknown>; devices?: Array<Record<string, unknown>> };
  error?: string;
  onRefresh: () => void;
}) {
  const [showDetail, setShowDetail] = useState(false);

  const gpuInfo = data?.devices?.find((d) => d.type === "CUDA" || d.name?.toString().includes("NVIDIA") || d.name?.toString().includes("cuda"));
  const gpuName = gpuInfo?.name as string | undefined;
  const vramTotal = gpuInfo?.vram_total as number | undefined;
  const vramUsed = gpuInfo?.vram_used as number | undefined;

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setShowDetail(!showDetail)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
            connected
              ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300 dark:hover:bg-green-800"
              : "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-800"
          }`}
        >
          {connected ? (
            <Wifi className="h-3 w-3" />
          ) : (
            <WifiOff className="h-3 w-3" />
          )}
          ComfyUI {connected ? "已连接" : "未连接"}
          {connected && gpuName && (
            <span className="hidden sm:inline text-[10px] opacity-70">
              ({gpuName})
            </span>
          )}
        </button>
        <button
          onClick={() => { onRefresh(); }}
          className="p-1 rounded hover:bg-muted transition-colors"
          title="刷新连接状态"
        >
          <RefreshCw className="h-3 w-3 text-muted-foreground" />
        </button>
      </div>

      {showDetail && (
        <div className="absolute top-full right-0 mt-2 w-72 z-50">
          <Card className="shadow-lg">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Cpu className="h-4 w-4" />
                  ComfyUI 状态
                </CardTitle>
                <button
                  onClick={() => setShowDetail(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`} />
                <span className="text-sm">
                  {connected ? "服务正常运行中" : "无法连接到 ComfyUI"}
                </span>
              </div>

              {connected && data?.devices && data.devices.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {data.devices.map((device, i) => (
                    <div key={i} className="text-xs space-y-1 bg-muted p-2 rounded">
                      <div className="font-medium">{device.name as string || `设备 ${i + 1}`}</div>
                      {device.vram_total != null && (
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>显存</span>
                          <span>
                            {device.vram_used != null
                              ? `${(Number(device.vram_used) / 1024 / 1024 / 1024).toFixed(1)}GB / ${(Number(device.vram_total) / 1024 / 1024 / 1024).toFixed(1)}GB`
                              : `${(Number(device.vram_total) / 1024 / 1024 / 1024).toFixed(1)}GB`}
                          </span>
                        </div>
                      )}
                      {device.vram_total != null && (
                        <div className="w-full bg-muted-foreground/20 rounded-full h-1.5">
                          <div
                            className="bg-primary h-1.5 rounded-full transition-all"
                            style={{
                              width: `${device.vram_used != null ? (Number(device.vram_used) / Number(device.vram_total)) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {!connected && error && (
                <p className="text-xs text-destructive break-all">{error}</p>
              )}

              {!connected && (
                <p className="text-xs text-muted-foreground">
                  请确保 ComfyUI 已启动并运行在本地 8188 端口
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
