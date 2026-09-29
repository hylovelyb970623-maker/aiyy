"use client";

import { useAuthStore } from "@/stores/auth-store";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  LayoutGrid,
  History,
  Coins,
  LogOut,
  User,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useCreditStore } from "@/stores/credit-store";
import { apiClient } from "@/lib/api";
import type { CreditAccount } from "@/types";

const menuItems = [
    { title: "我的应用", href: "/", icon: LayoutGrid },
    { title: "运行历史", href: "/history", icon: History },
    { title: "积分中心", href: "/credits", icon: Coins },
  ];

function DashboardSidebar() {
  const { user, logout } = useAuthStore();
  const { balance } = useCreditStore();
  const router = useRouter();
  const pathname = usePathname();
  const [comfyuiConnected, setComfyuiConnected] = useState<boolean | null>(null);

  useEffect(() => {
    const checkStatus = () => {
      apiClient.get<{ connected: boolean }>("/workflows/comfyui/status")
        .then((res) => setComfyuiConnected(res.connected))
        .catch(() => setComfyuiConnected(false));
    };
    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            AI
          </div>
          <span className="font-semibold text-lg">AIYY</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>导航</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))}
                    onClick={() => router.push(item.href)}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t p-4">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-1.5">
            {comfyuiConnected === null ? (
              <div className="h-2 w-2 rounded-full bg-muted-foreground/30 animate-pulse" />
            ) : comfyuiConnected ? (
              <Wifi className="h-3 w-3 text-green-500" />
            ) : (
              <WifiOff className="h-3 w-3 text-red-500" />
            )}
            <span className="text-[10px] text-muted-foreground">
              ComfyUI {comfyuiConnected === null ? "检测中" : comfyuiConnected ? "已连接" : "未连接"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback>
              {user?.nickname?.charAt(0) || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.nickname || "用户"}</p>
            <div className="flex items-center gap-1">
              <Coins className="h-3 w-3 text-yellow-500" />
              <span className="text-xs text-muted-foreground">{balance} 积分</span>
            </div>
          </div>
          <Badge variant="secondary" className="text-xs">
            {user?.role === "admin" ? "管理员" : "用户"}
          </Badge>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => logout()}>
              <LogOut className="h-4 w-4" />
              <span>退出登录</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, fetchUser } = useAuthStore();
  const { loadFromAccount } = useCreditStore();
  const router = useRouter();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    fetchUser();
    apiClient.get<CreditAccount>("/credits/balance").then(loadFromAccount).catch(() => {});
  }, [isHydrated, isAuthenticated, router, fetchUser, loadFromAccount]);

  if (!isHydrated || !isAuthenticated) {
    return null;
  }

  return (
    <SidebarProvider>
      <DashboardSidebar />
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-6">
          <SidebarTrigger />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
