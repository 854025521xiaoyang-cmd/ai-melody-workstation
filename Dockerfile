FROM node:20-bookworm-slim AS frontend-builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY src ./src
COPY public ./public
COPY index.html vite.config.js ./

RUN npm run build


FROM python:3.11-slim-bookworm AS runtime

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg libsndfile1 \
  && rm -rf /var/lib/apt/lists/*

COPY backend-python/requirements.txt /app/backend-python/requirements.txt
RUN pip install --no-cache-dir -r /app/backend-python/requirements.txt

COPY backend-python /app/backend-python
COPY public /app/public
COPY piano_to_sheet.py /app/piano_to_sheet.py
COPY index.html /app/index.html
COPY --from=frontend-builder /app/dist /app/dist

CMD ["sh", "-c", "python3 -m uvicorn backend-python.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
