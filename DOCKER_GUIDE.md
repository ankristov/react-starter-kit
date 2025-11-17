# Docker Deployment Guide

This guide explains how to use Docker to run the Forcefield app in different environments.

## Quick Start

### Development Mode (with hot reload)
```bash
docker-compose up forcefield-dev
```
- Frontend: http://localhost:5174
- Video interpolation server: http://localhost:3002
- Hot reload enabled ✅
- Perfect for development

### Production Mode (optimized)
```bash
docker-compose up forcefield-prod
```
- Frontend: http://localhost
- Video interpolation server: http://localhost:3002
- Nginx reverse proxy with API routing
- Optimized for performance

### Frontend Only (no video smoothing)
```bash
docker-compose up forcefield-frontend
```
- Frontend: http://localhost:8080
- No server-side processing
- Lightweight option

## Docker Images

### Development Image (`Dockerfile.dev`)
- **Base:** Node 20 Alpine
- **Includes:** FFmpeg, npm, dev dependencies
- **Size:** ~500MB
- **Best for:** Local development with hot reload
- **Command:** Runs both Vite dev server and interpolation server

### Production Image (`Dockerfile`)
- **Stages:** Multi-stage build (Node → Node + Nginx)
- **Base:** Node 20 Alpine + Nginx Alpine
- **Includes:** FFmpeg, nginx, production dependencies
- **Size:** ~200MB (optimized)
- **Best for:** Production deployment
- **Features:**
  - Nginx reverse proxy
  - API request routing to interpolation server
  - Static file serving for React app
  - Health checks

## Manual Docker Commands

### Build Development Image
```bash
docker build -f Dockerfile.dev -t forcefield:dev .
```

### Run Development Container
```bash
docker run -p 5174:5174 -p 3002:3002 \
  -v $(pwd):/app \
  -v /app/node_modules \
  forcefield:dev
```

### Build Production Image
```bash
docker build -t forcefield:latest .
```

### Run Production Container
```bash
docker run -p 80:80 -p 3002:3002 \
  --name forcefield \
  --restart unless-stopped \
  forcefield:latest
```

## Docker Compose Services

| Service | Mode | Frontend | Server | Port(s) |
|---------|------|----------|--------|---------|
| `forcefield-dev` | Dev | Vite (hot reload) | Node + FFmpeg | 5174, 3002 |
| `forcefield-prod` | Prod | Nginx (static) | Node + FFmpeg | 80, 3002 |
| `forcefield-frontend` | Prod | Nginx only | None | 8080 |
| `forcefield-interpolate` | Prod | None | Node + FFmpeg | 3002 |

## Usage Scenarios

### Scenario 1: Full Stack Development
```bash
docker-compose up forcefield-dev
# All services running, hot reload enabled
```

### Scenario 2: Full Stack Production
```bash
docker-compose up forcefield-prod
# Optimized for performance and stability
```

### Scenario 3: Frontend Only Testing
```bash
docker-compose up forcefield-frontend
# Test frontend without backend
```

### Scenario 4: Video Smoothing Microservice
```bash
docker-compose up forcefield-interpolate
# Run only the FFmpeg interpolation service on port 3002
```

### Scenario 5: Multi-Environment Testing
```bash
# Terminal 1: Development
docker-compose up forcefield-dev

# Terminal 2: Production (different ports)
docker-compose -f docker-compose.yml up forcefield-prod -d

# Terminal 3: Frontend only
docker-compose up forcefield-frontend -d
```

## Environment Variables

### Development
```bash
NODE_ENV=development
```

### Production
```bash
NODE_ENV=production
```

## Volumes

### Development (Hot Reload)
```yaml
volumes:
  - .:/app                    # Mount entire project
  - /app/node_modules         # Use container's node_modules
  - /app/server/node_modules  # Use container's server node_modules
```

### Production
No volumes - uses built artifacts only

## Network

### Docker Compose Network
Services can communicate via service names:
- Frontend can call `http://forcefield-interpolate:3002/api/interpolate`
- Nginx proxies to `http://localhost:3002`

### Ports Exposed
- `5174` - Vite dev server (dev only)
- `80` - Nginx frontend (prod)
- `3002` - Interpolation/FFmpeg server

## Health Checks

Production container includes health checks:
```bash
curl http://localhost/
```

Check status:
```bash
docker ps  # See container health status
```

## Troubleshooting

### Port Already in Use
```bash
# Kill existing container
docker-compose down

# Or use different ports
docker run -p 5175:5174 -p 3003:3002 forcefield:dev
```

### View Container Logs
```bash
docker-compose logs -f forcefield-dev
```

### Access Running Container
```bash
docker exec -it <container-id> sh
```

### Build Cache Issues
```bash
docker-compose build --no-cache forcefield-dev
```

### FFmpeg Not Found
Ensure FFmpeg is installed in the image (it should be with `apk add ffmpeg`)

## Performance Optimization

### Development
- Hot reload enabled
- Full source code available
- Good for debugging

### Production
- Multi-stage build reduces image size
- Static files served by Nginx
- FFmpeg processes in background
- Health checks enabled

## Image Sizes

```bash
# Check image sizes
docker images forcefield:*

# Example output:
# forcefield  dev     500MB
# forcefield  latest  200MB (optimized)
```

## Cleanup

### Remove Stopped Containers
```bash
docker-compose down
```

### Remove Images
```bash
docker rmi forcefield:dev forcefield:latest
```

### Clean Everything
```bash
docker system prune -a
```

## Best Practices

✅ **DO:**
- Use `docker-compose` for local development
- Use production Dockerfile for deployments
- Set resource limits for containers
- Use health checks in production
- Tag images with versions

❌ **DON'T:**
- Run dev image in production
- Mount entire project in production
- Ignore health check failures
- Leave containers running without monitoring

## Deployment

### Local Docker
```bash
docker-compose up -d forcefield-prod
docker-compose logs -f
```

### Docker Swarm
```bash
docker swarm init
docker stack deploy -c docker-compose.yml forcefield
docker stack services forcefield
```

### Kubernetes (using docker images)
Create deployment YAML with image `forcefield:latest`

## References

- Docker Docs: https://docs.docker.com/
- Docker Compose: https://docs.docker.com/compose/
- Nginx Config: https://nginx.org/en/docs/
- Alpine Linux: https://alpinelinux.org/
