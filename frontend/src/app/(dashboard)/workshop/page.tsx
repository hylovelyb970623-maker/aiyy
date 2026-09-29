"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type { WorkflowTemplate, PaginatedResponse } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { PlusCircle, Zap, ArrowRight, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function WorkshopPage() {
  const router = useRouter();

  const { data: workflows, refetch } = useQuery({
    queryKey: ["my-workflows"],
    queryFn: () =>
      apiClient.get<PaginatedResponse<WorkflowTemplate>>("/workflows", {
        page: 1,
        page_size: 50,
      }),
  });

  const handleDelete = async (id: string) => {
    try {
      await apiClient.delete(`/workflows/${id}`);
      toast.success("删除成功");
      refetch();
    } catch {
      toast.error("删除失败");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">我的工坊</h1>
          <p className="text-muted-foreground">管理你创建的 AI 应用</p>
        </div>
        <Button onClick={() => router.push("/create")}>
          <PlusCircle className="mr-2 h-4 w-4" />
          创建应用
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {workflows?.items?.map((workflow) => (
          <Card key={workflow.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{workflow.name}</CardTitle>
                <Badge
                  variant={
                    workflow.status === "approved"
                      ? "default"
                      : workflow.status === "rejected"
                      ? "destructive"
                      : "secondary"
                  }
                >
                  {workflow.status === "draft" && "草稿"}
                  {workflow.status === "pending" && "审核中"}
                  {workflow.status === "approved" && "已上架"}
                  {workflow.status === "rejected" && "已拒绝"}
                </Badge>
              </div>
              <CardDescription className="line-clamp-2">
                {workflow.description || "暂无描述"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    {workflow.run_count} 次运行
                  </span>
                  <span>{workflow.form_schema?.length || 0} 个参数</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.push(`/workshop/${workflow.id}`)}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(workflow.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {(!workflows?.items || workflows.items.length === 0) && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <PlusCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">还没有创建应用</h3>
            <p className="text-muted-foreground mb-4">
              上传 ComfyUI 工作流，创建你的第一个 AI 应用
            </p>
            <Button onClick={() => router.push("/create")}>
              <PlusCircle className="mr-2 h-4 w-4" />
              创建应用
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
