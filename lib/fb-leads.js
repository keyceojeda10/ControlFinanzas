// Mapea field_data de Facebook Lead Ads al shape interno
// Formulario actualizado 2026-04: manual_name, manual_whatsapp, whatsapp_consent,
// is_active_lender, client_range, current_management, plan_interest

export function parseFieldData(fieldData = []) {
  const fields = {}
  for (const f of fieldData) {
    const name = f.name?.toLowerCase() || ''
    const val = f.values?.[0] || ''

    if (name === 'manual_name' || name === 'full_name' || name === 'nombre') {
      fields.nombre = val
    } else if (
      name === 'manual_whatsapp' ||
      name === 'whatsapp' ||
      name === 'phone_number' ||
      name === 'phone' ||
      name === 'telefono' ||
      name.includes('whats') && name !== 'whatsapp_consent'
    ) {
      fields.telefono = val
    } else if (name === 'whatsapp_consent') {
      fields.consent = val
    } else if (name === 'is_active_lender' || name === 'is_lender' || name.includes('presta') || name.includes('lender')) {
      fields.esPrestamista = val
    } else if (name === 'client_range' || name === 'how_many' || name.includes('client') || name.includes('cuant')) {
      fields.cantClientes = val
    } else if (name === 'current_management' || name.includes('management') || name.includes('metodo')) {
      fields.metodoActual = val
    } else if (name === 'plan_interest' || name.includes('plan')) {
      fields.planInteres = val
    }
  }
  return fields
}

// Convierte códigos FB en textos legibles
export function prettyCantClientes(code) {
  if (!code) return ''
  const map = {
    r_1_20: '1 a 20',
    r_20_50: '20 a 50',
    r_50_100: '50 a 100',
    r_100_200: '100 a 200',
    r_200_500: '200 a 500',
    r_500_mas: '500 o más',
    '20_a_50': '20 a 50',
    '1_a_20': '1 a 20',
  }
  return map[code] || code
}

export function prettyEsPrestamista(code) {
  if (!code) return ''
  if (code.includes('si') || code === 'si_clientes_activos') return '✅ Sí, activo'
  if (code === 'no_activo' || code.startsWith('no')) return '❌ No activo'
  return code
}

export function prettyMetodoActual(code) {
  if (!code) return ''
  const map = {
    libreta: '📓 Libreta/cuaderno',
    excel: '📊 Excel',
    memoria: '🧠 De memoria',
    otra_app: '📲 Otra app',
    whatsapp: '📱 WhatsApp/notas',
    nada: '🚫 Nada',
  }
  return map[code] || code
}

export function prettyPlanInteres(code) {
  if (!code) return ''
  const map = {
    inicial_39000: '💼 Inicial ($39.000)',
    basico_59000: '💼 Básico ($59.000)',
    crecimiento_99000: '💼 Crecimiento ($99.000)',
    profesional_149000: '💼 Profesional ($149.000)',
    empresarial: '💼 Empresarial',
    no_sabe: '🤷 No sabe aún',
  }
  return map[code] || code
}

export function prettyConsent(code) {
  if (!code) return ''
  if (code.includes('si') || code === 'si_autorizo') return '✅ Autoriza WhatsApp'
  return `⚠️ ${code}`
}
