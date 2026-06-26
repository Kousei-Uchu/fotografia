import Link from 'next/link'

const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? 'A. Photographer'
const year = new Date().getFullYear()

export default function SiteFooter() {
  return (
    <footer className="border-t border-border mt-24 py-10 px-6 md:px-10">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <p
          className="display-italic text-ink text-base"
          style={{ fontFamily: 'Cormorant Garant, serif' }}
        >
          {siteName}
        </p>
        <div className="flex items-center gap-6">
          <Link href="/gallery" className="nav-link">
            Archive
          </Link>
          <Link href="/about" className="nav-link">
            About
          </Link>
          <span className="label">© {year}</span>
        </div>
      </div>
    </footer>
  )
}
