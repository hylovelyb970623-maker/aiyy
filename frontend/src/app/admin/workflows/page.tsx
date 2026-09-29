"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type { WorkflowTemplate, PaginatedResponse } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { CheckCircle, XCircle, PlusCircle, Coins, Pencil, Check, X, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

const ADMIN = true;

interface AdminWorkflow extends WorkflowTemplate {
  credits_per_run?: number;
  creator_name?: string;
}

export default function AdminWorkflowsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: workflows, refetch } = useQuery({
    queryKey: ["admin-workflows"],
    queryFn: () =>
      apiClient.get<PaginatedResponse<AdminWorkflow>>("/admin/workflows", {
        page: 1,
        page_size: 50,
      }, ADMIN),
  });

  const handleApprove = async (id: string, approved: boolean) => {
    try {
      await apiClient.put(`/admin/workflows/${id}/status`, {
        status: approved ? "approved" : "rejected",
      }, ADMIN);
      toast.success(approved ? "已上架" : "已拒绝");
      refetch();
    } catch {
      toast.error("操作失败");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">工作流管理</h1>
          <p className="text-muted-foreground">审核和管理用户提交的工作流</p>
        </div>
        <Button onClick={() => router.push("/admin/workflows/create")}>
          <PlusCircle className="mr-2 h-4 w-4" />
          创建工作流
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">名称</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">创建者</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">状态</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">运行次数</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">参数数</th>
                <th className="text-center p-3 text-sm font-medium text-muted-foreground">
                  <span className="flex items-center gap-1 justify-center">
                    <Coins className="h-3 w-3" />
                    每次消耗积分
                  </span>
                </th>
                <th className="text-right p-3 text-sm font-medium text-muted-foreground">操作</th>
              </tr>
            </thead>
            <tbody>
              {workflows?.items?.map((wf) => (
                <WorkflowRow
                  key={wf.id}
                  wf={wf}
                  onApprove={handleApprove}
                  onRefresh={() => refetch()}
                />
              ))}
              {(!workflows?.items || workflows.items.length === 0) && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    暂无工作流
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function WorkflowRow({
  wf,
  onApprove,
  onRefresh,
}: {
  wf: AdminWorkflow;
  onApprove: (id: string, approved: boolean) => Promise<void>;
  onRefresh: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(wf.credits_per_run ?? 1));

  const pricingMutation = useMutation({
    mutationFn: (credits: number) =>
      apiClient.put(`/admin/workflows/${wf.id}/pricing`, {
        credits_per_run: credits,
      }, true),
    onSuccess: () => {
      toast.success("积分定价已更新");
      setEditing(false);
      onRefresh();
    },
    onError: () => toast.error("更新失败"),
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      apiClient.delete(`/admin/workflows/${wf.id}`, true),
    onSuccess: () => {
      toast.success("已删除");
      onRefresh();
    },
    onError: () => toast.error("删除失败"),
  });

  const handleSave = () => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 0) {
      toast.error("请输入有效的非负整数");
      return;
    }
    pricingMutation.mutate(num);
  };

  const handleCancel = () => {
    setEditing(false);
    setValue(String(wf.credits_per_run ?? 1));
  };

  return (
    <tr className="border-b last:border-0">
      <td className="p-3">
        <div>
          <div className="text-sm font-medium">{wf.name}</div>
          {wf.description && (
            <div className="text-xs text-muted-foreground mt-0.5">{wf.description}</div>
          )}
        </div>
      </td>
      <td className="p-3">
        <span className="text-sm text-muted-foreground">{wf.creator_name || "-"}</span>
      </td>
      <td className="p-3">
        <Badge
          variant={
            wf.status === "approved"
              ? "default"
              : wf.status === "rejected"
              ? "destructive"
              : "secondary"
          }
        >
          {wf.status === "draft" && "草稿"}
          {wf.status === "pending" && "待审核"}
          {wf.status === "approved" && "已上架"}
          {wf.status === "rejected" && "已拒绝"}
        </Badge>
      </td>
      <td className="p-3 text-sm">{wf.run_count}</td>
      <td className="p-3 text-sm">{wf.form_schema?.length || 0}</td>
      <td className="p-3">
        <div className="flex items-center justify-center">
          {editing ? (
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min="0"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-16 h-7 text-center text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                  if (e.key === "Escape") handleCancel();
                }}
                autoFocus
              />
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleSave}>
                <Check className="h-3 w-3 text-green-600" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCancel}>
                <X className="h-3 w-3 text-red-500" />
              </Button>
            </div>
          ) : (
            <button
              className="flex items-center gap-1 px-2 py-1 rounded hover:bg-muted transition-colors text-sm cursor-pointer"
              onClick={() => {
                setValue(String(wf.credits_per_run ?? 1));
                setEditing(true);
              }}
            >
              <Coins className="h-3 w-3 text-amber-500" />
              <span className="font-medium">{wf.credits_per_run ?? 1}</span>
              <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
            </button>
          )}
        </div>
      </td>
      <td className="p-3 text-right">
        <div className="flex items-center justify-end gap-1">
          {wf.status === "pending" && (
            <>
              <Button variant="ghost" size="sm" onClick={() => onApprove(wf.id, true)}>
                <CheckCircle className="h-3 w-3 mr-1" />通过
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onApprove(wf.id, false)}>
                <XCircle className="h-3 w-3 mr-1" />拒绝
              </Button>
            </>
          )}
          {wf.status === "approved" && (
            <Button variant="ghost" size="sm" onClick={() => onApprove(wf.id, false)}>
              <XCircle className="h-3 w-3 mr-1" />下架
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => {
              if (confirm(`确定要删除「${wf.name}」吗？此操作不可恢复。`)) {
                deleteMutation.mutate();
              }
            }}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="h-3 w-3 mr-1" />删除
          </Button>
        </div>
      </td>
    </tr>
  );
}
