# Haltwise container: one Node process serving the API and the built web app.
# Used for Hugging Face Spaces (Docker SDK, port 7860); works on any container host.
FROM node:24-slim

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund

COPY . .
RUN npm run build \
  && mkdir -p /app/data \
  && chown -R 1000:1000 /app/data

# Spaces run containers as user 1000; SQLite lives in /app/data (recreated with demo data on each start).
ENV PORT=7860 \
    DB_PATH=/app/data/haltwise.db \
    NEMOTRON_THINKING=off
USER 1000
EXPOSE 7860
CMD ["npx", "tsx", "server/src/index.ts"]
