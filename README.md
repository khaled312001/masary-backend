# Masary Backend API

Express + Prisma + MySQL backend for the Masary career analysis platform.

## Stack

- **Express 4** — HTTP framework
- **Prisma 5** — ORM (MySQL)
- **Anthropic SDK** — Claude AI integration
- **jose** — JWT signing/verification
- **Zod** — request validation
- **Helmet + CORS + Compression**

## Quick Start

```bash
# 1. Install
npm install

# 2. Setup .env (copy from .env.example)
cp .env.example .env

# 3. Push schema to MySQL (already pushed in our case)
npx prisma db push

# 4. Seed initial data (already seeded in our case)
npm run db:seed

# 5. Run dev server
npm run dev
```

The server will run on `http://localhost:4000`.

## API Endpoints

All endpoints are prefixed with `/api`.

### Auth
- `POST /api/auth/login` — body `{ email, password }` → returns `{ token, admin }`
- `GET /api/auth/me` — verify token (Authorization: Bearer ...)

### Public
- `GET /api/reports/:id` — view a single report (shareable)
- `GET /api/healthz` — health check

### Admin (requires Bearer token)
- `GET/POST/PATCH/DELETE /api/skills`
- `GET/POST/PATCH/DELETE /api/companies`
- `GET/POST/PATCH/DELETE /api/platforms`
- `GET/POST/PATCH/DELETE /api/jobs`
- `GET/POST/PATCH/DELETE /api/courses`
- `GET/DELETE /api/reports`
- `GET /api/reports/latest`
- `GET /api/stats`
- `POST /api/analyze` — body `{ fullName, jobTitle, employer?, currentSkills, currentCourses? }` → `{ id }`

## Environment Variables

| Var | Description |
|-----|-------------|
| `PORT` | Server port (default 4000) |
| `CORS_ORIGINS` | Comma-separated frontend origins |
| `DATABASE_URL` | MySQL connection string |
| `ANTHROPIC_API_KEY` | Claude API key |
| `ADMIN_EMAIL` | Admin login email |
| `ADMIN_PASSWORD` | Admin login password |
| `AUTH_SECRET` | JWT signing secret (32+ chars) |

## Deployment Options

### Railway (recommended)
1. Create new project → Deploy from GitHub.
2. Add env vars from `.env.example`.
3. Set start command: `npm start`.
4. Build command: `npm run build`.

### Render
Same as Railway. Free tier sleeps after 15 min idle.

### Hostinger Node.js Hosting
Upload, set env vars, set entry to `dist/index.js`.

### Vercel (serverless)
Add `vercel.json`:
```json
{
  "version": 2,
  "builds": [{ "src": "dist/index.js", "use": "@vercel/node" }],
  "routes": [{ "src": "/(.*)", "dest": "dist/index.js" }]
}
```

## License

Proprietary — Masary platform.
