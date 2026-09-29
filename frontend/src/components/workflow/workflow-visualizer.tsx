"use client";

import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeTypes,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

interface ComfyUINodeData {
  label: string;
  classType: string;
  inputFields: string[];
  outputCount: number;
  isInput?: boolean;
  isOutput?: boolean;
  [key: string]: unknown;
}

function ComfyUINode({ data }: { data: ComfyUINodeData }) {
  const borderColor = data.isInput
    ? "border-green-500"
    : data.isOutput
    ? "border-blue-500"
    : "border-gray-300";

  return (
    <div
      className={`px-3 py-2 rounded-lg border-2 bg-card shadow-sm min-w-[150px] ${borderColor}`}
    >
      {Array.from({ length: data.outputCount }).map((_, i) => (
        <Handle
          key={`out-${i}`}
          type="source"
          position={Position.Right}
          id={`output_${i}`}
          style={{ top: 20 + i * 16 }}
          className="!w-2 !h-2 !bg-gray-400"
        />
      ))}
      <div className="text-xs font-medium text-center mb-1">{data.label}</div>
      <div className="text-[10px] text-muted-foreground text-center">
        {data.classType}
      </div>
      {data.inputFields.map((input, i) => (
        <Handle
          key={`in-${input}`}
          type="target"
          position={Position.Left}
          id={input}
          style={{ top: 20 + i * 16 }}
          className="!w-2 !h-2 !bg-gray-400"
        />
      ))}
    </div>
  );
}

const nodeTypes: NodeTypes = {
  comfyui: ComfyUINode,
};

interface WorkflowVisualizerProps {
  workflowJson: Record<string, unknown>;
}

export function WorkflowVisualizer({ workflowJson }: WorkflowVisualizerProps) {
  const { nodes, edges } = useMemo(() => {
    const nodeList: Node[] = [];
    const edgeList: Edge[] = [];

    const outputCountMap: Record<string, number> = {};

    Object.entries(workflowJson).forEach(([, nodeDef]) => {
      const def = nodeDef as { inputs: Record<string, unknown> };
      Object.values(def.inputs).forEach((v) => {
        if (Array.isArray(v) && v.length === 2) {
          const sourceId = String(v[0]);
          outputCountMap[sourceId] = Math.max(
            outputCountMap[sourceId] || 0,
            (v[1] as number) + 1
          );
        }
      });
    });

    const entries = Object.entries(workflowJson);
    const colCount = Math.ceil(Math.sqrt(entries.length));

    entries.forEach(([nodeId, nodeDef], index) => {
      const def = nodeDef as {
        class_type: string;
        inputs: Record<string, unknown>;
      };
      const inputFields = Object.entries(def.inputs)
        .filter(([, v]) => Array.isArray(v))
        .map(([k]) => k);
      const outputCount = outputCountMap[nodeId] || 0;

      const isInput =
        def.class_type === "LoadImage" ||
        def.class_type === "CLIPTextEncode" ||
        def.class_type === "CLIPTextEncodeForSDXL";
      const isOutput =
        def.class_type === "SaveImage" ||
        def.class_type === "PreviewImage";

      const row = Math.floor(index / colCount);
      const col = index % colCount;

      nodeList.push({
        id: nodeId,
        type: "comfyui",
        position: { x: col * 280, y: row * 160 },
        data: {
          label: `${def.class_type} (${nodeId})`,
          classType: def.class_type,
          inputFields,
          outputCount,
          isInput,
          isOutput,
        },
      });

      Object.entries(def.inputs).forEach(([fieldName, value]) => {
        if (Array.isArray(value) && value.length === 2) {
          const [sourceNodeId, sourceIndex] = value as [string, number];
          edgeList.push({
            id: `${sourceNodeId}-${sourceIndex}-${nodeId}-${fieldName}`,
            source: String(sourceNodeId),
            target: nodeId,
            sourceHandle: `output_${sourceIndex}`,
            targetHandle: fieldName,
            animated: true,
            style: { stroke: "#94a3b8", strokeWidth: 1.5 },
          });
        }
      });
    });

    return { nodes: nodeList, edges: edgeList };
  }, [workflowJson]);

  return (
    <div className="h-[400px] w-full border rounded-lg overflow-hidden bg-background">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.3}
        maxZoom={2}
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
