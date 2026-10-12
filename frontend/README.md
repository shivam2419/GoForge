# Goforge Digital website

Server-rendered site and admin panel for Goforge Digital.

- **Stack:** Node.js 20+, Express 5, EJS templates, Turso/libSQL in production, local SQLite file in dev (`@libsql/client`), bcrypt password hashing, Helmet (strict CSP), rate limiting, compression. No build step and no client framework; one small JS file adds progressive enhancement.
- **Pages:** Home, Services (plus one page per service), Work, Internship (plus one page per role and a printable overview), FAQ, About, Contact, Privacy, Terms, Refunds, 404, `/admin`.
- **Admin:** email + password login (no sign-up), project enquiry inbox, internship inbox, search, status filter (New / Contacted / Closed), site settings (2 phones, WhatsApp, email, 4 service lines, internship lengths and fee line), change password.
- **SEO:** per-page titles and descriptions, canonical links, Open Graph and Twitter cards, JSON-LD (ProfessionalService), `sitemap.xml`, `robots.txt`, favicons and web manifest.

## Run locally

```bash
npm install
npm start            # http://localhost:3000 (PORT to change)
```

Works the same on Windows (PowerShell or the VS Code terminal) with Node 20, 22 or 24: `npm install` installs only the runtime packages, and `@libsql/client` ships prebuilt binaries, so no compiler is needed. With no `TURSO_DATABASE_URL` set, data is stored in `data/goforge.db` (an ordinary SQLite file; an existing one keeps working).

Templates are cached unless `NODE_ENV=development`. For editing templates with live reload use `NODE_ENV=development npm run dev` (PowerShell: `$env:NODE_ENV="development"; npm run dev`).

On first start the app creates the admin account `goforgedigital@gmail.com`, generates a strong password, stores only its bcrypt hash, and writes the plain password once to `ADMIN_INITIAL_PASSWORD.txt` (mode 600). Sign in at `/admin/login`, change the password under **Admin > Password**, then delete that file.

Forgot the password? On the server: `npm run reset-admin-password` (prints a new one) or `npm run reset-admin-password -- 'your new password'`.

## Configuration

See `.env.example`. The important ones:

| Variable | Purpose |
| --- | --- |
| `SITE_URL` | Public URL, e.g. `https://goforgedigital.com` |
| `TURSO_DATABASE_URL` | Hosted database URL (`libsql://...`). **Required on Vercel.** When empty, a local SQLite file in `DATA_DIR` is used. |
| `TURSO_AUTH_TOKEN` | Token for that database. |
| `DATA_DIR` | Local-mode SQLite file and fallback session secret. Must be persistent if you use local mode in production. |
| `SESSION_SECRET` | 32+ random characters. **Required on Vercel** (otherwise each serverless instance generates its own and forms fail with 403). Auto-generated into `DATA_DIR` elsewhere. |
| `TRUST_PROXY` | `1` when behind Render, Railway, Nginx or Cloudflare |
| `GA_MEASUREMENT_ID` | Optional. GA4 ID (`G-XXXXXXXX`). Off if empty. |
| `PLAUSIBLE_DOMAIN` | Optional. Plausible domain. Off if empty. |
| `ADMIN_INITIAL_PASSWORD` | Optional. Sets the first admin password instead of generating one (useful where you cannot read files on the server) |

## Deploy

### Vercel (current setup)
Vercel functions have no persistent disk, so the database must be hosted. Schema and default settings are created automatically on first request.
1. Vercel dashboard > project > **Storage** (or **Integrations > Marketplace**) > **Turso Cloud** > Create/Connect a database, connect it to this project (Production + Preview). This adds `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`. (Alternatively create a DB at turso.tech and paste both values under Settings > Environment Variables.)
2. Settings > Environment Variables, add: `SESSION_SECRET` (run `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`), `ADMIN_INITIAL_PASSWORD` (a long password you choose; used only when the admin account is first created), `SITE_URL=https://goforgedigital.com`, `TRUST_PROXY=1`.
3. Redeploy. Sign in at `/admin/login` with `goforgedigital@gmail.com` and that password, then change it under Admin > Password.


Elsewhere the app is one Node process plus either Turso (set the two env vars) or a SQLite file on a persistent disk.

### Render
1. Push this folder to a GitHub repo.
2. New > Web Service > pick the repo. Runtime Node, build `npm ci --omit=dev`, start `npm start`.
3. Add a **Disk** (1 GB is plenty) mounted at `/var/data`.
4. Environment: `SITE_URL=https://goforgedigital.com`, `DATA_DIR=/var/data/goforge`, `TRUST_PROXY=1`, `ADMIN_INITIAL_PASSWORD=<a long password you choose>`.
5. Add the custom domain `goforgedigital.com` and follow Render's DNS steps.

### Railway
1. New project from the GitHub repo. Start command `npm start`.
2. Add a **Volume** mounted at `/data`. Set `DATA_DIR=/data`, `TRUST_PROXY=1`, `SITE_URL`, `ADMIN_INITIAL_PASSWORD`.
3. Add the custom domain under Settings > Networking.

### VPS (Ubuntu, Nginx, PM2)
```bash
sudo apt install -y nodejs npm nginx      # Node 20+ (use NodeSource if the distro version is older)
git clone <repo> /srv/goforge && cd /srv/goforge
npm ci --omit=dev
sudo mkdir -p /var/data/goforge && sudo chown $USER /var/data/goforge
SITE_URL=https://goforgedigital.com DATA_DIR=/var/data/goforge TRUST_PROXY=1 PORT=3000 \
  npx pm2 start server.js --name goforge && npx pm2 save && npx pm2 startup
```
Nginx site:
```nginx
server {
  server_name goforgedigital.com www.goforgedigital.com;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```
Then `sudo certbot --nginx -d goforgedigital.com -d www.goforgedigital.com` for HTTPS.

### Backups
Turso: use the dashboard's point-in-time restore, or `turso db shell <db> .dump > backup.sql`. Local mode: Copy `DATA_DIR/goforge.db` regularly (for example `sqlite3 goforge.db ".backup backup.db"` from a daily cron).

## Editing content

- Phones, WhatsApp, email, the four service lines, internship lengths and fee line: **Admin > Settings**. Changes are live immediately.
- Service names, the process steps and the internship roles (Software Engineering, AI/ML Engineer, Data Analyst, Web Developer, Digital Marketing, plus "Similar role", which requires a note) live in `lib/content.js` (`SERVICES`, `PROCESS`, `TRACK_DETAILS`). The apply form, server validation, modals and admin all read from there.
- Portfolio: the Work page shows "Selected work will be added here." until real projects are added in `views/work.ejs` and the Work section of `views/home.ejs`.
- Address and social links: `lib/content.js` (`BRAND`).

## Security notes

- Passwords: bcrypt (cost 12). Plain text is never stored.
- Sessions: random 256-bit token in an `httpOnly`, `SameSite=Strict` cookie (`Secure` over HTTPS); only a SHA-256 of the token is stored. 7-day expiry. Changing the password signs out other sessions.
- CSRF: signed double-submit token on every POST, plus an Origin check.
- Rate limits: 6 failed logins per 15 minutes per IP; 8 form submissions per hour per IP. Honeypot field on public forms.
- Strict Content-Security-Policy (no inline scripts or styles), HSTS, frame blocking.
- Server-side validation of every field; client-side validation mirrors it.

## Popups (modals)

Service cards, role cards, "Talk about a project" and "Apply for internship" open native `<dialog>` popups (focus trap, Esc to close, focus returns to the button, page scroll locked). Every trigger is a normal link (`/contact?service=...`, `/internship?track=...#apply`), so without JavaScript the same forms open as pages with the choice preselected. On `/contact` and `/internship` the form is already on the page, so the buttons scroll to it instead.

## Tests

`tests/e2e.js` drives a real Chrome through the forms and popups, admin login, status changes, settings, overflow at 320/375/414 px, 44 px tap targets, reduced motion and no-JS fallbacks. Test tooling is not part of `npm install`; add it only when testing:

```bash
npm i --no-save playwright-core
BASE=http://localhost:3000 ADMIN_PASSWORD='...' CHROME=/path/to/chrome npm test
```
On Windows, set the variables in PowerShell first (`$env:BASE="http://localhost:3000"`, etc.) and point `CHROME` at `C:\Program Files\Google\Chrome\Application\chrome.exe`.
It creates test entries and marks them Closed; delete them afterwards if you want an empty inbox. It also writes screenshots to `screenshots/`.

## Regenerating icons

`npm run assets` rebuilds the favicon, touch icons and Open Graph image from the GF mark in `views/partials/mark.ejs` (needs Chrome and `npm i --no-save playwright-core`). Fonts are already vendored in `public/fonts/`.
