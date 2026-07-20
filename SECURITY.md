# Security notes

## Current scope

This repository contains a static portfolio. It has no login, administrator area, database, file upload, or server-side business API. If any of those features are added, they require a separate authentication, authorization, data-isolation, upload-validation, logging, and database-permission review.

## Publishing

Run `npm run build` and publish only `dist/`. Vercel is configured to do this automatically through `vercel.json`. Do not expose `_backups/`, QA artifacts, preview servers, logs, or source-only pages.

The legacy `build-release.ps1` command now delegates to the same verified Node build before creating the optional `release/github-pages/` mirror, so both release paths use identical sanitizing and validation rules.

## Sensitive information

The public site intentionally includes a work email address. A personal phone number is not part of the release. Secrets and service credentials must never be placed in HTML, CSS, JavaScript, or committed backups.

## Local preview

`serve-8793.cjs` is for source development and `npm run preview` serves the production `dist/` build. Both bind to `127.0.0.1` only and must not be exposed through a public tunnel.

## Media

The first project page serves its optimized opening film from `projects/food-container/assets/`. The production build rejects the retired CloudFront hostname so that dependency cannot be reintroduced accidentally.
