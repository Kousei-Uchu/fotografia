import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'About',
  description: 'About the photographer.',
}

const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? 'A. Photographer'

const age = (() => {
  const birthDate = new Date('2010-11-08') // Replace with the actual birth date
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }
  return age
})()

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
        {/* Bio: 3 columns */}
        <div className="md:col-span-3 space-y-5">
          <p className="text-secondary leading-relaxed">
            Aiden is a {age}-year-old photographer who enjoys capturing the beauty of the natural world, and the smaller worlds within it. They believe that perfection is found in the imperfections. Their photos may nor be gallery-ready, but their imperfections show the unpolished reality of the world&rsquo;s beauty. They are a self-taught photographer, and have been taking photos since they were about 10 years old.
          </p>
          <p className="text-secondary leading-relaxed">
            They believe that photography is a way to tell stories, and that through the lens of a camera, they can capture the essence of a moment, a place, or a person. They are constantly seeking to improve their craft, and to find new ways to express themselves and others through their photography.
          </p>
          <p className="text-secondary leading-relaxed">
            They find comfort in being behind the camera and not in front of it, and is rarely seen in their own photos. They are a private person, and prefer to let their work speak their mind. They are also a perfectionist, and are constantly striving to improve their skills and techniques.
          </p>
          <p className="text-secondary leading-relaxed">
            They are not a commercial photographer, but if you would be interested in working with them, by all means, reach out.
          </p>

          {/* Contact */}
          <div className="pt-6 border-t border-border">
            <p className="label mb-3">Contact</p>
            <a
              href="mailto:hello@sorren.me"
              className="text-sm text-ink underline underline-offset-4 hover:text-gold-dark transition-colors"
            >
              hello@sorren.me
            </a>
          </div>
        </div>

        {/* Side column: 2 columns */}
        <div className="md:col-span-2 space-y-8">
          <div>
            <p className="label mb-3">Equipment</p>
            <ul className="space-y-1 text-sm text-secondary">
              <li>Canon R6 Mark III</li>
              <li>Canon RF 15-35mm F2.8L IS USM</li>
              <li>Canon RF 24-105mm f/4L IS USM</li>
              <li>Canon RF 100-400mm f/5.6-8 IS USM</li>
              <li>DJI Mic 3</li>
              <li>DJI Mini 3 Pro</li>
              <li>Dwarf 3 Smart Telescope</li>
            </ul>
          </div>
          <div>
            <p className="label mb-3">Focus</p>
            <ul className="space-y-1 text-sm text-secondary">
              <li>Natural Landscapes</li>
              <li>Architecture</li>
              <li>Wildlife</li>
              <li>Astrophotography</li>
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
