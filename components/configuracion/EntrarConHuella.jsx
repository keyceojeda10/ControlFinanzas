'use client'
/* ENTRAR CON HUELLA O CARA — activarla en este teléfono y ver/quitar los que la
 * tienen (3 oct 2026). Va en «Tus datos», debajo de la contraseña. La cuenta, en
 * lib/huella.js; el lado del teléfono, en lib/huella-cliente.js. */
import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { hayHuella, activarHuella } from '@/lib/huella-cliente'

const fecha = (d) => (d ? new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }).replace('.', '').replace(' de ', ' ') : null)

export default function EntrarConHuella() {
  const [puede, setPuede] = useState(null)
  const [llaves, setLlaves] = useState([])
  const [activando, setActivando] = useState(false)
  const [aviso, setAviso] = useState(null) // { tono: 'bien' | 'mal', texto }

  const cargar = () => fetch('/api/huella').then((r) => (r.ok ? r.json() : [])).then((l) => setLlaves(Array.isArray(l) ? l : [])).catch(() => {})
  useEffect(() => {
    hayHuella().then(setPuede)
    cargar()
  }, [])

  async function activar() {
    setActivando(true); setAviso(null)
    const r = await activarHuella()
    setActivando(false)
    if (r.ok) { setAviso({ tono: 'bien', texto: 'Listo. La próxima vez toca «Entrar con huella o cara» en la pantalla de entrada.' }); cargar() }
    else if (r.error) setAviso({ tono: 'mal', texto: r.error })
  }

  async function quitar(id) {
    await fetch('/api/huella', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).catch(() => {})
    cargar()
  }

  return (
    <Card>
      <p className="text-[11px] font-extrabold text-[var(--cf-ink-3)] uppercase tracking-[.07em] mb-2">Entrar con huella o cara</p>
      <p className="text-[13px] mb-4" style={{ color: 'var(--cf-ink-2)' }}>
        Entra sin escribir la contraseña. Tu huella o tu cara no salen del teléfono: él las revisa y nos avisa que eres tú.
      </p>
      {puede === false && (
        <p className="text-[13px] mb-3" style={{ color: 'var(--cf-ink-3)' }}>
          Este teléfono no tiene huella, cara ni bloqueo de pantalla configurados para esto.
        </p>
      )}
      {puede && (
        <Button onClick={activar} loading={activando} size="sm">Activar en este teléfono</Button>
      )}
      {aviso && (
        <p className="text-[13px] mt-3" style={{ color: aviso.tono === 'bien' ? 'var(--cf-green-dark)' : 'var(--cf-red-dark)' }}>{aviso.texto}</p>
      )}
      {llaves.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          <p className="text-[12px] font-semibold" style={{ color: 'var(--cf-ink-3)' }}>Teléfonos con huella</p>
          {llaves.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-3 py-2" style={{ borderTop: '1px solid var(--cf-hairline)' }}>
              <span className="text-[13px]" style={{ color: 'var(--cf-ink)' }}>
                {l.dispositivo || 'Dispositivo'}
                <span style={{ color: 'var(--cf-ink-3)' }}> · desde el {fecha(l.createdAt)}{l.usadaEn ? ` · usado el ${fecha(l.usadaEn)}` : ''}</span>
              </span>
              <button type="button" onClick={() => quitar(l.id)} className="text-[13px] font-semibold"
                style={{ background: 'none', border: 0, color: 'var(--cf-red-dark)', cursor: 'pointer' }}>
                Quitar
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
