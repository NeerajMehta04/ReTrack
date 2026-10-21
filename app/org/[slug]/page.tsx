import { redirect } from 'next/navigation'

export default function OrgRootPage({ params }: { params: { slug: string } }) {
  redirect(`/org/${params.slug}/items`)
}
