# Deployment Status

## Production: Cloud SQL via Auth Proxy

Production **MUST** use `deploy/docker-compose.cloud.yml`.

- **Cloud SQL instance:** `blueth-city:us-central1:blueth-postgresql`
- **Auth Proxy:** `cloudsql-proxy` service tunnels to Cloud SQL on port 5432 (internal only, never exposed to host)
- **DATABASE_URL:** `postgres://$DB_USER:$DB_PASSWORD@cloudsql-proxy:5432/$DB_NAME`
- **Env file:** `deploy/.env` (set `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `CLOUDSQL_INSTANCE_CONNECTION_NAME`, `API_DOMAIN`, `WEB_DOMAIN`)
- **HTTPS:** Caddy auto-TLS via `API_DOMAIN` and `WEB_DOMAIN`
- **Prerequisite:** VM service account must have the Cloud SQL Client IAM role

### Start production

```bash
cd /opt/blueth
docker compose -f deploy/docker-compose.cloud.yml up -d
```

## Development: Local Postgres

Development uses the root `docker-compose.yml` which runs a local Postgres 16 container.

- **Data volume:** `postgres_data` (on-disk, VM-local)
- **DATABASE_URL:** `postgres://blueth:blueth_dev_password@postgres:5432/blueth_city`
- **No TLS, no auth proxy**

### Start development

```bash
docker compose up -d
```

## Key difference

| | Production | Development |
|---|---|---|
| Compose file | `deploy/docker-compose.cloud.yml` | `docker-compose.yml` |
| Database | Cloud SQL (GCP managed) | Local Postgres container |
| Connection | `cloudsql-proxy:5432` | `postgres:5432` |
| Data persistence | Cloud SQL (survives VM delete) | Docker volume (VM-local) |
| HTTPS | Caddy auto-TLS | None |
