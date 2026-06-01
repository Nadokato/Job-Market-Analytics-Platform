# Guide: QLoRA Adapter Integration via Ollama

Follow these steps to serve fine-tuned model adapter in web app.

## Target Files

- [pipeline_bridge.py](file:///d:/Job-Market-Analytics-Platform/backend/chatbot/pipeline_bridge.py)
- [Modelfile](file:///d:/Job-Market-Analytics-Platform/chatbot/phase%207-qlora-finetune/Modelfile) (New)

---

## Step 1: Create Modelfile

Create [Modelfile](file:///d:/Job-Market-Analytics-Platform/chatbot/phase%207-qlora-finetune/Modelfile) in adapter directory:

```dockerfile
# Base model must match model used for fine-tuning
FROM qwen2.5:3b

# Path to final_adapter directory containing adapter_model.safetensors
ADAPTER /absolute/path/to/final_adapter
```

---

## Step 2: Build Ollama Model

Run command in host shell to create custom model:

```bash
ollama create hr-coach -f d:/Job-Market-Analytics-Platform/chatbot/phase%207-qlora-finetune/Modelfile
```

Verify build success:

```bash
ollama run hr-coach "test prompt"
```

---

## Step 3: Update Chatbot Backend

Modify [pipeline_bridge.py](file:///d:/Job-Market-Analytics-Platform/backend/chatbot/pipeline_bridge.py#L42):

```diff
-DEFAULT_MODEL = "qwen2.5:7b"
+DEFAULT_MODEL = "hr-coach"
```

---

## Step 4: Restart Backend Services

Restart Celery workers and FastAPI backend to load new model config:

```bash
# In backend root
docker compose restart
```
