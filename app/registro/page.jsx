import RegistroForm from './RegistroForm'

export default async function RegistroPage({ searchParams }) {
  const sp = await searchParams
  return <RegistroForm refCode={sp?.ref || null} planParam={sp?.plan || null} />
}
