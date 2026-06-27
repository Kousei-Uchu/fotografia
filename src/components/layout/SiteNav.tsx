'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? 'A. Photographer'

const navLinks = [
  { href: '/', label: 'Work' },
  { href: '/gallery', label: 'Archive' },
  { href: '/about', label: 'About' },
]

export default function SiteNav() {
  const pathname = usePathname()

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-white via-white/70 via-60% to-transparent">
      <nav
        className="flex items-center justify-between px-6 md:px-10 py-5"
        aria-label="Main navigation"
      >
        {/* Wordmark */}
        <Link
          href="/"
          className="display-italic text-ink text-lg tracking-tight hover:opacity-70 transition-opacity duration-300"
          style={{ fontFamily: 'Cormorant Garant, serif' }}
          aria-label={`${siteName} - home`}
        >
          {siteName}
        </Link>

        {/* Nav links */}
        <ul className="flex items-center gap-8" role="list">
          {navLinks.map(({ href, label }) => (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  'nav-link',
                  pathname === href && 'active text-ink'
                )}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  )
}
