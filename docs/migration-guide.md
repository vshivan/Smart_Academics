# SAAP — Migration Guide: v1 → v2 (Production-Grade)

## What Changed

| Area | Before | After |
|------|--------|-------|
| Auth | Token stored only in localStorage | Token in localStorage + cookie (for middleware) |
| RBAC | `require_role()` existed but not applied to routes | All sensitive routes guarded by `require_permission()` |
| JWT payload | `{user_id, email, role}` | `{user_id, email, role, permissions: [...]}` |
| API responses | Raw dicts | Standardised `{success, data, error, meta}` envelope |
| Error handling | Raw 500s leaked to clients | Global exception handler, structured errors |
| Logging | `basicConfig` plain text | Structured JSON logging (production) |
| Security headers | None | X-Content-Type-Options, X-Frame-Options, HSTS (prod) |
| Celery | `evaluation_tasks` import crash | Fixed — only `syllabus_tasks` included |
| Frontend routing | No middleware | `middleware.ts` guards all `/dashboard` routes |
| Sidebar | Shows all items to all users | Filters items by role/permission |

---

## Step-by-Step Migration

### 1. Run the new RBAC migration

```bash
# Connect to your PostgreSQL instance
psql $DATABASE_URL -f backend/db/migrations/003_rbac_full.sql
```

This:
- Creates `roles` and `permissions` tables
- Re-seeds `role_permissions` with the correct permission set
- Adds `is_student` column to `users`

### 2. Generate a secure SECRET_KEY

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Copy the output into your `.env` as `SECRET_KEY=<output>`.

**Never use the example key in production.** Anyone who reads `.env.example` can forge JWTs.

### 3. Configure Google OAuth

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. APIs & Services → Credentials → Create OAuth 2.0 Client ID
3. Application type: **Web application**
4. Authorized redirect URIs:
   - Development: `http://localhost:8000/auth/callback`
   - Production: `https://your-domain.com/auth/callback`
5. Enable APIs:
   - Google Classroom API
   - Google Drive API
6. Copy Client ID and Secret into `.env`

### 4. Set FRONTEND_URL

```env
# .env
FRONTEND_URL=http://localhost:3000   # development
# FRONTEND_URL=https://your-app.vercel.app  # production
```

This is used by the backend to redirect after OAuth. If this is wrong, users will be redirected to the wrong URL after login.

### 5. Rebuild and restart

```bash
docker-compose down
docker-compose up --build
```

### 6. Existing users

Existing users in the `users` table will continue to work. Their `role` column already exists. The new `permissions` field in the JWT is loaded from `role_permissions` on every login — no manual migration needed.

To promote a user to admin:
```sql
UPDATE users SET role = 'admin' WHERE email = 'admin@yourcollege.edu';
```

---

## OAuth Troubleshooting

### `redirect_uri_mismatch`
The URI in your `.env` (`GOOGLE_REDIRECT_URI`) must **exactly** match what's registered in Google Cloud Console — including protocol, port, and path.

```
# Wrong (trailing slash)
GOOGLE_REDIRECT_URI=http://localhost:8000/auth/callback/

# Wrong (wrong port)
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback

# Correct
GOOGLE_REDIRECT_URI=http://localhost:8000/auth/callback
```

### `invalid_client`
`GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET` is wrong. Double-check by copying directly from Google Cloud Console.

### Login works but redirects to wrong URL
`FRONTEND_URL` in `.env` is wrong. It must point to where your Next.js app is running.

### Token not saved / dashboard shows loading forever
The callback page now writes to both localStorage and a cookie. If you're testing in a private window, cookies may be blocked. Check browser DevTools → Application → Cookies.

### CORS errors on `/auth/callback`
This endpoint is called by Google's servers (server-side redirect), not by the browser directly. CORS does not apply. If you see CORS errors, the issue is elsewhere — likely the frontend calling the API without a token.

---

## RBAC Reference

### Roles

| Role | Description |
|------|-------------|
| `admin` | Full platform access — manages colleges, all users |
| `hod` | Department-wide access — analytics, faculty management |
| `faculty` | Own subjects and classes — core academic workflow |
| `student` | Read-only — own results and attendance |

### Permissions by Role

| Permission | faculty | hod | admin |
|-----------|---------|-----|-------|
| `upload_syllabus` | ✓ | ✓ | ✓ |
| `generate_papers` | ✓ | ✓ | ✓ |
| `evaluate_assignments` | ✓ | ✓ | ✓ |
| `view_own_analytics` | ✓ | ✓ | ✓ |
| `view_class_analytics` | | ✓ | ✓ |
| `view_dept_analytics` | | ✓ | ✓ |
| `use_question_bank` | ✓ | ✓ | ✓ |
| `build_rubrics` | ✓ | ✓ | ✓ |
| `manage_faculty_roles` | | ✓ | ✓ |
| `manage_co_faculty` | | ✓ | ✓ |
| `generate_accreditation` | | ✓ | ✓ |
| `manage_colleges` | | | ✓ |
| `manage_all_users` | | | ✓ |

### Assigning roles

Via API (admin only):
```bash
curl -X PATCH http://localhost:8000/colleges/{college_id}/faculty/{user_id}/role \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '"hod"'
```

Via SQL (direct):
```sql
UPDATE users SET role = 'hod' WHERE email = 'hod@college.edu';
```

---

## New Files Created

```
backend/
  api-gateway/
    auth.py          ← Rewritten: permissions in JWT, FRONTEND_URL, ERR-005 fix
    main.py          ← RBAC guards, global exception handler, security headers
    proxy.py         ← Forwards X-Permissions header
  db/migrations/
    003_rbac_full.sql ← roles, permissions tables, clean role_permissions seed
  shared/
    response.py      ← Standardised {success, data, error, meta} envelope
    logging_config.py ← Structured JSON logging
  workers/
    tasks.py         ← ERR-003 fix: removed non-existent evaluation_tasks

frontend/
  src/
    middleware.ts    ← Edge route guards for /dashboard
    lib/auth.ts      ← Token management, role helpers
    hooks/useAuth.ts ← React hook for auth state
    components/
      RoleGuard.tsx  ← Role-based UI rendering component
    app/
      auth/callback/page.tsx  ← Updated: uses saveSession(), writes cookie
      dashboard/layout.tsx    ← Auth check, permission error toast
```

---

## Production Checklist

- [ ] `SECRET_KEY` is a random 256-bit hex string (not the example value)
- [ ] `TOKEN_ENCRYPTION_KEY` is set (or falls back to `SECRET_KEY`)
- [ ] `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are real credentials
- [ ] `GOOGLE_REDIRECT_URI` matches exactly what's in Google Cloud Console
- [ ] `FRONTEND_URL` points to your deployed frontend
- [ ] `ENVIRONMENT=production` is set (enables HSTS header)
- [ ] Migration 003 has been run on the database
- [ ] At least one user has been promoted to `admin` role
- [ ] `SENTRY_DSN` is configured for error monitoring
- [ ] SMTP credentials are set for email notifications
