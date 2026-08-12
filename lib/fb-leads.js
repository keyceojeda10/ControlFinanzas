// Normaliza teléfono colombiano: asegura código de país +57
function normalizarTelefono(tel) {
  if (!tel) return ''
  const digitos = tel.replace(/\D/g, '')
  // 10 dígitos empezando con 3 = celular colombiano sin código de país
  if (digitos.length === 10 && digitos.startsWith('3')) {
    return '+57' + digitos
  }
  // 12 dígitos empezando con 57 = ya tiene código de país
  if (digitos.length === 12 && digitos.startsWith('57')) {
    return '+' + digitos
  }
  // Si ya tiene + al inicio, devolver como está
  if (tel.startsWith('+')) return tel
  return tel
}

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
      fields.telefono = normalizarTelefono(val)
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

/**
 * EL RANGO DE CLIENTES, EN CRISTIANO.
 *
 * ══ POR QUÉ NO ES UN MAPA ══════════════════════════════════════════════════
 *
 * Lo era, y por eso fallaba. Contados en producción, los formularios de Meta
 * han mandado **16 formas distintas** de decir cuatro rangos:
 *
 *   20_a_50 · 20_50 · 20_–_50 · menos_de_20 · menos_20 · «menos de 20» ·
 *   50_a_100 · 50_100 · 50_–_100 · «50 – 100» · más_de_100 · mas_100 ·
 *   r_1_20 · r_51_150 · …
 *
 * El mapa cubría ocho de esas, y ninguna de las cuatro que manda el formulario
 * vivo. Cada versión nueva del formulario obliga a volver aquí, y nadie se
 * acuerda: por eso se leen los NÚMEROS y las palabras «menos»/«más», que es lo
 * único que no cambia entre versiones.
 *
 * ⚠ Esto NO es solo cosmético. El mismo dato entra en el prompt del bot —«veo
 * que manejas X clientes»— y hasta ahora salía por `.replace(/_/g, ' ')`, que
 * convierte `20_50` en «20 50». Medido: **610 de 1.220 leads con dato**
 * recibieron un mensaje con el rango mal escrito, y con el formulario nuevo
 * (v18: `menos_de_20`, `20_50`, `50_100`, `mas_de_100`) le tocaría a TODOS los
 * de 20 a 100.
 */
export function textoCantClientes(code) {
  if (!code) return ''
  // Guiones bajos, guiones normales y guiones largos: los tres han llegado.
  const s = String(code).toLowerCase().replace(/[_–—-]+/g, ' ').replace(/\s+/g, ' ').trim()
  const nums = (s.match(/\d+/g) || []).map(Number)
  if (s.includes('menos') && nums.length) return `menos de ${nums[0]}`
  if ((s.includes('mas') || s.includes('más')) && nums.length) return `más de ${nums[nums.length - 1]}`
  if (nums.length >= 2) return `${nums[0]} a ${nums[1]}`
  if (nums.length === 1) return String(nums[0])
  return s
}

// Convierte códigos FB en textos legibles
export function prettyCantClientes(code) {
  return textoCantClientes(code)
}

export function prettyEsPrestamista(code) {
  if (!code) return ''
  if (code.includes('si') || code === 'si_clientes_activos') return '✅ Sí, activo'
  if (code === 'no_activo' || code.startsWith('no')) return '❌ No activo'
  return code
}

export function prettyMetodoActual(code) {
  if (!code) return ''
  /* ⚠ LOS CUATRO QUE DE VERDAD LLEGAN NO ESTABAN.
     Contados en producción: `cuaderno_papel` (617), `excel_sheets` (170),
     `app_basica` (159), `no_llevo_control` (81) — 1.027 leads mostrando el
     código crudo en la alerta. Las claves que sí estaban (`libreta`, `excel`,
     `memoria`…) suman **cinco** registros en toda la historia: son de una
     versión del formulario que ya no existe. Se quedan por si aparece un lead
     viejo, pero las de arriba son las vivas. */
  const map = {
    cuaderno_papel: '📓 Cuaderno o papel',
    excel_sheets: '📊 Excel o Google Sheets',
    app_basica: '📲 Una app básica',
    no_llevo_control: '🚫 No lleva control',
    libreta: '📓 Libreta/cuaderno',
    excel: '📊 Excel',
    memoria: '🧠 De memoria',
    otra_app: '📲 Otra app',
    whatsapp: '📱 WhatsApp/notas',
    nada: '🚫 Nada',
    otro: '❓ Otro',
    software: '💻 Otro software',
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
