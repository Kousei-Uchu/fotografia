import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-parchment flex flex-col items-center justify-center text-center px-6">
      <p
        className="display text-[8rem] leading-none text-border"
        style={{ fontFamily: 'Cormorant Garant, serif' }}
        aria-hidden="true"
      >
        404
      </p>
      <h1
        className="display-italic text-3xl text-ink -mt-4"
        style={{ fontFamily: 'Cormorant Garant, serif' }}
      >
        Nothing here
      </h1>
      <p className="text-sm text-muted mt-4 max-w-xs">
        The page you&rsquo;re looking for has moved or doesn&rsquo;t exist.
      </p>
      <Link
        href="/"
        className="mt-8 text-sm text-ink underline underline-offset-4 hover:text-gold-dark transition-colors"
      >
        Return home
      </Link>
    </div>
  )
}
