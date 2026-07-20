# Third-party front-end assets

This portfolio is a static site. The following libraries are vendored locally so the public page does not depend on mutable JavaScript CDN responses.

| Library | Version | Local path | Notes |
| --- | --- | --- | --- |
| GSAP and plugins | 3.15.0 | `assets/vendor/gsap/` | Existing animation runtime; regression-test before upgrading. |
| jQuery | 3.5.1 | `assets/vendor/jquery/jquery-3.5.1.min.js` | Retained for compatibility with the inherited Webflow runtime. |
| Lenis | 1.3.23 | `assets/vendor/lenis/lenis.min.js` | Smooth-scroll runtime. |
| Lottie Web | 5.13.0 | `assets/vendor/lottie/lottie-5.13.0.min.js` | Local copy replacing the previous CDN runtime load. |

The Experience image sequence is served from `scraped-assets/transition/homepage-scroll/` rather than Cloudinary. Review licenses and update versions deliberately; do not replace these files from an unverified source.

The first project page uses Google Fonts stylesheets. Its opening film, project imagery, and runtime scripts are local. The font dependency should be checked after every production deployment.
