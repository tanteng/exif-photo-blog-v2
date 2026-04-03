# Project: EXIF Photo Blog

A Next.js photo blog with EXIF metadata support, Tencent COS image storage, and admin management.

## Tech Stack
- **Framework**: Next.js 16.1.6
- **Package Manager**: pnpm
- **Database**: PostgreSQL
- **Image Storage**: Tencent COS (CI image optimization)
- **Auth**: NextAuth (admin authentication)
- **UI**: Tailwind CSS, Radix UI, Framer Motion

## Commands
```bash
pnpm dev      # Start development server
pnpm build    # Production build
pnpm start    # Start production server
pnpm lint     # Run ESLint
pnpm test     # Run Jest tests
```

## Key Paths
- Admin pages: `/admin/photos`, `/admin/albums`, `/admin/tags`, `/admin/uploads`
- Photo pages: `/photo/[id]`, `/grid`, `/full`
- Source: `src/app/`, `src/photo/`, `src/admin/`

## Notes
- Authentication required for admin features
- Images served via Tencent COS CI with auto-orient EXIF rotation
- Mobile swipe navigation on photo detail page
