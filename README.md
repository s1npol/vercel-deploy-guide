# Sinpol Portfolio

Static portfolio for 吴海涵 / Sinpol Design, including the Daily Lunch portable food container case study.

## Local commands

```powershell
npm run build
npm run verify
npm run preview
```

The verified production output is generated in `dist/`. The build removes source-only material, obsolete inherited CDN references, personal phone data, and oversized PNG fallbacks that have optimized WebP equivalents.

## Production

- Hosting: Vercel
- Framework preset: Other
- Build command: `npm run build`
- Output directory: `dist`
- Required environment variables: none
- Production branch: `main`

See [DEPLOYMENT.md](DEPLOYMENT.md) for the GitHub and Vercel handoff checklist.

## Adding a case study

Create a new unpublished project page from the reusable local template:

```powershell
npm run new:project -- smart-product "Smart Product"
```

Complete every `{{PROJECT_...}}` placeholder, add optimized local media under
the generated `assets/media/` folder, and test the page before adding its URL
to `portfolio-graft.js`. Projects without a URL remain visible in the carousel
but their detail button reads `COMING SOON`.

See [templates/project-page/README.md](templates/project-page/README.md) for the
full publishing checklist.
