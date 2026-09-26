FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["python", "-c", "import os, uvicorn; port=int(os.environ.get('PORT', 8000)); uvicorn.run('backend.main:app', host='0.0.0.0', port=port)"]
