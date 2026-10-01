**Access Control Smoke Report**

- **Purpose**: Verify route-level protection for authenticated roles and ensure unauthorized access is blocked.

- **Accounts tested**:
  - Service User: nguyengiauzxc@gmail.com / nguyenhuugiau
  - System Staff: kvietanh123@gmail.com / 123456789
  - Interaction Manager: xbg4623@gmail.com / 123456789

- **Files**:
  - tests/smoke/access-control/access-control.spec.ts

- **Checks performed**:
  - Service User cannot access `/staff/*`, `/manager/*`, or `/admin/*`
  - System Staff cannot access `/admin/*`
  - Interaction Manager cannot access `/admin/*`

- **Expected failures**:
  - Redirect to dashboard
  - Redirect to login
  - Display access denied / no permission page

- **Read-only rules enforced**:
  - Tests only navigate to routes and assert block behavior.
  - No data mutations, account changes, or configuration updates are performed.

- **How to run**:

```bash
cd apps/web
pnpm exec playwright test --project=smoke tests/smoke/access-control
```

- **Notes & Observations**:
  - Unauthorized route checks rely on either a redirect away from the blocked path or a visible access-denied message.
  - This suite is intended for stable security regression coverage of role-based route protection.
