FROM node:22-bookworm-slim AS web
WORKDIR /app/mobile
COPY mobile/package.json mobile/bun.lock* ./
RUN npm install --no-audit --no-fund
COPY mobile/ ./
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
COPY server/requirements.txt ./server/requirements.txt
RUN pip install --no-cache-dir -r server/requirements.txt
COPY server/ ./server/
COPY --from=web /app/mobile/dist ./mobile/dist
ENV PYTHONUNBUFFERED=1
ENV PORT=10000
EXPOSE 10000
CMD ["python", "server/zentora.py"]
