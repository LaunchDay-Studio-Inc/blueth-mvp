# Deploy: GCP VM + Cloud SQL + HTTPS

Step-by-step guide for deploying Blueth City backend to a Google Cloud VM
with Cloud SQL PostgreSQL (private IP) and HTTPS via Caddy.

---

## Architecture

```
Internet  ──▶  Caddy (ports 80/443)  ──▶  API (port 3001)  ──▶  Cloud SQL Auth Proxy ──▶  Cloud SQL
                     │                          │
                     │                    ┌─────┴──────┐
                     │                    │  Scheduler  │
                     │                    │  Tick       │
                     │                    └────────────┘
                     │
              All inside Docker network (blueth-net)
              Cloud SQL Proxy: no host port binding
```

---

## Preflight Checklist

- [ ] GCP project with billing enabled
- [ ] Cloud SQL PostgreSQL instance created (`blueth-city:us-central1:blueth-postgresql`)
- [ ] Cloud SQL database created (`blueth_city`)
- [ ] Cloud SQL user created (`blueth` with strong password)
- [ ] **Private IP enabled** on Cloud SQL instance
- [ ] VM and Cloud SQL in same VPC (default network)
- [ ] VM service account has **Cloud SQL Client** role
- [ ] VM firewall allows TCP 80 and 443 from `0.0.0.0/0`
- [ ] Docker and Docker Compose installed on VM
- [ ] Git installed on VM
- [ ] `deploy/.env` created with real values

---

## 1. IAM: Grant Cloud SQL Client Role

The VM's service account needs the `roles/cloudsql.client` role to authenticate
with Cloud SQL Auth Proxy without a key file.

```bash
# Find the VM's service account email
gcloud compute instances describe blueth-mvp \
  --zone=us-central1-a \
  --format='get(serviceAccounts[0].email)'

# Grant the role (replace with actual email)
gcloud projects add-iam-policy-binding blueth-city \
  --member="serviceAccount:YOUR_SA_EMAIL" \
  --role="roles/cloudsql.client"
```

---

## 2. Create Cloud SQL Database and User

```bash
# Connect to Cloud SQL via gcloud (from Cloud Shell or local machine)
gcloud sql connect blueth-postgresql --user=postgres

# Inside psql:
CREATE USER blueth WITH PASSWORD 'YOUR_STRONG_PASSWORD';
CREATE DATABASE blueth_city OWNER blueth;
\q
```

---

## 3. Install Docker on the VM

```bash
# SSH into the VM
gcloud compute ssh blueth-mvp --zone=us-central1-a

# Install Docker
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin

# Add your user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify
docker compose version
```

---

## 4. Clone the Repo

```bash
cd /opt
sudo mkdir -p blueth && sudo chown $USER:$USER blueth
cd /opt/blueth
git clone https://github.com/YOUR_ORG/blueth-mvp.git .
git checkout ship/itch-vm-android
```

---

## 5. Configure Environment

```bash
cp deploy/.env.example deploy/.env
```

Edit `deploy/.env` with real values:

```bash
# Required changes:
DB_PASSWORD=YOUR_STRONG_PASSWORD_HERE

# Choose your domain:
# Option 1 — Real domain (requires DNS A record → 34.42.121.95):
API_DOMAIN=api.yourdomain.com

# Option 2 — Quick start (no DNS needed):
API_DOMAIN=api.34.42.121.95.sslip.io

# Set CORS for your itch.io game:
ALLOWED_ORIGINS=*.itch.io,*.hwcdn.net,https://yourgame.itch.io
```

### HTTPS Options

| Option | Domain | DNS Required | TLS |
|--------|--------|-------------|-----|
| **1. Real domain** | `api.yourdomain.com` | Yes — A record → `34.42.121.95` | Caddy auto-provisions Let's Encrypt cert |
| **2. sslip.io** | `api.34.42.121.95.sslip.io` | No — sslip.io resolves automatically | Caddy auto-provisions Let's Encrypt cert |

Both options provide real HTTPS certificates. Option 2 is fastest to get started.

---

## 6. Open Firewall Ports

```bash
# Allow HTTP and HTTPS from anywhere
gcloud compute firewall-rules create allow-http-https \
  --allow=tcp:80,tcp:443 \
  --source-ranges=0.0.0.0/0 \
  --target-tags=http-server,https-server \
  --description="Allow HTTP and HTTPS"

# Tag the VM (if not already tagged)
gcloud compute instances add-tags blueth-mvp \
  --zone=us-central1-a \
  --tags=http-server,https-server
```

---

## 7. Run Migrations

Migrations run automatically as a one-shot service when you start docker compose.
The `api`, `scheduler`, and `tick` services wait for migrations to complete.

To run migrations manually (without starting other services):

```bash
cd /opt/blueth
docker compose -f deploy/docker-compose.cloud.yml run --rm migrate
```

### Seed Data

Seed data is embedded in migration `007_seed_data.sql` and applied automatically.
It is idempotent — re-running migrations will not duplicate seed data (the migration
runner tracks applied files in the `_migrations` table).

### Rollback

If a migration fails:
1. It automatically rolls back the failing file (each migration runs in a transaction).
2. Previously applied migrations are NOT rolled back.
3. Fix the failing migration SQL, then re-run.
4. The `_migrations` table shows which migrations have been applied:
   ```sql
   SELECT * FROM _migrations ORDER BY id;
   ```

---

## 8. Start Everything

```bash
cd /opt/blueth
docker compose -f deploy/docker-compose.cloud.yml up -d --build
```

This starts:
1. **cloudsql-proxy** — connects to Cloud SQL (waits for health check)
2. **migrate** — runs pending migrations (one-shot, then exits)
3. **api** — Fastify server on port 3001 (internal)
4. **scheduler** — polls for due actions every 5s
5. **tick** — processes game ticks every 10s
6. **caddy** — HTTPS reverse proxy on ports 80/443

---

## 9. Verify Health

```bash
# Check all containers are running
docker compose -f deploy/docker-compose.cloud.yml ps

# API health (internal)
docker compose -f deploy/docker-compose.cloud.yml exec api \
  wget -qO- http://localhost:3001/health

# Database health (internal)
docker compose -f deploy/docker-compose.cloud.yml exec api \
  wget -qO- http://localhost:3001/health/db

# HTTPS health (external)
curl https://api.34.42.121.95.sslip.io/health
curl https://api.34.42.121.95.sslip.io/health/db
```

---

## 10. Tail Logs

```bash
# All services
docker compose -f deploy/docker-compose.cloud.yml logs -f

# Specific service
docker compose -f deploy/docker-compose.cloud.yml logs -f api
docker compose -f deploy/docker-compose.cloud.yml logs -f tick
docker compose -f deploy/docker-compose.cloud.yml logs -f caddy
docker compose -f deploy/docker-compose.cloud.yml logs -f cloudsql-proxy
```

---

## 11. Update (Deploy New Code)

```bash
cd /opt/blueth
git pull origin ship/itch-vm-android
docker compose -f deploy/docker-compose.cloud.yml up -d --build
```

The `migrate` service runs automatically on each `up`, applying any new migrations.

To update without rebuilding (if only config changed):

```bash
docker compose -f deploy/docker-compose.cloud.yml up -d
```

---

## 12. Stop Everything

```bash
docker compose -f deploy/docker-compose.cloud.yml down
```

To also remove volumes (Caddy certs, NOT database — DB is in Cloud SQL):

```bash
docker compose -f deploy/docker-compose.cloud.yml down -v
```

---

## Security Notes

- **Cloud SQL Auth Proxy** binds to `0.0.0.0:5432` inside the Docker network only.
  There is NO host port mapping — the database is not accessible from outside Docker.
- **Caddy** handles TLS termination. The API container only serves plain HTTP internally.
- **VM service account** authentication means no JSON key files on disk.
- The config sanity check at startup prints a masked `DATABASE_URL` (password replaced with `***`).

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `cloudsql-proxy` exits immediately | Missing IAM role | Grant `roles/cloudsql.client` to VM service account |
| `migrate` fails with connection refused | Proxy not ready | Check `cloudsql-proxy` logs; ensure Cloud SQL is running |
| Caddy shows "certificate error" | DNS not propagated | Wait for DNS, or use sslip.io option |
| API returns 502 | API container not healthy | Check `docker compose logs api` |
| CORS errors from itch.io | `ALLOWED_ORIGINS` misconfigured | Ensure `*.itch.io,*.hwcdn.net` is in the env var |
| `Config ERROR: DATABASE_URL is not set` | Missing env var | Check `deploy/.env` exists and is correct |
