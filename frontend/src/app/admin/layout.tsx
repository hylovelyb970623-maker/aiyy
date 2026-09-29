"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
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
import { Shield, Users, FileCode, Coins, BarChart3, KeyRound, Settings, LogOut } from "lucide-react";

const adminMenuItems = [
  { title: "用户管理", href: "/admin/users", icon: Users },
  { title: "工作流管理", href: "/admin/workflows", icon: FileCode },
  { title: "权限分配", href: "/admin/permissions", icon: KeyRound },
  { title: "积分管理", href: "/admin/credits", icon: Coins },
  { title: "数据统计", href: "/admin/stats", icon: BarChart3 },
  { title: "系统设置", href: "/admin/settings", icon: Settings },
];

function AdminSidebar() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-destructive" />
          <span className="font-semibold text-lg">管理后台</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>管理</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminMenuItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={pathname === item.href}
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
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => {
              localStorage.removeItem("admin_access_token");
              localStorage.removeItem("admin_refresh_token");
              router.push("/admin/login");
            }}>
              <LogOut className="h-4 w-4" />
              <span>退出</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    if (pathname !== "/admin/login") {
      const token = localStorage.getItem("admin_access_token");
      if (!token) {
        router.push("/admin/login");
      }
    }
  }, [isHydrated, pathname, router]);

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  if (!isHydrated) {
    return null;
  }

  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-6">
          <SidebarTrigger />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="h-4 w-4" />
            管理后台
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
