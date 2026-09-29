"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Coins, Plus, Minus, RefreshCw } from "lucide-react";
import { useState } from "react";

interface UserWithCredits {
  id: string;
  email: string;
  nickname: string;
  status: string;
  balance?: number;
  total_consumed?: number;
}

export default function AdminCreditsPage() {
  const queryClient = useQueryClient();

  const { data: users, isLoading, refetch } = useQuery({
    queryKey: ["admin-users-credits"],
    queryFn: async () => {
      const usersResp = await apiClient.get<{ items: UserWithCredits[] }>(
        "/admin/users",
        undefined,
        true
      );
      return usersResp.items;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Coins className="h-6 w-6" />
            积分管理
          </h1>
          <p className="text-muted-foreground mt-1">查看用户积分余额并调整</p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          刷新
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="h-20 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {users?.map((user) => (
            <UserCreditCard key={user.id} user={user} onRefresh={refetch} />
          ))}
          {(!users || users.length === 0) && (
            <p className="text-muted-foreground col-span-full text-center py-8">
              暂无用户
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function UserCreditCard({
  user,
  onRefresh,
}: {
  user: UserWithCredits;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("10");
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState<"add" | "deduct">("add");

  const adjustMutation = useMutation({
    mutationFn: (params: { amount: number; reason: string }) =>
      apiClient.post(
        `/admin/users/${user.id}/credits`,
        {
          amount: mode === "add" ? params.amount : -params.amount,
          reason: params.reason,
        },
        true
      ),
    onSuccess: () => {
      toast.success(mode === "add" ? "积分已增加" : "积分已扣除");
      setOpen(false);
      setAmount("10");
      setReason("");
      onRefresh();
    },
    onError: () => toast.error("操作失败"),
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium">{user.nickname}</CardTitle>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
          <Badge variant={user.status === "active" ? "default" : "secondary"}>
            {user.status === "active" ? "正常" : "禁用"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-lg font-bold">
          <Coins className="h-4 w-4 text-amber-500" />
          {user.balance ?? 0}
          <span className="text-xs font-normal text-muted-foreground">积分</span>
          {user.total_consumed ? (
            <span className="text-xs font-normal text-muted-foreground ml-auto">
              已消费 {user.total_consumed}
            </span>
          ) : null}
        </div>

        {!open ? (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => {
                setMode("add");
                setOpen(true);
              }}
            >
              <Plus className="h-3 w-3 mr-1" />
              增加
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => {
                setMode("deduct");
                setOpen(true);
              }}
            >
              <Minus className="h-3 w-3 mr-1" />
              扣除
            </Button>
          </div>
        ) : (
          <div className="space-y-2 pt-2 border-t">
            <p className="text-xs font-medium">
              {mode === "add" ? "增加积分" : "扣除积分"}
            </p>
            <div className="flex gap-2">
              <Input
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-8 text-sm w-20"
              />
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="原因（可选）"
                className="h-8 text-sm flex-1"
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                onClick={() => {
                  const num = parseInt(amount, 10);
                  if (isNaN(num) || num <= 0) {
                    toast.error("请输入正整数");
                    return;
                  }
                  adjustMutation.mutate({ amount: num, reason });
                }}
                disabled={adjustMutation.isPending}
              >
                确认
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
              >
                取消
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
