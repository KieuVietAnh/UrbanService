**System Administrator Smoke Report**

- **Purpose**: Smoke tests for the System Administrator role verifying read-only admin configuration and monitoring views.

- **Account**: anhkvse182347@fpt.edu.vn / 123456789 (system administrator)

- **Files**:
  - tests/smoke/system-admin/system-admin.spec.ts

- **Checks performed**:
  - Login completes and administrator context loads successfully
  - User Management page loads and displays the admin hero heading
  - Feedback Management page loads and displays the admin hero heading
  - Category Management page loads and displays the admin hero heading
  - SLA Configuration page loads and displays the admin hero heading
  - Audit Log page loads and displays the admin hero heading
  - Performance Dashboard page loads and displays the admin hero heading

- **Read-only rules enforced**:
  - Tests only navigate and assert visibility, avoiding any create/update/delete actions.
  - No user creation, deletion, role changes, SLA updates, or configuration mutations are performed.
  - If pages require data and lists are empty, the smoke flow still validates page load and status messaging rather than performing edits.

- **How to run**:

```bash
cd apps/web
pnpm exec playwright test --project=smoke tests/smoke/system-admin
```

- **Notes & Observations**:
  - Page checks rely on stable admin hero headings for each route.
  - Common smoke helper filters are used to ignore benign `405` or HTML parser errors from API responses.
  - This suite is designed to validate only administrative read-only access and page load behavior.
