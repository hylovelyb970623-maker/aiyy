"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { BarChart3, TrendingUp, Users, Zap, Coins, Activity } from "lucide-react";

interface StatsData {
  total_users: number;
  active_users: number;
  total_workflows: number;
  total_runs: number;
  credits_issued: number;
  credits_consumed: number;
}

export default function AdminStatsPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () =>
      apiClient.get<StatsData>("/admin/stats/overview", undefined, true),
  });

  const cards = [
    {
      label: "总用户数",
      value: stats?.total_users ?? 0,
      sub: `活跃 ${stats?.active_users ?? 0}`,
      icon: Users,
      color: "text-blue-500",
    },
    {
      label: "总工作流数",
      value: stats?.total_workflows ?? 0,
      sub: "已创建",
      icon: BarChart3,
      color: "text-purple-500",
    },
    {
      label: "总运行次数",
      value: stats?.total_runs ?? 0,
      sub: "累计",
      icon: Zap,
      color: "text-yellow-500",
    },
    {
      label: "总积分发放",
      value: stats?.credits_issued ?? 0,
      sub: "充值+赠送",
      icon: Coins,
      color: "text-green-500",
    },
    {
      label: "总积分消耗",
      value: stats?.credits_consumed ?? 0,
      sub: "已消费",
      icon: TrendingUp,
      color: "text-orange-500",
    },
    {
      label: "活跃率",
      value: stats
        ? stats.total_users > 0
          ? Math.round((stats.active_users / stats.total_users) * 100) + "%"
          : "0%"
        : "--",
      sub: "活跃/总用户",
      icon: Activity,
      color: "text-cyan-500",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">数据统计</h1>
        <p className="text-muted-foreground mt-1">平台运营数据概览</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <CardDescription>加载中...</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-8 bg-muted animate-pulse rounded w-20" />
                </CardContent>
              </Card>
            ))
          : cards.map((card) => (
              <Card key={card.label}>
                <CardHeader className="pb-2">
                  <CardDescription>{card.label}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-2xl font-bold">{card.value}</span>
                      <p className="text-xs text-muted-foreground mt-1">
                        {card.sub}
                      </p>
                    </div>
                    <card.icon className={`h-8 w-8 ${card.color} opacity-80`} />
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">运营趋势</CardTitle>
          <CardDescription>详细统计图表将在后续版本中添加</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            统计图表开发中...
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
