"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { KeyRound, Plus, Trash2, User, FileCode, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface AdminUser {
  id: string;
  email: string;
  nickname: string;
  status: string;
  created_at: string;
}

interface AdminWorkflow {
  id: string;
  name: string;
  description: string;
  status: string;
}

interface PermissionUser {
  permission_id: string;
  user_id: string;
  email: string;
  nickname: string;
  granted_at: string;
}

interface UserWorkflow {
  permission_id: string;
  workflow_id: string;
  name: string;
  description: string;
  status: string;
  granted_at: string;
}

export default function PermissionsPage() {
  const queryClient = useQueryClient();

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () =>
      apiClient.get<{ items: AdminUser[] }>("/admin/users", undefined, true),
  });

  const { data: workflows, isLoading: workflowsLoading } = useQuery({
    queryKey: ["admin-workflows"],
    queryFn: () =>
      apiClient.get<{ items: AdminWorkflow[] }>(
        "/admin/workflows",
        { page: 1, page_size: 100 },
        true
      ),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-permissions"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <KeyRound className="h-6 w-6" />
            权限分配
          </h1>
          <p className="text-muted-foreground mt-1">
            管理用户可以使用哪些工作流应用
          </p>
        </div>
        <Button variant="outline" onClick={refresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          刷新
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              按用户分配
            </CardTitle>
            <CardDescription>选择用户，分配可用的工作流</CardDescription>
          </CardHeader>
          <CardContent>
            {usersLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>用户</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users?.items?.map((user) => (
                    <UserRow key={user.id} user={user} />
                  ))}
                  {(!users?.items || users.items.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                        暂无用户
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCode className="h-5 w-5" />
              按工作流分配
            </CardTitle>
            <CardDescription>选择工作流，分配给指定用户</CardDescription>
          </CardHeader>
          <CardContent>
            {workflowsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>工作流</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workflows?.items?.map((wf) => (
                    <WorkflowRow key={wf.id} workflow={wf} />
                  ))}
                  {(!workflows?.items || workflows.items.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                        暂无工作流
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function UserRow({ user }: { user: AdminUser }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: userWorkflows } = useQuery({
    queryKey: ["admin-user-workflows", user.id],
    queryFn: () =>
      apiClient.get<{ items: UserWorkflow[] }>(
        `/admin/users/${user.id}/workflows`,
        undefined,
        true
      ),
    enabled: open,
  });

  const { data: allWorkflows } = useQuery({
    queryKey: ["admin-workflows"],
    queryFn: () =>
      apiClient.get<{ items: AdminWorkflow[] }>(
        "/admin/workflows",
        { page: 1, page_size: 100 },
        true
      ),
    enabled: open,
  });

  const grantMutation = useMutation({
    mutationFn: (workflowId: string) =>
      apiClient.post(
        `/admin/workflows/${workflowId}/grant`,
        { user_id: user.id },
        true
      ),
    onSuccess: () => {
      toast.success("授权成功");
      queryClient.invalidateQueries({ queryKey: ["admin-user-workflows", user.id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const revokeMutation = useMutation({
    mutationFn: (workflowId: string) =>
      apiClient.delete(`/admin/workflows/${workflowId}/grant/${user.id}`, true),
    onSuccess: () => {
      toast.success("已撤销权限");
      queryClient.invalidateQueries({ queryKey: ["admin-user-workflows", user.id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const grantedIds = new Set(userWorkflows?.items?.map((w) => w.workflow_id));
  const availableWorkflows = allWorkflows?.items?.filter((w) => !grantedIds.has(w.id));

  return (
    <TableRow>
      <TableCell>
        <div>
          <div className="font-medium">{user.nickname}</div>
          <div className="text-xs text-muted-foreground">{user.email}</div>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={user.status === "active" ? "default" : "secondary"}>
          {user.status === "active" ? "正常" : "禁用"}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <KeyRound className="h-3.5 w-3.5 mr-1" />
          管理权限
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>管理 {user.nickname} 的应用权限</DialogTitle>
              <DialogDescription>勾选要分配给此用户的工作流应用</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              {userWorkflows?.items && userWorkflows.items.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2 text-muted-foreground">已授权的应用</h4>
                  <div className="space-y-2">
                    {userWorkflows.items.map((wf) => (
                      <div
                        key={wf.permission_id}
                        className="flex items-center justify-between p-2 rounded-lg border bg-green-50 dark:bg-green-950"
                      >
                        <div>
                          <div className="text-sm font-medium">{wf.name}</div>
                          {wf.description && (
                            <div className="text-xs text-muted-foreground">{wf.description}</div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => revokeMutation.mutate(wf.workflow_id)}
                          disabled={revokeMutation.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {availableWorkflows && availableWorkflows.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2 text-muted-foreground">可分配的应用</h4>
                  <div className="space-y-2">
                    {availableWorkflows.map((wf) => (
                      <div key={wf.id} className="flex items-center justify-between p-2 rounded-lg border">
                        <div>
                          <div className="text-sm font-medium">{wf.name}</div>
                          {wf.description && (
                            <div className="text-xs text-muted-foreground">{wf.description}</div>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => grantMutation.mutate(wf.id)}
                          disabled={grantMutation.isPending}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" />
                          分配
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {(!availableWorkflows || availableWorkflows.length === 0) &&
                (!userWorkflows?.items || userWorkflows.items.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-4">暂无可分配的工作流</p>
                )}
            </div>
          </DialogContent>
        </Dialog>
      </TableCell>
    </TableRow>
  );
}

function WorkflowRow({ workflow }: { workflow: AdminWorkflow }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: workflowUsers } = useQuery({
    queryKey: ["admin-workflow-users", workflow.id],
    queryFn: () =>
      apiClient.get<{ items: PermissionUser[] }>(
        `/admin/workflows/${workflow.id}/users`,
        undefined,
        true
      ),
    enabled: open,
  });

  const { data: allUsers } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () =>
      apiClient.get<{ items: AdminUser[] }>("/admin/users", undefined, true),
    enabled: open,
  });

  const grantMutation = useMutation({
    mutationFn: (userId: string) =>
      apiClient.post(`/admin/workflows/${workflow.id}/grant`, { user_id: userId }, true),
    onSuccess: () => {
      toast.success("授权成功");
      queryClient.invalidateQueries({ queryKey: ["admin-workflow-users", workflow.id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const revokeMutation = useMutation({
    mutationFn: (userId: string) =>
      apiClient.delete(`/admin/workflows/${workflow.id}/grant/${userId}`, true),
    onSuccess: () => {
      toast.success("已撤销权限");
      queryClient.invalidateQueries({ queryKey: ["admin-workflow-users", workflow.id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const grantedIds = new Set(workflowUsers?.items?.map((u) => u.user_id));
  const availableUsers = allUsers?.items?.filter((u) => !grantedIds.has(u.id) && u.status === "active");

  return (
    <TableRow>
      <TableCell>
        <div>
          <div className="font-medium">{workflow.name}</div>
          {workflow.description && (
            <div className="text-xs text-muted-foreground">{workflow.description}</div>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Badge
          variant={workflow.status === "approved" ? "default" : workflow.status === "draft" ? "secondary" : "outline"}
        >
          {workflow.status === "approved" ? "已审核" : workflow.status === "draft" ? "草稿" : workflow.status}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <KeyRound className="h-3.5 w-3.5 mr-1" />
          分配用户
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{workflow.name} - 分配用户</DialogTitle>
              <DialogDescription>管理可以使用此应用的用户</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              {workflowUsers?.items && workflowUsers.items.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2 text-muted-foreground">
                    已授权用户 ({workflowUsers.items.length})
                  </h4>
                  <div className="space-y-2">
                    {workflowUsers.items.map((u) => (
                      <div
                        key={u.permission_id}
                        className="flex items-center justify-between p-2 rounded-lg border bg-green-50 dark:bg-green-950"
                      >
                        <div>
                          <div className="text-sm font-medium">{u.nickname}</div>
                          <div className="text-xs text-muted-foreground">{u.email}</div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => revokeMutation.mutate(u.user_id)}
                          disabled={revokeMutation.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {availableUsers && availableUsers.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2 text-muted-foreground">添加用户</h4>
                  <div className="space-y-2">
                    {availableUsers.map((u) => (
                      <div key={u.id} className="flex items-center justify-between p-2 rounded-lg border">
                        <div>
                          <div className="text-sm font-medium">{u.nickname}</div>
                          <div className="text-xs text-muted-foreground">{u.email}</div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => grantMutation.mutate(u.id)}
                          disabled={grantMutation.isPending}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" />
                          添加
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {(!availableUsers || availableUsers.length === 0) &&
                (!workflowUsers?.items || workflowUsers.items.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-4">暂无活跃用户可分配</p>
                )}
            </div>
          </DialogContent>
        </Dialog>
      </TableCell>
    </TableRow>
  );
}
