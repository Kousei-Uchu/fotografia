import type { Metadata } from 'next'
import './globals.css'
import AuthProvider from '@/components/layout/AuthProvider'
import { Toaster } from 'sonner'

export const metadata: Metadata = {
  title: {
    default: process.env.NEXT_PUBLIC_SITE_NAME ?? 'Photography',
    template: `%s — ${process.env.NEXT_PUBLIC_SITE_NAME ?? 'Photography'}`,
  },
  description: `Fine art photography by ${process.env.NEXT_PUBLIC_SITE_NAME ?? 'a photographer'}. Landscape, portrait, and documentary work.`,
  openGraph: {
    type: 'website',
    siteName: process.env.NEXT_PUBLIC_SITE_NAME ?? 'Photography',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <AuthProvider>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                fontFamily: 'DM Sans, system-ui, sans-serif',
                fontSize: '13px',
                background: '#0A0A0A',
                color: '#F8F6F1',
                border: '1px solid #3A3A3A',
                borderRadius: '3px',
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  )
}
