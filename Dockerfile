# ─── Stage 1: Build Next.js static export ────────────────────────────────────
FROM node:20-slim AS frontend-builder

WORKDIR /build/frontend

# Install dependencies with locked versions (layer cached)
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# Copy source and build static export
COPY frontend/ ./
RUN npm run build
# Produces: /build/frontend/out/


# ─── Stage 2: Python runtime ─────────────────────────────────────────────────
FROM python:3.12-slim

# Install uv from official image
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app/backend

# Install Python dependencies (layer cached — runs before source copy)
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-install-project

# Copy backend source and install the project itself
COPY backend/ ./
RUN uv sync --frozen

# Copy the Next.js export into backend/static/
# main.py resolves: Path(__file__).parent.parent / "static" → /app/backend/static/
COPY --from=frontend-builder /build/frontend/out/ ./static/

# Create the database directory (volume-mounted at runtime)
RUN mkdir -p /app/db

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
