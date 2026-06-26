import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Photography Portfolio'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? 'Photography'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#0A0A0A',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'flex-end',
          padding: '80px',
        }}
      >
        <p
          style={{
            fontSize: 16,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: '#C8B89A',
            marginBottom: 16,
            fontFamily: 'serif',
          }}
        >
          Photography
        </p>
        <p
          style={{
            fontSize: 72,
            fontWeight: 300,
            color: '#F8F6F1',
            fontFamily: 'serif',
            fontStyle: 'italic',
            lineHeight: 1.05,
          }}
        >
          {siteName}
        </p>
      </div>
    ),
    { ...size }
  )
}
