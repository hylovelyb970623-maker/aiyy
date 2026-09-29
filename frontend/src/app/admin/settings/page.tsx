"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Settings, Wifi, WifiOff, Server, Save, RefreshCw } from "lucide-react";

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();

  const { data: config, refetch: refetchConfig } = useQuery({
    queryKey: ["admin-config", "comfyui_url"],
    queryFn: () =>
      apiClient.get<{ key: string; value: string | null }>(
        "/admin/config/comfyui_url",
        undefined,
        true
      ),
  });

  const { data: comfyuiStatus, refetch: refetchStatus } = useQuery({
    queryKey: ["admin-comfyui-status"],
    queryFn: () =>
      apiClient.get<{ status: string; data?: Record<string, unknown>; error?: string }>(
        "/admin/comfyui/status",
        undefined,
        true
      ),
    refetchInterval: 15000,
  });

  const [url, setUrl] = useState(config?.value || "");

  const saveMutation = useMutation({
    mutationFn: (value: string) =>
      apiClient.put("/admin/config/comfyui_url", { value }, true),
    onSuccess: () => {
      toast.success("ComfyUI 地址已保存并生效");
      refetchConfig();
      refetchStatus();
    },
    onError: () => toast.error("保存失败"),
  });

  const handleSave = () => {
    const trimmed = url.trim();
    if (trimmed && !trimmed.match(/^https?:\/\/.+/)) {
      toast.error("请输入有效的 HTTP/HTTPS 地址，例如 http://192.168.1.100:8188");
      return;
    }
    saveMutation.mutate(trimmed);
  };

  const connected = comfyuiStatus?.status === "online";
  const defaultUrl = "http://127.0.0.1:8188";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6" />
          系统设置
        </h1>
        <p className="text-muted-foreground mt-1">配置系统运行参数</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            ComfyUI 服务地址
          </CardTitle>
          <CardDescription>
            配置 ComfyUI 服务的访问地址。留空则使用默认地址。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50">
            <div className={`h-3 w-3 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">
                  {connected ? "ComfyUI 已连接" : "ComfyUI 未连接"}
                </span>
                <Badge variant={connected ? "default" : "destructive"}>
                  {connected ? "在线" : "离线"}
                </Badge>
              </div>
              {connected && comfyuiStatus?.data && (
                <p className="text-xs text-muted-foreground mt-1">
                  当前地址可用，服务正常运行
                </p>
              )}
              {!connected && comfyuiStatus?.error && (
                <p className="text-xs text-destructive mt-1">
                  {comfyuiStatus.error}
                </p>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => refetchStatus()}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="comfyui-url">服务地址</Label>
            <div className="flex gap-2">
              <Input
                id="comfyui-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={`默认: ${defaultUrl}`}
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                }}
              />
              <Button onClick={handleSave} disabled={saveMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                保存
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              支持 IP 地址和域名，例如：
              <code className="mx-1 px-1 py-0.5 bg-muted rounded text-xs">
                http://127.0.0.1:8188
              </code>
              <code className="mx-1 px-1 py-0.5 bg-muted rounded text-xs">
                http://192.168.1.100:8188
              </code>
              <code className="mx-1 px-1 py-0.5 bg-muted rounded text-xs">
                https://comfyui.example.com
              </code>
            </p>
          </div>

          <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
            <p>
              <strong>当前生效地址：</strong>
              <code className="ml-1 px-1 py-0.5 bg-muted rounded">
                {config?.value || defaultUrl}
              </code>
            </p>
            <p>修改后立即生效，无需重启服务</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
