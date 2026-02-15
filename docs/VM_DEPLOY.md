# VM Deployment Quick Reference

## SSH Access

```bash
ssh blueth
```

SSH config (`~/.ssh/config`):
```
Host blueth
  HostName 34.42.121.95
  User bejiepaulo
  IdentityFile ~/.ssh/blueth-vm-key
```

## App Location

```
/opt/blueth/app          # repo root
```

## Stack

| Service     | Container          | Port  |
|-------------|--------------------|-------|
| PostgreSQL  | app-postgres-1     | 5432  |
| API         | app-api-1          | 3001  |
| Web         | app-web-1          | 3000  |
| Scheduler   | app-scheduler-1    | —     |
| Tick Worker | app-tick-1         | —     |
| Caddy       | app-caddy-1        | 80/443|

Compose file: `docker-compose.prod.yml`

## Common Commands

### Deploy latest from main

```bash
ssh blueth
cd /opt/blueth/app
git pull origin main
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d
```

### Check status

```bash
# Container health
docker ps --format 'table {{.Names}}\t{{.Status}}'

# API health
curl -s http://localhost:3001/health | jq
curl -s http://localhost:3001/ready

# Logs
docker logs app-api-1 --tail 20
docker logs app-scheduler-1 --tail 10
docker logs app-tick-1 --tail 10
docker logs app-web-1 --tail 10
```

### Restart without rebuild

```bash
docker compose -f docker-compose.prod.yml restart
```

### Full stop / start

```bash
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
```

### Database shell

```bash
docker exec -it app-postgres-1 psql -U blueth -d blueth_city
```

## Origin

```
git@github.com:LaunchDay-Studio-Inc/blueth-mvp.git
```
