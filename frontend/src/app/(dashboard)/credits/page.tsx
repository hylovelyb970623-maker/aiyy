"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useCreditStore } from "@/stores/credit-store";
import type { CreditAccount, CreditTransaction, PaginatedResponse } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Coins, TrendingUp, TrendingDown, Gift, RotateCcw, Clock } from "lucide-react";

export default function CreditsPage() {
  const { balance, totalRecharged, totalConsumed, totalGifted, loadFromAccount } = useCreditStore();

  useQuery({
    queryKey: ["credit-balance"],
    queryFn: async () => {
      const account = await apiClient.get<CreditAccount>("/credits/balance");
      loadFromAccount(account);
      return account;
    },
  });

  const { data: transactions } = useQuery({
    queryKey: ["credit-transactions"],
    queryFn: () =>
      apiClient.get<PaginatedResponse<CreditTransaction>>("/credits/transactions", {
        page: 1,
        page_size: 50,
      }),
  });

  const typeIcon = (type: CreditTransaction["type"]) => {
    switch (type) {
      case "recharge": return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "consume": return <TrendingDown className="h-4 w-4 text-red-500" />;
      case "gift": return <Gift className="h-4 w-4 text-yellow-500" />;
      case "refund": return <RotateCcw className="h-4 w-4 text-blue-500" />;
      case "expire": return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const typeLabel = (type: CreditTransaction["type"]) => {
    switch (type) {
      case "recharge": return "充值";
      case "consume": return "消费";
      case "gift": return "赠送";
      case "refund": return "退款";
      case "expire": return "过期";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">积分中心</h1>
        <p className="text-muted-foreground">查看积分余额和交易记录</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>当前余额</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Coins className="h-6 w-6 text-yellow-500" />
              <span className="text-3xl font-bold">{balance}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>累计充值</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-green-500" />
              <span className="text-3xl font-bold">{totalRecharged}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>累计消费</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingDown className="h-6 w-6 text-red-500" />
              <span className="text-3xl font-bold">{totalConsumed}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">交易记录</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {transactions?.items?.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  {typeIcon(tx.type)}
                  <div>
                    <p className="text-sm font-medium">{tx.description || typeLabel(tx.type)}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(tx.created_at).toLocaleString("zh-CN")}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-medium ${tx.amount > 0 ? "text-green-600" : "text-red-600"}`}>
                    {tx.amount > 0 ? "+" : ""}{tx.amount}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    余额: {tx.balance_after}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {(!transactions?.items || transactions.items.length === 0) && (
            <p className="text-center text-muted-foreground py-8">暂无交易记录</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
