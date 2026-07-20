(() => {
  const root = document.documentElement
  const body = document.body
  const slug = body.dataset.projectSlug || 'project'
  const intro = document.querySelector('[data-project-intro]')
  const enter = document.querySelector('[data-project-enter]')
  const header = document.querySelector('[data-project-header]')
  const navLinks = [...document.querySelectorAll('[data-project-nav]')]
  const sections = navLinks
    .map((link) => document.querySelector(link.getAttribute('href')))
    .filter(Boolean)
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const sessionKey = `sinpol-project-entered:${slug}`

  const hasEntered = () => {
    try {
      return window.sessionStorage.getItem(sessionKey) === 'true'
    } catch {
      return false
    }
  }

  const rememberEntry = () => {
    try {
      window.sessionStorage.setItem(sessionKey, 'true')
    } catch {
      // The page still works when storage is unavailable.
    }
  }

  const enterProject = ({ restore = false } = {}) => {
    rememberEntry()
    root.classList.add('is-entered')
    intro?.setAttribute('aria-hidden', 'true')
    if (!restore) {
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${window.location.search}#project-home`,
      )
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    }
  }

  if (hasEntered() || window.location.hash) {
    enterProject({ restore: true })
  }

  enter?.addEventListener('click', () => {
    enter.classList.remove('is-pressed')
    void enter.offsetWidth
    enter.classList.add('is-pressed')
    window.setTimeout(
      () => enterProject(),
      reduceMotion.matches ? 0 : 160,
    )
  })

  const setActiveLink = (id) => {
    navLinks.forEach((link) => {
      const isActive = link.getAttribute('href') === `#${id}`
      link.classList.toggle('is-active', isActive)
      if (isActive) link.setAttribute('aria-current', 'true')
      else link.removeAttribute('aria-current')
    })
  }

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
      if (visible) setActiveLink(visible.target.id)
    },
    {
      rootMargin: '-20% 0px -65%',
      threshold: [0, 0.15, 0.4],
    },
  )

  sections.forEach((section) => observer.observe(section))

  const syncHeader = () => {
    header?.classList.toggle('is-scrolled', window.scrollY > 24)
  }
  window.addEventListener('scroll', syncHeader, { passive: true })
  syncHeader()
})()
