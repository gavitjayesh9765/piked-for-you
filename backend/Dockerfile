# PickDForYou API — production image.
#
# Docker rather than Render's native Python runtime for one concrete reason:
# `python-magic` (pyproject.toml) binds to libmagic, a SYSTEM library that pip
# cannot install. On a buildpack the import fails at runtime, and it fails
# inside media upload — the one path you would not notice until a user tried it.
# Here it is one apt line.
#
# Pillow is not built from source: the manylinux wheels are prebuilt, so no
# compiler toolchain is needed and the image stays small.

FROM python:3.11-slim

# libmagic1  -> python-magic, real MIME sniffing on uploads (spec §29, §45)
# curl       -> container healthcheck below
RUN apt-get update \
    && apt-get install -y --no-install-recommends libmagic1 curl \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Dependency layer first so application edits do not reinstall the world.
COPY pyproject.toml ./
COPY app ./app
RUN pip install --no-cache-dir .

# Never run as root. Render does not enforce this; nothing here needs it.
RUN useradd --create-home --uid 10001 appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS "http://127.0.0.1:${PORT:-8000}/health" || exit 1

# ONE worker, deliberately.
#
# Two reasons. Render's Starter instance is 512MB, and a second worker doubles
# the SQLAlchemy pool, Pillow's decode buffers and the interpreter itself.
# More importantly the price-scrape runs use FastAPI BackgroundTasks
# (app/modules/admin/pricing.py) — in-process work that outlives the response.
# Extra workers do not share that state, so scaling out here buys contention,
# not throughput. Scale up the instance before you scale out the workers.
#
# $PORT is injected by Render; the default keeps `docker run` working locally.
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1 --proxy-headers --forwarded-allow-ips='*'"]
