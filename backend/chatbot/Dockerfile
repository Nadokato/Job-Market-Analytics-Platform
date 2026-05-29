FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for OCR
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-vie \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY backend/chatbot/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install pipeline dependencies
COPY python-ml-service/requirements.txt ./pipeline_reqs.txt
RUN pip install --no-cache-dir -r pipeline_reqs.txt

COPY backend/chatbot .

# Also copy chatbot pipeline phases (needed by workers)
COPY chatbot /chatbot
