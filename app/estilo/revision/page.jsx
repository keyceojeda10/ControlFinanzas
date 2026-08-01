// app/estilo/revision/page.jsx — «04 · Revisión» con el archivo REAL.
//
// No es una demo con datos inventados: lee el export de 68 créditos que nos
// pasó el usuario, lo mete por el mismo lector y el mismo adaptador que usará
// la app, y pinta el resultado. Si la pantalla aguanta 68 filas con 44
// teléfonos rotos y ninguna cédula, aguanta lo que hay en la calle.
//
// Si el archivo no está (no se sube al repo: son datos de deudores reales), la
// página lo dice en vez de romperse.

import fs from 'node:fs'
import path from 'node:path'
import * as XLSX from 'xlsx'
import { leerExcel } from '@/lib/importar/excel'
import { adaptarRevision } from '@/lib/adaptadores/revision'
import { formatMoney } from '@/lib/i18n'
import VistaRevision from './VistaRevision'

export const dynamic = 'force-dynamic'

const ARCHIVO = path.join(process.cwd(), 'CF Diseño 2026', 'Docuemntos para prueba',
  'cred-activos-general-7c08518ae74-2026-07-15-16_15_33.328.xlsx')

export default function PreviaRevision() {
  if (!fs.existsSync(ARCHIVO)) {
    return <p style={{ padding: 30, fontSize: 14 }}>No encuentro el archivo de prueba.</p>
  }

  const wb = XLSX.read(fs.readFileSync(ARCHIVO), { type: 'buffer' })
  const filas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' })
  const vista = adaptarRevision(leerExcel(filas), (n) => formatMoney(n, 'co'))

  return <VistaRevision vista={vista} />
}
