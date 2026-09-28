# OpenLab Cloud

📖 **คู่มือภาษาไทย:** [docs/SETUP.th.md](docs/SETUP.th.md)

**Build. Run. Experiment.** An open source private cloud and virtual lab console for VMs, Linux containers and virtual networks.

> ⚠️ **Mock Provider.** No hypervisor is connected yet. VM and container operations are simulated by the mock adapter; everything else (auth, RBAC, quotas, jobs, audit) is real and persisted in PostgreSQL. The UI shows a "Mock Provider" badge.

## Run

```bash
npm install
cp .env.example .env          # then fill in secrets (see docs/SETUP.th.md)
npm run db:up                 # PostgreSQL in Docker, or: npm run db:local (no Docker, keep it running)
npm run db:deploy && npm run db:seed
npm run dev                   # http://localhost:3000 — admin@openlab.local / $SEED_ADMIN_PASSWORD
```

## Architecture

```
Web UI (Next.js App Router, React, Tailwind)
  → REST API  /api/v1/*        (Zod validation, error envelope)
    → Service layer            src/lib/server/instances.ts  (quota check, audit, jobs)
      → Job queue              src/lib/server/jobs.ts       (202 + job id, UI polls)
        → Provider registry    src/lib/providers/index.ts
          → VirtualizationProvider adapters
             mock.ts     ✅ working simulation
             incus.ts    ⏳ stub + API mapping (Phase 3)
             libvirt.ts  ⏳ stub (Phase 3)
```

Rules the code follows:
- The UI calls the API only through `src/lib/api/client.ts`. It never calls providers.
- Business logic (quota, RBAC, audit) sits above the provider. Adapters only translate calls to a hypervisor.
- Long operations (create, clone, snapshot, delete, power) return `202` with a Job. They never block the request.

## Folders

| Path | Purpose |
|---|---|
| `src/app/(console)` | Console pages (dashboard, vms, containers, nodes, storage, networks, firewall, monitoring, users, settings, audit-logs) |
| `src/app/api/v1` | REST endpoints: instances, power, clone, snapshots, jobs, audit-logs, system |
| `src/components/ui` | Base components in the style of shadcn/ui (Radix + Tailwind) |
| `src/lib/types` | Domain types, shaped the same as the production API |
| `src/lib/providers` | Provider interface and adapters |
| `src/lib/server` | Store, jobs, services, read queries (server-only) |
| `src/lib/mock` | Seed data (deterministic) |
| `prisma/schema.prisma` | PostgreSQL schema for Phase 2 |

## Roadmap

- **Phase 1 (this):** UI/UX, mock API with production-shaped contracts.
- **Phase 2 (done):** PostgreSQL + Prisma, Auth.js (Argon2, secure cookies, CSRF), RBAC enforcement, durable job queue (pg-boss/BullMQ) + worker, SSE job progress, rate limiting, encrypted node credentials, Docker Compose.
- **Phase 3:** Incus provider, then libvirt/KVM, noVNC and xterm.js consoles, Prometheus/Grafana. Proxmox and Docker adapters later.
