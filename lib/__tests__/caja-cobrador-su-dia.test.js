import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const leer = (...p) => readFileSync(join(process.cwd(), ...p), 'utf8')
const pagina = leer('app', '(dashboard)', 'caja', 'page.jsx')
const api    = leer('app', 'api', 'caja', 'route.js')
const codigo = pagina.replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

// El bloque nuevo: la cuenta del cobrador MIENTRAS va el día.
const suDia = () => {
  const i = codigo.indexOf('Tu día hasta ahora')
  if (i === -1) return null
  const desde = codigo.lastIndexOf('{!cierreHoy && (', i)
  /* ⚠ EL CORTE NO PUEDE SER `{/* Cierre *​/}`: `codigo` acaba de quitar los
     comentarios de JSX, así que esa marca ya no existe y el corte se caía al
     tope de caracteres. Con el desglose de «lo que prestaste» el bloque creció
     y el tope dejó fuera el total — dos pruebas en rojo sin que nada estuviera
     mal. Se ancla en código de verdad, que es lo que no desaparece. */
  const hasta = codigo.indexOf('cierreHoy && !modoAjusteCierre', i)
  return desde === -1 ? null : codigo.slice(desde, hasta === -1 ? codigo.length : hasta)
}

describe('el cobrador ve su día sin tener que cerrar', () => {
  it('existe el bloque', () => {
    // Reportado por un cobrador de PRESTA MIL: «la caja que teníamos antes le
    // mostraba cuánto lleva prestado, cuánto lleva cobrado, cuánto puso de
    // gastos y cuánto llevaba cobrado de seguros… ahí solamente nos está
    // mostrando cuánto lleva cobrado».
    expect(suDia(), 'no encuentro «Tu día hasta ahora»').toBeTruthy()
  })

  it('enseña las CUATRO cifras que pidió', () => {
    // Estaban todas, pero dentro del bloque de «Cierre registrado», que solo se
    // pinta DESPUÉS de cerrar. Su captura era de las 8:29 de la mañana.
    const b = suDia()
    expect(b, 'falta lo cobrado').toContain('cobradoHoy')
    expect(b, 'falta lo prestado').toContain('prestadoHoy')
    expect(b, 'falta los gastos').toContain('gastosHoy')
    expect(b, 'faltan los seguros').toContain('segurosDia')
  })

  it('se pinta con el día ABIERTO, que es cuando hace falta', () => {
    // Si fuera al revés no arreglaría nada: el problema es justo que solo
    // aparecía con el día ya cerrado.
    expect(codigo).toMatch(/\{!cierreHoy && \([\s\S]{0,400}Tu día hasta ahora/)
  })

  it('los seguros NO se suman ni se restan otra vez', () => {
    // El cobro del seguro ya está dentro de lo cobrado. Con signo, el cobrador
    // los volvería a restar al cuadrar de cabeza.
    // `[^}]*` no vale: el label de esa línea lleva una interpolación con
    // llaves, así que la clase de caracteres se cortaba antes de llegar al
    // signo. Se limita por longitud en vez de por llaves.
    const b = suDia()
    expect(b).toMatch(/id: 'seguros'[\s\S]{0,200}?signo: 0/)
  })

  it('el total resta lo prestado y los gastos, no los seguros', () => {
    /* ⚠ ESTA PRUEBA FIJABA EL FALLO. Decía `cobradoHoy - prestadoHoy -
       gastosHoy`, o sea contando las transferencias como si fueran billetes.
       PRESTA MIL lo reportó con la RUTA #9 al peso: la pantalla del cobrador
       le decía «te queda en la mano $119.000» cuando en el bolsillo llevaba
       $40.000 — los otros $79.000 habían entrado por Nequi.
       Ver `lib/__tests__/el-fajo-no-contiene-nequi.test.js`. */
    const b = suDia()
    // El bloque pinta la VARIABLE; la cuenta se declara arriba, fuera del corte.
    expect(b).toContain('formatMoney(enLaMano)')
    expect(codigo).toContain('const enLaMano = cobradoEfectivoHoy - prestadoEfectivoHoy - gastosHoy')
    expect(codigo, 'las transferencias volvieron a contarse como billetes')
      .not.toContain('cobradoHoy - prestadoHoy - gastosHoy')
    expect(b).not.toMatch(/cobradoHoy[^\n]*segurosDia\.monto/)
  })

  it('dice que NO incluye lo que traía al empezar', () => {
    // Sin esa nota, el cobrador compara esta cifra con la de «entregar caja»,
    // que sí lleva la base, y cree que una de las dos está mal.
    expect(suDia()).toMatch(/Sin contar lo que traías/)
  })
})

describe('las cifras son SUYAS, no de toda la organización', () => {
  it('el API acota las estadísticas al cobrador que mira', () => {
    // Si `stats` viniera de toda la organización, se le pintarían gastos de
    // otros cobradores como si fueran suyos — y eso es peor que no enseñarlos.
    expect(api).toMatch(/const statsCobradorId = rol === 'cobrador' \? userId/)
  })

  it('los gastos se filtran por cobradorId', () => {
    expect(api).toMatch(/if \(cobradorId\) whereGastosDia\.cobradorId = cobradorId/)
  })

  it('las variables que usa el bloque existen de verdad', () => {
    // Un nombre inventado no rompe el build —no hay TS— y se pinta como cero:
    // en una pantalla de dinero eso es una cifra falsa, no un hueco visible.
    for (const v of ['cobradoHoy', 'prestadoHoy', 'gastosHoy', 'segurosDia']) {
      expect(pagina, `${v} no está declarada`).toMatch(new RegExp(`const ${v} *=`))
    }
  })
})
