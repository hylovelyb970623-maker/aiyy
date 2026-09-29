"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WorkflowUploader } from "@/components/workflow/workflow-uploader";
import { WorkflowVisualizer } from "@/components/workflow/workflow-visualizer";
import { WorkflowForm } from "@/components/workflow/workflow-form";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Save, ArrowLeft, Settings2 } from "lucide-react";
import type { FormField, WorkflowTemplate } from "@/types";

export default function AdminCreateWorkflowPage() {
  const router = useRouter();
  const [workflowJson, setWorkflowJson] = useState<Record<string, unknown> | null>(null);
  const [filename, setFilename] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [formSchema, setFormSchema] = useState<FormField[]>([]);
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);

  const handleUpload = async (json: Record<string, unknown>, file: string) => {
    setFilename(file);
    try {
      const result = await apiClient.post<{ form_schema: FormField[]; workflow_json: Record<string, unknown> }>(
        "/workflows/parse",
        { workflow_json: json }
      );
      setWorkflowJson(result.workflow_json);
      setFormSchema(result.form_schema);
      const defaults: Record<string, unknown> = {};
      result.form_schema.forEach((field) => {
        defaults[`${field.node_id}.${field.field}`] = field.default;
      });
      setFormValues(defaults);
      if (!name) {
        setName(file.replace(".json", ""));
      }
      toast.success("工作流解析成功");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "解析失败";
      toast.error(message);
    }
  };

  const handleToggleVisible = (nodeId: string, field: string) => {
    setFormSchema((prev) =>
      prev.map((f) =>
        f.node_id === nodeId && f.field === field
          ? { ...f, visible: f.visible === false ? true : false }
          : f
      )
    );
  };

  const handleLabelChange = (nodeId: string, field: string, newLabel: string) => {
    setFormSchema((prev) =>
      prev.map((f) =>
        f.node_id === nodeId && f.field === field
          ? { ...f, label: newLabel }
          : f
      )
    );
  };

  const handleSave = async () => {
    if (!workflowJson || !name) {
      toast.error("请先上传工作流并填写名称");
      return;
    }
    setLoading(true);
    try {
      const result = await apiClient.post<{ id: string }>("/workflows", {
        name,
        description,
        workflow_json: workflowJson,
        form_schema: formSchema,
      }, true);
      toast.success("工作流创建成功，已自动审核通过");
      router.push("/admin/workflows");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "创建失败";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/admin/workflows")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">创建工作流应用</h1>
            <p className="text-muted-foreground">上传 ComfyUI 工作流 JSON，创建 AI 应用</p>
          </div>
        </div>
        {workflowJson && (
          <Button onClick={handleSave} disabled={loading}>
            <Save className="mr-2 h-4 w-4" />
            {loading ? "保存中..." : "保存并发布"}
          </Button>
        )}
      </div>

      {!workflowJson ? (
        <WorkflowUploader onUpload={handleUpload} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">应用信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>应用名称</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="给应用起个名字"
                  />
                </div>
                <div className="space-y-2">
                  <Label>描述</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="描述应用的功能"
                    rows={3}
                  />
                </div>
                <div className="text-sm text-muted-foreground">
                  文件: {filename}
                </div>
                <div className="text-sm text-green-600">
                  管理员创建的工作流将自动审核通过
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="form">
              <TabsList>
                <TabsTrigger value="form">表单预览</TabsTrigger>
                <TabsTrigger value="fields">
                  <Settings2 className="h-3.5 w-3.5 mr-1" />
                  字段配置
                </TabsTrigger>
                <TabsTrigger value="visual">工作流可视化</TabsTrigger>
              </TabsList>
              <TabsContent value="form" className="mt-4">
                <WorkflowForm
                  formSchema={formSchema}
                  values={formValues}
                  onChange={setFormValues}
                />
              </TabsContent>
              <TabsContent value="fields" className="mt-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Settings2 className="h-4 w-4" />
                      字段配置
                    </CardTitle>
                    <p className="text-sm text-muted-foreground font-normal mt-1">
                      自定义字段的显示标题和可见性
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {formSchema.length === 0 && (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        暂无字段
                      </p>
                    )}
                    {formSchema.map((field, index) => {
                      const isVisible = field.visible !== false;
                      const fieldKey = `${field.node_id}.${field.field}`;
                      return (
                        <div key={fieldKey}>
                          {index > 0 && <Separator className="my-1" />}
                          <div className="py-3 px-1 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <Badge variant={field.group === "advanced" ? "secondary" : "default"} className="text-xs shrink-0">
                                  {field.group === "advanced" ? "高级" : "基本"}
                                </Badge>
                                <Badge variant="outline" className="text-xs shrink-0">
                                  {field.type}
                                </Badge>
                                <span className="text-xs text-muted-foreground truncate">
                                  节点 #{field.node_id} · {field.field}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 ml-4">
                                <span className="text-xs text-muted-foreground">
                                  {isVisible ? "显示" : "隐藏"}
                                </span>
                                <Switch
                                  checked={isVisible}
                                  onCheckedChange={() =>
                                    handleToggleVisible(field.node_id, field.field)
                                  }
                                />
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Label className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                                显示标题
                              </Label>
                              <Input
                                value={field.label}
                                onChange={(e) =>
                                  handleLabelChange(field.node_id, field.field, e.target.value)
                                }
                                placeholder="用户可见的标题"
                                className="h-8 text-sm"
                              />
                            </div>
                            <p className="text-xs text-muted-foreground">
                              默认值: {String(field.default ?? "(空)")}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="visual" className="mt-4">
                <WorkflowVisualizer workflowJson={workflowJson} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}
    </div>
  );
}
