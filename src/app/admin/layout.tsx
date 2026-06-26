import AdminNav from '@/components/admin/AdminNav'

// Auth is enforced by src/middleware.ts — no need to re-check here.
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <AdminNav />
      <main className="flex-1">{children}</main>
    </div>
  )
}
