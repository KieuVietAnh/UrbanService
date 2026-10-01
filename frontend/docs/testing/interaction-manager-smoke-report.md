# Interaction Manager Smoke Report

- **Purpose**: Smoke tests for Interaction Manager role verifying read-only flows across approval inbox, approval detail, interaction monitoring, SLA analytics, sentiment dashboard, and heatmap dashboard.
- **Account**: xbg4623@gmail.com / 123456789 (interaction manager)
- **Files**:
  - tests/smoke/interaction-manager/interaction-manager.spec.ts
- **Checks performed**:
  - Login completes and user is redirected to the manager landing experience.
  - Interaction monitoring route loads.
  - Approval inbox route loads.
  - Approval detail opens from the first available item when data exists.
  - SLA analytics page loads.
  - Sentiment dashboard page loads.
  - Heatmap dashboard page loads.
- **Read-only rules enforced**:
  - Tests only navigate and assert page visibility; they do not approve, reject, rework, or mutate data.
  - When approval items are absent, the detail-step is skipped gracefully.
- **How to run**:

```bash
cd apps/web
pnpm exec playwright test --project=smoke tests/smoke/interaction-manager
```

- **Notes & Observations**:
  - The suite is resilient to empty approval queues and filters known benign 405/HTML parser noise in smoke helpers.
  - If the approval inbox is empty, the detail test skips rather than failing.
