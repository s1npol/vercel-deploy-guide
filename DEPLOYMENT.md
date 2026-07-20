# GitHub and Vercel deployment

## Repository scope

Create the Git repository from this directory, not from `D:\portfolio`:

```powershell
cd D:\portfolio\sui-latest-copy
git init
git branch -M main
git add .
git commit -m "Prepare portfolio for production"
```

The `.gitignore` excludes backups, QA screenshots, local servers, logs, generated release folders, `dist/`, and Vercel state.

## Pre-push check

```powershell
npm run build
npm run verify
npm run preview
```

Confirm these routes:

- `/`
- `/projects/food-container/`
- `/index.html#pg-selected-work`
- every additional project route marked as published in `portfolio-graft.js`

Projects without a finished case-study URL must remain `COMING SOON`; never
point an unfinished project at another project's page.

## Vercel project

Import the GitHub repository with these values:

- Framework Preset: `Other`
- Root Directory: repository root
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: leave automatic
- Production Branch: `main`
- Environment Variables: none

`vercel.json` is committed so the build/output settings and security headers remain version controlled. Every push to `main` should create a production deployment; other branches should remain previews.

## Release verification

After deployment:

1. Open the production domain in a private window.
2. Confirm the loader completes and the browser console is clean.
3. Open the first project with `VIEW PROJECT`.
4. Enter the case study, inspect several lazy-loaded images, and play the opening film.
5. Use `返回主页面` and confirm the URL ends with `#pg-selected-work`.
6. Test one phone-sized and one desktop-sized viewport.
7. Roll back from Vercel deployment history if any regression appears.
