# Go-Forge Agency Website

A responsive, single-page client acquisition website built with React, Vite, Tailwind CSS, and Lucide React. The contact form currently validates in the browser and is ready for a future API connection; it does not send or store enquiries yet.

## Run locally

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

Vite prints the local URL after the dev server starts.

## Build for production

```bash
npm run build
npm run preview
```

The production files are generated in `dist/`.

## Deploy to Vercel

Import the repository in Vercel, or install the Vercel CLI and run `vercel` from the project directory. Vercel should detect Vite automatically. Use these project settings if prompted:

- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`

No server-side routes or environment variables are required for this version.

## Replace the placeholders

- Brand name, email, phone, WhatsApp link, and location: `src/data/site.js` (`agency` object).
- Page title and search/social descriptions: `<head>` in `index.html`.
- Services, business capabilities, benefits, process steps, portfolio projects, form options, and footer services: same file.
- Portfolio images and descriptive alt text: edit each `projects` item in `src/data/site.js`; current remote images are illustrative placeholders and project cards are explicitly labeled as concepts.
- Logo artwork: `public/go-forge-navbar.svg` is the compact header lockup and `public/go-forge-footer.svg` is the navy-background footer lockup; `public/go-forge-logo.svg` is the light-background version. The `Brand` component selects the navbar/footer assets. Browser icon: `public/favicon.svg`.
- Typography and all colors/layout styling: CSS variables at the top of `src/index.css`. Fonts are loaded from Google Fonts.
- Social profile links: `socialLinks` in the `Footer` component in `src/components/SiteSections.jsx`.
- Open Graph share image: replace the illustrative `og:image` URL in `index.html` with your own publicly accessible brand image.

## Connect the contact form API

Update `handleSubmit` in the `Contact` component in `src/components/SiteSections.jsx`. After browser validation, build a payload with `Object.fromEntries(new FormData(form).entries())` and send it to your endpoint with `fetch`. Handle success and error states, and only show a sent confirmation after the server accepts the enquiry. The current placeholder explicitly says the form is not connected and offers an email fallback; the form field `name` attributes provide the request payload keys.

## Scripts

- `npm run dev` starts the local development server.
- `npm run build` creates the production bundle.
- `npm run preview` serves the production bundle locally.
- `npm run lint` runs Oxlint.