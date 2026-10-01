**System Staff Smoke Report**

- **Purpose**: Smoke tests for System Staff role verifying read-only flows: login, queue, feedback list/detail, conversation panel, duplicate detection, assignment history, and area alert management.

- **Account**: kvietanh123@gmail.com / 123456789 (system staff)

- **Files**:
  - tests/smoke/system-staff/system-staff.spec.ts

- **Checks performed**:
  - Login completes and user is redirected to staff landing (/staff/queue)
  - Staff queue page loads (hero/title)
  - Management feedback list page loads
  - Feedback detail page opens from list and loads admin hero
  - Conversation/exchange tab opens and displays existing messages if present
  - Internal note badge presence is checked (read-only)
  - Duplicate detection page loads and duplicate detail opens if candidates exist
  - Assignment history page loads
  - Area alert management page loads

- **Read-only rules enforced**:
  - Tests only navigate and assert visibility; they do not click action buttons that would change data (assign, update status, create notes).
  - When encountering interactive controls (assign, update, create), tests avoid clicking buttons that trigger mutations.

- **How to run**:

```bash
cd apps/web
pnpm exec playwright test --project=smoke tests/smoke/system-staff
```

- **Notes & Observations**:
  - Tests are tolerant of empty lists (skip open/detail steps) to avoid false failures in low-data environments.
  - Parser errors like "Unexpected token '<'" may be filtered in smoke helpers if they appear due to HTML responses on API endpoints; investigate if persistent.

- **Next**:
  - Run the full `smoke` project to validate across roles and capture HTML report via `pnpm exec playwright show-report tests/results/html`.
