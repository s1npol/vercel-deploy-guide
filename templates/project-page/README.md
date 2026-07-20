# Reusable project-page template

This folder is source material only. It is tracked in GitHub but excluded from
Vercel uploads and production output.

## Create a project

From the repository root:

```powershell
npm run new:project -- smart-product "Smart Product"
```

The command creates `projects/smart-product/` without changing the main
portfolio. This keeps an unfinished page private until it is ready.

## Complete the generated page

1. Replace every `{{PROJECT_...}}` placeholder.
2. Put images and video in `assets/media/`.
3. Use relative paths such as `./assets/media/hero.webp`.
4. Optimize images to WebP or AVIF where appropriate.
5. Keep short, muted autoplay films local and web optimized.
6. Remove sections that do not help the project story.
7. Keep the return link as `../../index.html#pg-selected-work`.

Each project uses a session key based on its slug, so opening one case study
does not suppress the intro of another.

## Publish it

In `portfolio-graft.js`, add the finished route to the matching project's final
array position:

```js
"projects/smart-product/index.html"
```

Projects without that value automatically display `COMING SOON`.

Before committing:

```powershell
npm run build
npm run verify
npm run preview
```

Check the direct project URL, a hard refresh, the return link, keyboard focus,
reduced motion, one phone viewport, one laptop viewport, and one wide desktop
viewport. The build fails if any `{{PROJECT_...}}` placeholder reaches
production.
