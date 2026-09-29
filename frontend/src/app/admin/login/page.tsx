"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Lock, User, Shield } from "lucide-react";

export default function AdminLoginPage() {
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const tokens = await apiClient.post<{ access_token: string; refresh_token: string }>("/admin/login", {
        email: account,
        password,
      });
      localStorage.setItem("admin_access_token", tokens.access_token);
      localStorage.setItem("admin_refresh_token", tokens.refresh_token);
      toast.success("管理员登录成功");
      router.push("/admin/users");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "登录失败";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive text-destructive-foreground font-bold text-xl">
              <Shield className="h-6 w-6" />
            </div>
          </div>
          <CardTitle className="text-2xl">管理后台</CardTitle>
          <CardDescription>仅限管理员登录</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="account">管理员账号</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="account"
                  type="text"
                  placeholder="请输入管理员账号"
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="管理员密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              <Lock className="mr-2 h-4 w-4" />
              {loading ? "登录中..." : "管理员登录"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
