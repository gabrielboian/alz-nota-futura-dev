FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY . .

EXPOSE 8000

# Persist the SQLite DB on /app/data (mounted as a docker volume) by symlinking
# the path Django expects (/app/db.sqlite3) to that volume.
CMD ["sh", "-c", "mkdir -p /app/data && touch /app/data/db.sqlite3 && ln -sf /app/data/db.sqlite3 /app/db.sqlite3 && python manage.py migrate --noinput && python manage.py runserver 0.0.0.0:8000"]
