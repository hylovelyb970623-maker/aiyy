"use client";

import { useAuthStore } from "@/stores/auth-store";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, ArrowRight, LayoutGrid, Coins } from "lucide-react";
import { apiClient } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import type { WorkflowTemplate, PaginatedResponse } from "@/types";

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  const { data: myWorkflows, isLoading } = useQuery({
    queryKey: ["available-workflows"],
    queryFn: () =>
      apiClient.get<PaginatedResponse<WorkflowTemplate>>("/workflows/available", {
        page: 1,
        page_size: 50,
      }),
    enabled: isAuthenticated,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">我的应用</h1>
        <p className="text-muted-foreground mt-1">
          以下是管理员分配给您可使用的 AI 应用
        </p>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-3">
                <div className="h-5 bg-muted rounded w-2/3" />
                <div className="h-4 bg-muted rounded w-full mt-2" />
              </CardHeader>
              <CardContent>
                <div className="h-4 bg-muted rounded w-1/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && myWorkflows?.items && myWorkflows.items.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {myWorkflows.items.map((workflow) => (
            <Card
              key={workflow.id}
              className="cursor-pointer hover:shadow-md transition-all hover:border-primary/50 group"
              onClick={() => router.push(`/workshop/${workflow.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base group-hover:text-primary transition-colors">
                    {workflow.name}
                  </CardTitle>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Zap className="h-3 w-3" />
                    {workflow.run_count} 次运行
                  </div>
                </div>
                {workflow.description && (
                  <CardDescription className="line-clamp-2">
                    {workflow.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {workflow.form_schema?.filter((f) => f.visible !== false).length || 0} 个参数
                    </span>
                    <span className="flex items-center gap-0.5 text-xs text-amber-600">
                      <Coins className="h-3 w-3" />
                      {workflow.credits_per_run ?? 1}/次
                    </span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && (!myWorkflows?.items || myWorkflows.items.length === 0) && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <LayoutGrid className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">暂无可用应用</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              管理员尚未为您分配任何应用。请联系管理员获取使用权限。
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
