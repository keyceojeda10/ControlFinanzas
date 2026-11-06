// Enlace que no existe, negocio inactivo o dueño que dejó de mandarla: lo mismo para
// los tres. Sin «Volver al inicio»: el deudor no tiene ningún inicio en esta app.
export default function EnlaceNoDisponible() {
  return (
    <main style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, background: 'var(--cf-surface)', color: 'var(--cf-ink)',
    }}>
      <div style={{ maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>Este enlace ya no está disponible</h1>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: 'var(--cf-ink-2)' }}>
          Si tienes dudas sobre tu crédito, pregúntale directamente a quien te prestó.
        </p>
      </div>
    </main>
  )
}
