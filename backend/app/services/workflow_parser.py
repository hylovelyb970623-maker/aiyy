import json
import copy
from typing import Any
from app.schemas.workflow import FormFieldSchema


class WorkflowParser:

    @staticmethod
    def strip_meta(workflow_json: dict) -> dict:
        result = copy.deepcopy(workflow_json)
        for node_id in list(result.keys()):
            node = result[node_id]
            if isinstance(node, dict):
                node.pop("_meta", None)
        return result

    @staticmethod
    def is_frontend_format(workflow_json: dict) -> bool:
        return "nodes" in workflow_json and isinstance(workflow_json["nodes"], list)

    @staticmethod
    def convert_frontend_to_api(workflow_json: dict) -> dict:
        api_workflow = {}
        nodes = workflow_json.get("nodes", [])
        links = workflow_json.get("links", [])

        link_map = {}
        for link in links:
            if len(link) >= 5:
                link_id = link[0]
                origin_id = str(link[1])
                origin_slot = link[2]
                target_id = str(link[3])
                target_slot = link[4]
                link_map[link_id] = {
                    "origin_id": origin_id,
                    "origin_slot": origin_slot,
                    "target_id": target_id,
                    "target_slot": target_slot,
                }

        for node in nodes:
            if not isinstance(node, dict):
                continue
            node_id = str(node.get("id", ""))
            class_type = node.get("type", "")
            if not class_type:
                continue

            inputs: dict[str, Any] = {}

            widget_values = node.get("widgets_values", [])
            if widget_values:
                inputs = WorkflowParser._map_widget_values(class_type, widget_values)

            node_inputs = node.get("inputs", [])
            for inp in node_inputs:
                if not isinstance(inp, dict):
                    continue
                link_id = inp.get("link")
                name = inp.get("name", "")
                if link_id is not None and link_id in link_map:
                    origin = link_map[link_id]
                    inputs[name] = [origin["origin_id"], origin["origin_slot"]]

            api_workflow[node_id] = {
                "class_type": class_type,
                "inputs": inputs,
            }

        return api_workflow

    @staticmethod
    def _map_widget_values(class_type: str, widgets_values: list) -> dict:
        WIDGET_MAP: dict[str, list[str]] = {
            "KSampler": ["seed", "control_after_generate", "steps", "cfg", "sampler_name", "scheduler", "denoise"],
            "KSamplerAdvanced": ["add_noise", "noise_seed", "control_after_generate", "steps", "cfg", "sampler_name", "scheduler", "start_at_step", "end_at_step", "return_with_leftover_noise"],
            "CheckpointLoaderSimple": ["ckpt_name"],
            "LoraLoader": ["lora_name", "strength_model", "strength_clip"],
            "LoraLoaderModelOnly": ["lora_name", "strength_model"],
            "VAELoader": ["vae_name"],
            "CLIPLoader": ["clip_name"],
            "DualCLIPLoader": ["clip_name1", "clip_name2", "type"],
            "UNETLoader": ["unet_name", "weight_dtype"],
            "CLIPTextEncode": ["text"],
            "CLIPTextEncodeForSDXL": ["text", "width", "height", "crop_w", "crop_h", "target_width", "target_height", "text_g", "text_l"],
            "EmptyLatentImage": ["width", "height", "batch_size"],
            "SaveImage": ["filename_prefix"],
            "PreviewImage": ["filename_prefix"],
            "LoadImage": ["image", "upload"],
            "LoadImageMask": ["image", "channel", "upload"],
        }

        field_names = WIDGET_MAP.get(class_type)
        result: dict[str, Any] = {}
        if field_names:
            for i, val in enumerate(widgets_values):
                if i < len(field_names):
                    result[field_names[i]] = val
        else:
            for i, val in enumerate(widgets_values):
                result[f"widget_{i}"] = val

        return result
    TEXT_NODE_TYPES = {
        "CLIPTextEncode",
        "CLIPTextEncodeForSDXL",
        "CLIPTextEncodeForSDXLRefiner",
    }

    IMAGE_LOAD_TYPES = {
        "LoadImage",
        "LoadImageMask",
    }

    MODEL_LOAD_TYPES = {
        "CheckpointLoaderSimple": "ckpt_name",
        "LoraLoader": "lora_name",
        "LoraLoaderModelOnly": "lora_name",
        "VAELoader": "vae_name",
        "CLIPLoader": "clip_name",
        "DualCLIPLoader": "clip_name1",
        "UNETLoader": "unet_name",
    }

    SAMPLER_TYPES = {
        "KSampler",
        "KSamplerAdvanced",
    }

    OUTPUT_TYPES = {
        "SaveImage",
        "PreviewImage",
    }

    HIDDEN_NODE_TYPES = {
        "VAEDecode",
        "VAEEncode",
        "CLIPSetLastLayer",
        "ConditioningCombine",
        "ConditioningSetArea",
        "ControlNetApply",
        "ControlNetApplyAdvanced",
    }

    LABEL_MAP = {
        "text": "提示词",
        "steps": "步数",
        "cfg": "CFG",
        "seed": "随机种子",
        "sampler_name": "采样器",
        "scheduler": "调度器",
        "denoise": "去噪强度",
        "width": "宽度",
        "height": "高度",
        "batch_size": "批次大小",
        "ckpt_name": "模型",
        "lora_name": "LoRA",
        "vae_name": "VAE",
        "clip_name": "CLIP",
        "unet_name": "UNET",
        "image": "图片",
        "filename_prefix": "文件名前缀",
        "positive": "正面提示词",
        "negative": "负面提示词",
        "prompt": "提示词",
        "strength": "强度",
        "noise_seed": "随机种子",
        "control_after_generate": "生成后控制",
        "add_noise": "添加噪声",
        "start_at_step": "起始步数",
        "end_at_step": "结束步数",
        "return_with_leftover_noise": "返回残留噪声",
    }

    def _get_label(self, class_type: str, field: str, node_id: str) -> str:
        label = self.LABEL_MAP.get(field, field)
        return f"{label} ({class_type} #{node_id})"

    def _infer_field_type(self, field: str, value: Any) -> tuple[str, dict]:
        if field in ("text", "prompt", "positive", "negative"):
            return "textarea", {}
        if field in ("seed", "noise_seed"):
            return "seed", {}
        if field in ("steps", "start_at_step", "end_at_step"):
            return "slider", {"min": 1, "max": 150, "step": 1}
        if field == "cfg":
            return "slider", {"min": 1, "max": 30, "step": 0.5}
        if field == "denoise":
            return "slider", {"min": 0, "max": 1, "step": 0.05}
        if field == "strength":
            return "slider", {"min": 0, "max": 2, "step": 0.05}
        if field in ("width", "height"):
            return "select", {"options": [512, 576, 640, 768, 832, 896, 1024, 1152, 1280]}
        if field == "batch_size":
            return "slider", {"min": 1, "max": 8, "step": 1}
        if field in ("sampler_name", "scheduler"):
            return "select", {"options": []}
        if field in ("ckpt_name", "lora_name", "vae_name", "clip_name", "unet_name"):
            return "select", {"options": []}
        if field in ("add_noise", "return_with_leftover_noise"):
            return "select", {"options": ["enable", "disable"]}
        if field == "control_after_generate":
            return "select", {"options": ["fixed", "increment", "decrement", "randomize"]}
        if field == "filename_prefix":
            return "text", {}
        if isinstance(value, float):
            return "slider", {"min": 0, "max": max(value * 2, 10), "step": 0.01}
        if isinstance(value, bool):
            return "select", {"options": [True, False]}
        if isinstance(value, int):
            if value > 1000:
                return "seed", {}
            return "number", {"min": 0, "max": max(value * 2, 100)}
        if isinstance(value, str):
            if len(value) > 50:
                return "textarea", {}
            return "text", {}
        return "text", {}

    def _determine_text_role(self, workflow_json: dict, node_id: str) -> str:
        for nid, ndef in workflow_json.items():
            if not isinstance(ndef, dict):
                continue
            inputs = ndef.get("inputs", {})
            for field_name, field_value in inputs.items():
                if isinstance(field_value, list) and len(field_value) == 2:
                    if str(field_value[0]) == node_id:
                        if field_name == "positive":
                            return "positive"
                        if field_name == "negative":
                            return "negative"
        return "text"

    def parse(self, workflow_json: dict) -> list[FormFieldSchema]:
        form_fields: list[FormFieldSchema] = []

        for node_id, node_def in workflow_json.items():
            if not isinstance(node_def, dict):
                continue
            class_type = node_def.get("class_type", "")
            inputs = node_def.get("inputs", {})

            if class_type in self.HIDDEN_NODE_TYPES:
                continue

            if class_type in self.OUTPUT_TYPES:
                continue

            if class_type in self.TEXT_NODE_TYPES:
                role = self._determine_text_role(workflow_json, node_id)
                label_field = role if role in ("positive", "negative") else "text"
                form_fields.append(
                    FormFieldSchema(
                        node_id=node_id,
                        field="text",
                        type="textarea",
                        label=self._get_label(class_type, label_field, node_id),
                        default=inputs.get("text", ""),
                        required=True,
                        group="basic",
                        visible=True,
                    )
                )
                continue

            if class_type in self.IMAGE_LOAD_TYPES:
                form_fields.append(
                    FormFieldSchema(
                        node_id=node_id,
                        field="image",
                        type="image_upload",
                        label=self._get_label(class_type, "image", node_id),
                        default=inputs.get("image", ""),
                        required=True,
                        group="basic",
                        visible=True,
                    )
                )
                continue

            for field_name, field_value in inputs.items():
                if isinstance(field_value, list):
                    continue

                field_type, extra = self._infer_field_type(field_name, field_value)

                is_basic = field_name in (
                    "text", "prompt", "positive", "negative",
                    "image", "strength", "denoise",
                )

                form_fields.append(
                    FormFieldSchema(
                        node_id=node_id,
                        field=field_name,
                        type=field_type,
                        label=self._get_label(class_type, field_name, node_id),
                        default=field_value,
                        options=extra.get("options"),
                        min=extra.get("min"),
                        max=extra.get("max"),
                        step=extra.get("step"),
                        group="basic" if is_basic else "advanced",
                        visible=is_basic,
                    )
                )

        return form_fields

    def get_output_nodes(self, workflow_json: dict) -> dict:
        output_nodes = {}
        for node_id, node_def in workflow_json.items():
            if not isinstance(node_def, dict):
                continue
            class_type = node_def.get("class_type", "")
            inputs = node_def.get("inputs", {})
            if class_type in self.OUTPUT_TYPES:
                output_nodes[node_id] = {
                    "type": "image",
                    "filename_prefix": inputs.get("filename_prefix", "ComfyUI"),
                }
        return output_nodes

    def get_input_nodes(self, workflow_json: dict) -> dict:
        input_nodes = {}
        for node_id, node_def in workflow_json.items():
            if not isinstance(node_def, dict):
                continue
            class_type = node_def.get("class_type", "")
            inputs = node_def.get("inputs", {})
            fields = []
            for k, v in inputs.items():
                if not isinstance(v, list):
                    fields.append(k)
            if fields:
                input_nodes[node_id] = {
                    "node_id": node_id,
                    "class_type": class_type,
                    "fields": fields,
                }
        return input_nodes

    def inject_params(
        self, workflow_json: dict, user_input: dict[str, Any]
    ) -> dict:
        workflow = self.strip_meta(workflow_json)
        for key, value in user_input.items():
            if "." in key:
                node_id, field = key.split(".", 1)
                if node_id in workflow:
                    node = workflow[node_id]
                    if isinstance(node, dict) and "inputs" in node:
                        node["inputs"][field] = value
                else:
                    for wk in workflow:
                        if str(wk) == node_id:
                            node = workflow[wk]
                            if isinstance(node, dict) and "inputs" in node:
                                node["inputs"][field] = value
                            break
        return workflow


workflow_parser = WorkflowParser()
