# ── Stage 1: Builder ──────────────────────────────────────────────────────────
FROM python:3.12-slim AS builder

WORKDIR /build

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency manifests first for layer-cache efficiency
COPY pyproject.toml ./

# Install dependencies into an explicit prefix so we can copy them cleanly
RUN pip install --upgrade pip \
    && pip install --prefix=/install . --no-cache-dir

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM python:3.12-slim AS runtime

WORKDIR /app

# Create a non-root user and group
RUN groupadd --system appgroup && useradd --system --gid appgroup --no-create-home appuser

# Copy installed Python packages from the builder stage
COPY --from=builder /install /usr/local

# Copy application source
COPY app/ ./app/

# Ensure the non-root user owns the working directory
RUN chown -R appuser:appgroup /app

USER appuser

# Expose the default API port (overridable via API_PORT env var)
EXPOSE 8000

# Use exec form so the process receives OS signals correctly
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
