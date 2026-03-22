FROM python:3.12-slim

WORKDIR /app

# Install dependencies from requirements file
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY api/ ./api/
COPY scoring/ ./scoring/
COPY ingestion/ ./ingestion/
COPY bigquery/ ./bigquery/
COPY files/ ./files/

ENV PYTHONUNBUFFERED=1

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8080"]
