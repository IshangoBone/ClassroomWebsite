# ClassroomWebsite

Current public Version 1 files live at the repository root. Version 2 lives in
`v2/` and uses Supabase for auth, database, RLS, RPCs, and storage.

Useful Version 2 docs:

- `v2/LOCAL_DEVELOPMENT.md`
- `v2/V2_WORKFLOW.md`
- `v2/DEPLOYMENT_STRATEGY.md`
- `v2/V1_PROTECTION_PLAN.md`
- `v2/SUPABASE_SETUP.md`
- `v2/ROLE_PERMISSIONS.md`
- `v2/FILE_ACCESS_RULES.md`

Local V2 startup:

```bash
cd v2
python3 -m http.server 4173 --bind 127.0.0.1
```

Open:

```text
http://127.0.0.1:4173/pages/dashboard/index.html
```

For first-time local configuration, ignored env files, and safe V2 testing
rules, see `v2/LOCAL_DEVELOPMENT.md`.
