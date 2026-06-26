import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'About',
  description: 'About the photographer.',
}

const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? 'A. Photographer'

export default function AboutPage() {
  return (
    <div className="pt-32 pb-24 px-6 md:px-10 max-w-3xl">
      <h1
        className="display text-5xl md:text-6xl text-ink mb-12"
        style={{ fontFamily: 'Cormorant Garant, serif' }}
      >
        About
      </h1>

      <div className="grid md:grid-cols-5 gap-12">
        {/* Bio — 3 columns */}
        <div className="md:col-span-3 space-y-5">
          <p className="text-secondary leading-relaxed">
            {siteName} is a photographer working in landscape, documentary, and
            portrait. Their practice is grounded in the tradition of large-format
            photography — a discipline of patience, precision, and silence.
          </p>
          <p className="text-secondary leading-relaxed">
            The work spans five continents and two decades. Each body of work
            begins with a single question about a place or a person — and ends,
            usually, with a different one.
          </p>
          <p className="text-secondary leading-relaxed">
            Available for editorial, commercial, and private commissions.
          </p>

          {/* Contact */}
          <div className="pt-6 border-t border-border">
            <p className="label mb-3">Contact</p>
            <a
              href="mailto:hello@example.com"
              className="text-sm text-ink underline underline-offset-4 hover:text-gold-dark transition-colors"
            >
              hello@example.com
            </a>
          </div>
        </div>

        {/* Side column — 2 columns */}
        <div className="md:col-span-2 space-y-8">
          <div>
            <p className="label mb-3">Equipment</p>
            <ul className="space-y-1 text-sm text-secondary">
              <li>Sony A7R V</li>
              <li>Leica Q3</li>
              <li>Linhof Technika 4×5</li>
            </ul>
          </div>
          <div>
            <p className="label mb-3">Publications</p>
            <ul className="space-y-1 text-sm text-secondary">
              <li>National Geographic</li>
              <li>Vogue Australia</li>
              <li>The New York Times</li>
              <li>Wallpaper*</li>
            </ul>
          </div>
          <div>
            <p className="label mb-3">Based in</p>
            <p className="text-sm text-secondary">Sydney, Australia</p>
          </div>
        </div>
      </div>
    </div>
  )
}
