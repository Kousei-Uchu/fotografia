'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { LayoutGrid, LogOut, Home, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutGrid },
]

export default function AdminNav() {
  const pathname = usePathname()

  async function clearCache() {
    try {
      await fetch('/api/admin/cache', { method: 'POST' })
      toast.success('Cache cleared — next page load will re-fetch from Drive')
    } catch {
      toast.error('Failed to clear cache')
    }
  }

  return (
    <header className="bg-ink text-parchment border-b border-white/10">
      <nav className="flex items-center justify-between px-6 h-14">
        {/* Brand + nav items */}
        <div className="flex items-center gap-6">
          <Link
            href="/admin/dashboard"
            className="display-italic text-parchment text-base opacity-90 hover:opacity-100 transition-opacity"
            style={{ fontFamily: 'Cormorant Garant, serif' }}
          >
            {process.env.NEXT_PUBLIC_SITE_NAME ?? 'Fotografia'}
            <span className="ml-2 text-white/30 font-sans text-xs not-italic tracking-wide">
              admin
            </span>
          </Link>

          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-1.5 text-xs tracking-wide transition-colors',
                pathname === href
                  ? 'text-gold'
                  : 'text-white/50 hover:text-white/80'
              )}
            >
              <Icon size={13} />
              {label}
            </Link>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-5">
          <button
            onClick={clearCache}
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
            title="Clear server cache and re-fetch from Google Drive"
          >
            <RefreshCw size={12} />
            Refresh cache
          </button>
          <Link
            href="/"
            target="_blank"
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
          >
            <Home size={12} />
            View site
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: '/admin/login' })}
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
          >
            <LogOut size={12} />
            Sign out
          </button>
        </div>
      </nav>
    </header>
  )
}
