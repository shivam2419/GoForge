# Go-Forge Agency Website

A responsive, single-page client acquisition website built with React, Vite, Tailwind CSS, and Lucide React. The FastAPI backend saves enquiries in SQLite and sends email notifications through Brevo.

## Run locally

Requires Node.js 20.19+ or 22.12+.

```bash
cd frontend
npm install
npm run dev
```

Vite prints the local URL after the dev server starts.

## Run the contact API

Requires Python 3.10 or newer. In a second terminal, from the project directory:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Set `BREVO_API_KEY` in the ignored `backend/.env` file. Set `BREVO_SENDER_EMAIL` to an address verified in your Brevo account; enquiries are sent to `CONTACT_TO_EMAIL`. Never commit `.env` or share the API key. Enquiries are saved to `backend/data/enquiries.db` even if Brevo is not configured or email delivery fails.

Set `ADMIN_PASSWORD` in `backend/.env` to a long, unique password before using the admin portal. A random `ADMIN_SESSION_SECRET` is generated in the local `.env`; keep it private. Open `http://localhost:5173/admin` after starting both servers. The dashboard lists saved enquiries, contact details, email status, and project messages. Admin sessions use an HTTP-only signed cookie and expire after 12 hours.

Then start the API:

```powershell
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Run the frontend commands above in another terminal. Vite proxies `/api` requests to the local FastAPI server. Check the API at `http://127.0.0.1:8000/api/health` or open its interactive docs at `http://127.0.0.1:8000/docs`.

For deployment, set Brevo credentials, `ADMIN_PASSWORD`, and `ADMIN_SESSION_SECRET` in the backend host's secret environment configuration. Serve over HTTPS and set `ADMIN_COOKIE_SECURE=true`. The Vercel rewrite proxies `/api/*` to Render, keeping browser requests and admin cookies same-origin; keep `ADMIN_COOKIE_SAMESITE=strict` and set `FRONTEND_ORIGINS` to include the deployed frontend origin. Mount persistent storage for `backend/data/enquiries.db` or set `DATABASE_PATH` to a persistent volume; ephemeral deployment disks will not retain the database across redeploys.

## Build for production

```bash
cd frontend
npm run build
npm run preview
```

The production files are generated in `frontend/dist/`.

## Deploy to Vercel

Import the repository in Vercel and set the project root directory to `frontend`. Vercel should detect Vite automatically. `frontend/vercel.json` proxies `/api/*` to the Render API at `https://goforge-o39u.onrender.com`; frontend code uses same-origin `/api` paths. Remove any `VITE_API_BASE_URL` override from Vercel's environment settings. Use these project settings if prompted:

- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`

Deploy the FastAPI backend separately or route `/api` to it through your hosting provider. Configure the backend environment variables described above and set the frontend's `VITE_API_BASE_URL` when the API is on a separate origin.

### Deploy the backend to Render

The root `render.yaml` configures the FastAPI service with `backend` as its root directory, installs `backend/requirements.txt`, starts Uvicorn, checks `/api/health`, allows the production Vercel origin, and enables secure admin cookies. Create or update the Render web service from this Blueprint. If configuring the existing service manually, use:

- Root Directory: `backend`
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Health Check Path: `/api/health`
- `FRONTEND_ORIGINS`: include `https://goforge-mu.vercel.app`
- `ADMIN_COOKIE_SECURE`: `true`
- `ADMIN_COOKIE_SAMESITE`: `strict`

Do not use `gunicorn your_application.wsgi`; that is a Django/WSGI placeholder, not this FastAPI app. Set the Brevo and admin secrets in Render's environment settings. Set `FRONTEND_ORIGINS` to the deployed frontend origin. For enquiry persistence across deploys, attach a persistent disk and set `DATABASE_PATH` to a file path on its mount.

## Replace the placeholders

- Brand name, email, phone numbers, WhatsApp link, and location: `frontend/src/data/site.js` (`agency` object).
- Page title and search/social descriptions: `<head>` in `frontend/index.html`.
- Services, business capabilities, benefits, process steps, portfolio projects, form options, and footer services: same file.
- Portfolio images and descriptive alt text: edit each `projects` item in `frontend/src/data/site.js`; current remote images are illustrative placeholders and project cards are explicitly labeled as concepts.
- Logo artwork: `frontend/public/go-forge-navbar.svg` is the compact header lockup and `frontend/public/go-forge-footer.svg` is the navy-background footer lockup; `frontend/public/go-forge-logo.svg` is the light-background version. The `Brand` component selects the navbar/footer assets. Browser icon: `frontend/public/favicon.svg`.
- Typography and all colors/layout styling: CSS variables at the top of `frontend/src/index.css`. Fonts are loaded from Google Fonts.
- Social profile links: `socialLinks` in the `Footer` component in `frontend/src/components/SiteSections.jsx`.
- Open Graph share image: replace the illustrative `og:image` URL in `frontend/index.html` with your own publicly accessible brand image.

## Scripts

- `cd frontend; npm run dev` starts the local development server.
- `cd frontend; npm run build` creates the production bundle.
- `cd frontend; npm run preview` serves the production bundle locally.
- `cd frontend; npm run lint` runs Oxlint.