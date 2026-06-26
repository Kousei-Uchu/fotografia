# Fotografia, Luxury Photography Portfolio

A high-performance photography website with a minimalist public gallery and a Lightroom-style admin backend. Built with Next.js 14 App Router, TypeScript, and Tailwind CSS.

---

## Features

**Public Site**
- Curated hero gallery with Act I / II / III narrative structure
- Full searchable archive with live filters (tags, categories, folders)
- Asymmetric masonry grid with editorial feel
- EXIF data overlay toggle
- Per-photo lightbox with metadata strip
- ISR (Incremental Static Regeneration) for performance

**Admin Dashboard** (`/admin`)
- Google Drive integration: photos live in Drive, metadata in `appProperties`
- Grid and list views
- One-click hero assignment with act/order control
- Full metadata editor: title, alt text, category, tags
- EXIF fields: ISO, aperture, shutter speed, lens, camera, focal length
- Per-photo location privacy toggle (hides GPS from public)
- Stats panel with missing-metadata alerts
- Folder tree navigation

---

## Setup

### 1. Clone and install

```bash
npm install
```

### 2. Create `.env.local`

Copy `.env.local.example` to `.env.local` and fill in the values:

```env
GOOGLE_DRIVE_CLIENT_EMAIL=...
GOOGLE_DRIVE_PRIVATE_KEY=...
GOOGLE_DRIVE_MASTER_FOLDER_ID=...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
ADMIN_EMAIL=admin@yoursite.com
ADMIN_PASSWORD=yourpassword
NEXT_PUBLIC_SITE_NAME=Your Name
```

### 3. Google Drive API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project
3. Enable the **Google Drive API**
4. Create a **Service Account** under IAM & Admin
5. Download the JSON key file
6. Copy the `client_email` and `private_key` into `.env.local`
7. In Google Drive, create a **Master Folder**
8. Right-click → Share with the service account email (Viewer role)
9. Copy the folder ID from the URL and set `GOOGLE_DRIVE_MASTER_FOLDER_ID`

### 4. Folder Structure in Google Drive

```
Master Folder/
├── Landscape/
│   ├── Blue Mountains/
│   │   ├── DSC0001.jpg
│   │   └── DSC0002.jpg
│   └── Hunter Valley/
├── Portrait/
│   ├── 2024/
│   └── 2023/
└── Street/
    └── Tokyo/
```

Folders become navigation entries. Images' EXIF data is read automatically.

### 5. Run locally

```bash
npm run dev
```

Visit `http://localhost:3000` for the public site.
Visit `http://localhost:3000/admin` for the admin dashboard.

---

## Deploying to Vercel (Free Tier)

1. Push to GitHub
2. Import repository in [Vercel](https://vercel.com)
3. Add environment variables in Project Settings → Environment Variables
4. Deploy

> **Note on Vercel Free Tier:** The hobby plan has a 10s function timeout. If you have many photos, the first cold-start crawl may be slow. The in-memory cache mitigates repeat requests. For large archives (500+ photos), consider adding Vercel KV (free tier included) for persistent caching.

---

## Admin Usage

### Marking Hero Images
1. Go to `/admin/dashboard`
2. Click any photo to open the inspector
3. Toggle **Hero Gallery** on
4. Choose Act (I, II, or III) and order position
5. Click **Save to Drive**

The public homepage will show up to 30 hero images arranged by Act.

### Setting Location Privacy
- Each photo with GPS data has a 🔒 toggle in the inspector
- When enabled, the location is stripped from all public views
- The EXIF data (ISO, aperture, etc.) remains visible
- This is per-image, you can share some locations but not others

### Missing Metadata Alerts
The dashboard shows warnings when:
- Fewer than 20 hero images are selected (ideal: 20–30)
- Photos are missing tags
- Photos are missing alt text (affects SEO and accessibility)

---

## Architecture

```
src/
├── app/
│   ├── (public)/          # Public-facing routes
│   │   ├── page.tsx       # Homepage (hero gallery)
│   │   ├── gallery/       # Full archive
│   │   └── about/
│   ├── admin/             # Protected admin routes
│   │   ├── login/
│   │   └── dashboard/
│   └── api/
│       ├── auth/          # NextAuth
│       ├── drive/         # Photos & folders
│       └── admin/         # Metadata PATCH, cache clear
├── components/
│   ├── gallery/           # HeroGallery, GalleryClient, Lightbox
│   ├── admin/             # Dashboard, MetadataEditor, AdminNav
│   └── layout/            # SiteNav, SiteFooter
├── lib/
│   ├── drive.ts           # Google Drive API + converters
│   ├── auth.ts            # NextAuth config
│   ├── cache.ts           # In-memory cache
│   └── utils.ts           # Masonry, filters, formatters
└── types/
    └── index.ts           # All TypeScript interfaces
```

---

## Typography

- **Display:** Cormorant Garant (high-contrast editorial serif, Google Fonts)
- **Body/UI:** DM Sans (geometric, clean, excellent at small sizes)

---

## Customisation

Edit `src/app/globals.css` to change the colour palette:
```css
:root {
  --ink: #0A0A0A;
  --parchment: #F8F6F1;
  --gold: #C8B89A;
  ...
}
```

Edit `src/app/(public)/about/page.tsx` to update the bio, equipment list, and contact info.

Edit `src/components/gallery/HeroGallery.tsx` to change the Act titles and descriptions.
