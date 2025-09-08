# PRP-002: Docker Development Environment

## Status

Queue

## Priority

Critical

## Overview

Containerize the Next.js application using Docker with Brett Fisher's Node.js best practices. All future development will occur within containers to ensure consistency and avoid host machine conflicts.

## Prerequisites

- PRP-001: Next.js Project Setup completed

## Success Criteria

- [ ] Multi-stage Dockerfile with development and production targets
- [ ] Docker Compose for local development orchestration
- [ ] Hot-reload working in development container
- [ ] Proper user permissions (node user, not root)
- [ ] Volume mounts configured correctly
- [ ] Health checks implemented
- [ ] Container security scanning integrated
- [ ] VS Code devcontainer support
- [ ] PostgreSQL and Redis containers configured
- [ ] No file permission issues between host and container

## Technical Requirements

### Multi-Stage Dockerfile (Brett Fisher's Best Practices)

```dockerfile
# Dockerfile
# syntax=docker/dockerfile:1

# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Enable pnpm
RUN corepack enable
RUN corepack prepare pnpm@latest --activate

# Install dependencies
RUN pnpm install --frozen-lockfile

# Stage 2: Development
FROM node:20-alpine AS dev
WORKDIR /app
RUN apk add --no-cache git

# Enable pnpm
RUN corepack enable
RUN corepack prepare pnpm@latest --activate

# Create node user and set permissions
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Copy dependencies from deps stage
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --chown=nextjs:nodejs . .

USER nextjs
EXPOSE 3000
ENV NODE_ENV=development
ENV HOSTNAME="0.0.0.0"
CMD ["pnpm", "dev"]

# Stage 3: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Enable pnpm
RUN corepack enable
RUN corepack prepare pnpm@latest --activate

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# Stage 4: Production
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Copy necessary files
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

### Docker Compose Configuration

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build:
      context: .
      target: dev
      args:
        - NODE_ENV=development
    volumes:
      # Mount source code
      - .:/app
      # Prevent node_modules from being overwritten
      - /app/node_modules
      # Prevent .next from being overwritten
      - /app/.next
    ports:
      - '3000:3000'
    environment:
      - NODE_ENV=development
      - WATCHPACK_POLLING=true
      - NEXT_TELEMETRY_DISABLED=1
      - DATABASE_URL=postgresql://geolarp:localdev@postgres:5432/geolarp_dev
      - REDIS_URL=redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ['CMD', 'wget', '-q', '--spider', 'http://localhost:3000']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    stdin_open: true
    tty: true

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: geolarp_dev
      POSTGRES_USER: geolarp
      POSTGRES_PASSWORD: localdev
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - '5432:5432'
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U geolarp']
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
```

### Docker Ignore File

```
# .dockerignore
.git
.gitignore
README.md
.next
.DS_Store
node_modules
npm-debug.log
.env.local
.env.*.local
coverage
.nyc_output
.idea
.vscode
*.swp
*.swo
*.swn
.vercel
```

### VS Code Dev Container Configuration

```json
// .devcontainer/devcontainer.json
{
  "name": "GeoLARP Development",
  "dockerComposeFile": "../docker-compose.yml",
  "service": "app",
  "workspaceFolder": "/app",
  "customizations": {
    "vscode": {
      "extensions": [
        "dbaeumer.vscode-eslint",
        "esbenp.prettier-vscode",
        "bradlc.vscode-tailwindcss",
        "prisma.prisma",
        "ms-azuretools.vscode-docker",
        "eamodio.gitlens",
        "mikestead.dotenv"
      ],
      "settings": {
        "editor.formatOnSave": true,
        "editor.defaultFormatter": "esbenp.prettier-vscode",
        "editor.codeActionsOnSave": {
          "source.fixAll.eslint": true
        },
        "terminal.integrated.defaultProfile.linux": "sh"
      }
    }
  },
  "postCreateCommand": "pnpm install",
  "forwardPorts": [3000, 5432, 6379],
  "remoteUser": "nextjs",
  "features": {
    "ghcr.io/devcontainers/features/git:1": {},
    "ghcr.io/devcontainers/features/github-cli:1": {}
  }
}
```

### Development Scripts Update

```json
// package.json additions
{
  "scripts": {
    "docker:dev": "docker-compose up",
    "docker:dev:build": "docker-compose up --build",
    "docker:down": "docker-compose down",
    "docker:clean": "docker-compose down -v",
    "docker:shell": "docker-compose exec app sh",
    "docker:logs": "docker-compose logs -f app",
    "docker:build:prod": "docker build --target runner -t geolarp:latest .",
    "docker:scan": "docker scan geolarp:latest"
  }
}
```

### Makefile for Common Commands

```makefile
# Makefile
.PHONY: up down build clean shell logs

up:
	docker-compose up -d

down:
	docker-compose down

build:
	docker-compose build

clean:
	docker-compose down -v

shell:
	docker-compose exec app sh

logs:
	docker-compose logs -f app

restart:
	docker-compose restart app

test:
	docker-compose exec app pnpm test

lint:
	docker-compose exec app pnpm lint

typecheck:
	docker-compose exec app pnpm type-check
```

### Health Check Implementation

```typescript
// src/app/api/health/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  // Check database connection
  let dbStatus = 'unknown';
  try {
    // Add actual database check here when Prisma is set up
    dbStatus = 'healthy';
  } catch (error) {
    dbStatus = 'unhealthy';
  }

  // Check Redis connection
  let redisStatus = 'unknown';
  try {
    // Add actual Redis check here when Redis client is set up
    redisStatus = 'healthy';
  } catch (error) {
    redisStatus = 'unhealthy';
  }

  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: dbStatus,
      redis: redisStatus,
    },
  };

  return NextResponse.json(health);
}
```

## Security Considerations

- Never run containers as root user
- Use multi-stage builds to minimize attack surface
- Scan images with Trivy or Snyk regularly
- Keep base images updated
- Use secrets management for sensitive data
- Implement resource limits in production

## Development Workflow

```bash
# Initial setup
git clone <repo>
cd geolarp
docker-compose up -d

# Daily development
docker-compose up -d          # Start services
docker-compose logs -f app    # View logs
docker-compose exec app sh    # Enter container
docker-compose down           # Stop services

# Clean restart
docker-compose down -v        # Remove volumes
docker-compose up --build     # Rebuild and start
```

## File Permissions Solution

- Use `--chown=nextjs:nodejs` in COPY commands
- Set USER before running commands
- Use named volumes for node_modules
- Ensure UID/GID match between container and host if needed

## Testing Requirements

- Container builds successfully in < 2 minutes
- Hot-reload responds in < 1 second
- No permission errors when editing files
- Health checks pass consistently
- Database and Redis connections work
- VS Code devcontainer opens correctly

## Acceptance Criteria

1. Development happens entirely in Docker
2. No Node.js installation required on host
3. Single command starts entire environment
4. File changes reflect immediately
5. Database persists between restarts
6. Production build is optimized (< 200MB)

## Dependencies

- Docker 24.0+
- Docker Compose 2.20+
- BuildKit enabled
- 8GB RAM minimum for development

## Troubleshooting Guide

### Permission Issues

```bash
# Fix ownership if needed
docker-compose exec app chown -R nextjs:nodejs /app
```

### Port Conflicts

```bash
# Check what's using ports
lsof -i :3000
lsof -i :5432
lsof -i :6379
```

### Clean Restart

```bash
# Complete cleanup and rebuild
docker-compose down -v
docker system prune -f
docker-compose up --build
```

---

_Created: 2024-01-08_
_Updated: 2024-01-08_
_Estimated effort: 1 day_
