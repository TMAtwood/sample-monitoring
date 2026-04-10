#!/bin/sh
set -e

# Wait for MinIO to be ready
until mc alias set local http://minio:9000 "${MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD}" 2>/dev/null; do
  echo "Waiting for MinIO..."
  sleep 2
done

# Create bucket if it doesn't exist
if ! mc ls local/"${MINIO_BUCKET}" 2>/dev/null; then
  mc mb local/"${MINIO_BUCKET}"
  echo "Created bucket: ${MINIO_BUCKET}"
else
  echo "Bucket already exists: ${MINIO_BUCKET}"
fi

# Create Loki bucket if it doesn't exist
if ! mc ls local/loki-data 2>/dev/null; then
  mc mb local/loki-data
  echo "Created bucket: loki-data"
else
  echo "Bucket already exists: loki-data"
fi

# Create Tempo bucket if it doesn't exist
if ! mc ls local/tempo-data 2>/dev/null; then
  mc mb local/tempo-data
  echo "Created bucket: tempo-data"
else
  echo "Bucket already exists: tempo-data"
fi
