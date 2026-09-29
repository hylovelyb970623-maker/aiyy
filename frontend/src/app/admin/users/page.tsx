"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type { User, PaginatedResponse } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Ban, CheckCircle, Coins } from "lucide-react";
import { useState } from "react";

const ADMIN = true;

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data: users, refetch } = useQuery({
    queryKey: ["admin-users", page, search],
    queryFn: () =>
      apiClient.get<PaginatedResponse<User>>("/admin/users", {
        page,
        page_size: 20,
        search,
      }, ADMIN),
  });

  const handleToggleStatus = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "banned" : "active";
    try {
      await apiClient.put(`/admin/users/${userId}/status`, { status: newStatus }, ADMIN);
      toast.success(newStatus === "banned" ? "已封禁" : "已解封");
      refetch();
    } catch {
      toast.error("操作失败");
    }
  };

  const handleAdjustCredits = async (userId: string, amount: number) => {
    try {
      await apiClient.post(`/admin/users/${userId}/credits`, { amount, type: "gift" }, ADMIN);
      toast.success(`已调整 ${amount} 积分`);
      refetch();
    } catch {
      toast.error("操作失败");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">用户管理</h1>
          <p className="text-muted-foreground">管理平台用户</p>
        </div>
        <div className="w-64">
          <Input
            placeholder="搜索用户..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">用户</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">邮箱</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">角色</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">状态</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">注册时间</th>
                <th className="text-right p-3 text-sm font-medium text-muted-foreground">操作</th>
              </tr>
            </thead>
            <tbody>
              {users?.items?.map((user) => (
                <tr key={user.id} className="border-b last:border-0">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                        {user.nickname?.charAt(0) || "U"}
                      </div>
                      <span className="text-sm font-medium">{user.nickname}</span>
                    </div>
                  </td>
                  <td className="p-3 text-sm">{user.email}</td>
                  <td className="p-3">
                    <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                      {user.role === "admin" ? "管理员" : "用户"}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <Badge variant={user.status === "active" ? "default" : "destructive"}>
                      {user.status === "active" ? "正常" : "封禁"}
                    </Badge>
                  </td>
                  <td className="p-3 text-sm text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString("zh-CN")}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleStatus(user.id, user.status)}
                      >
                        {user.status === "active" ? (
                          <><Ban className="h-3 w-3 mr-1" />封禁</>
                        ) : (
                          <><CheckCircle className="h-3 w-3 mr-1" />解封</>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAdjustCredits(user.id, 100)}
                      >
                        <Coins className="h-3 w-3 mr-1" />+100
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
