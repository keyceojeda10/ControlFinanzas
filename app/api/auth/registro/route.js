// app/api/auth/registro/route.js — Registro de nueva organización
import { NextResponse } from 'next/server'
import bcrypt           from 'bcryptjs'
import { prisma }       from '@/lib/prisma'
import { enviarEmail, emailBienvenida, emailVerificacion } from '@/lib/email'
import { sendConversionEvent } from '@/lib/facebook-capi'
import { registroLimiter, registroIntentos, getClientIp } from '@/lib/rate-limit'
import { DIAS_PRUEBA } from '@/lib/planes'
import { COUNTRY_CODES, getCountryConfig, validatePhone } from '@/lib/i18n'
import { normalizarEmail } from '@/lib/normalizar-email'
import { sendTemplate, sendButtons, wamidDe } from '@/lib/bot/whatsapp-cloud'
import { notificarEstadoLead } from '@/lib/bot/notificar-meta'
import { buscarLeads, ventanaAbierta } from '@/lib/bot/telefono'
import { mensajeBienvenida, BOTONES_CARTERA } from '@/lib/bot/cartera-post-registro'

function generarCodigoReferido() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = 'CF-'
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export async function POST(req) {
  try {
    /* ⚠ ARRIBA SOLO SE FRENA EL MARTILLEO, NO EL QUE SE EQUIVOCA.
     *
     * Aquí estaba el limite de CUENTAS —3 por IP y hora— y se consumia en cada
     * intento, antes de validar nada: escribir mal el celular dos veces y la
     * contraseña una dejaba a alguien fuera UNA HORA sin haber creado cuenta.
     * Lo vi recorriendo el asistente: segundo intento, 429. Y aqui mucha gente
     * sale por la IP del operador, asi que se lleva por delante a vecinos.
     *
     * El limite de cuentas creadas se cobra abajo, cuando ya paso todo. */
    const ip = getClientIp(req)
    if (!registroIntentos(ip).ok) {
      return NextResponse.json({ success: false, error: 'Demasiados intentos. Intenta más tarde.' }, { status: 429 })
    }

    const body = await req.json()
    const { nombreOrganizacion, nombre, email, telefono, password, ref, terminosAceptados, country: countryInput, canal } = body
    const country = COUNTRY_CODES.includes(countryInput) ? countryInput : 'co'

    // Validaciones
    if (!nombreOrganizacion?.trim() || !nombre?.trim() || !email?.trim() || !password) {
      return NextResponse.json({ success: false, error: 'Todos los campos son obligatorios' }, { status: 400 })
    }

    const telefonoLimpio = String(telefono || '').replace(/\D/g, '')
    const phoneCfg = getCountryConfig(country)

    // Si el canal es whatsapp, el teléfono es obligatorio y debe ser válido
    const canalRegistro = canal === 'email' ? 'email' : 'whatsapp'
    if (canalRegistro === 'whatsapp') {
      if (!telefonoLimpio) {
        return NextResponse.json({ success: false, error: 'Ingresa tu número de WhatsApp' }, { status: 400 })
      }
      if (!validatePhone(telefonoLimpio, country)) {
        return NextResponse.json({ success: false, error: `Ingresa un ${phoneCfg.phoneLabel.toLowerCase()} válido (ej: ${phoneCfg.phonePlaceholder})` }, { status: 400 })
      }
    }

    if (password.length < 8) {
      return NextResponse.json({ success: false, error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 })
    }

    if (!terminosAceptados) {
      return NextResponse.json({ success: false, error: 'Debes aceptar los términos y condiciones' }, { status: 400 })
    }

    // Normalizar email (elimina puntos antes del @ para prevenir duplicados tipo Gmail)
    const emailNorm = normalizarEmail(email)

    // Verificar email único. Si ya existe pero NO está verificado → eliminar y permitir re-registro
    const existente = await prisma.user.findUnique({
      where: { email: emailNorm },
      select: { id: true, emailVerificado: true, organizationId: true, createdAt: true },
    })
    if (existente) {
      const horasDesdeRegistro = (Date.now() - new Date(existente.createdAt).getTime()) / (1000 * 60 * 60)
      if (!existente.emailVerificado && horasDesdeRegistro < 48) {
        // Cuenta fantasma (registrada pero nunca verificada en menos de 48h) → limpiar
        await prisma.$transaction([
          prisma.suscripcion.deleteMany({ where: { organizationId: existente.organizationId } }),
          prisma.user.delete({ where: { id: existente.id } }),
          prisma.organization.delete({ where: { id: existente.organizationId } }),
        ])
      } else {
        return NextResponse.json({ success: false, error: 'Este email ya está registrado' }, { status: 400 })
      }
    }

    // Verificar unicidad de teléfono entre owners (solo si se proporcionó)
    if (telefonoLimpio) {
      const ownerConMismoTel = await prisma.user.findFirst({
        where: { telefono: telefonoLimpio, rol: 'owner', emailVerificado: true },
        select: { id: true },
      })
      if (ownerConMismoTel) {
        return NextResponse.json({ success: false, error: 'Ya existe una cuenta registrada con ese número de WhatsApp.' }, { status: 409 })
      }
    }

    // Buscar organización referidora antes de la transacción
    let orgReferidora = null
    if (ref?.trim()) {
      orgReferidora = await prisma.organization.findUnique({
        where: { codigoReferido: ref.trim().toUpperCase() },
        select: { id: true, nombre: true },
      })
    }

    const hash = await bcrypt.hash(password, 10)

    // Generar código de referido único para la nueva organización
    let codigoReferido = generarCodigoReferido()
    // Reintentar si hay colisión (extremadamente improbable)
    let intentos = 0
    while (intentos < 5) {
      const existeCodigo = await prisma.organization.findUnique({ where: { codigoReferido } })
      if (!existeCodigo) break
      codigoReferido = generarCodigoReferido()
      intentos++
    }

    // Crear organización + owner + suscripción de prueba en transacción
    /* EL LIMITE DE VERDAD, cobrado cuando la cuenta se va a crear de verdad.
       Sigue siendo 3 por IP y hora: crear cuentas en masa no se puede. Lo que
       ya no cuesta es equivocarse escribiendo. */
    if (!registroLimiter(ip).ok) {
      return NextResponse.json({
        success: false,
        error: 'Ya se crearon varias cuentas desde esta conexión. Intenta en una hora.',
      }, { status: 429 })
    }

    const resultado = await prisma.$transaction(async (tx) => {
      // CUÁNDO SE ACABA LA PRUEBA, calculado UNA VEZ. Se escribe en dos columnas
      // —`planDemoHasta` de la organización y el vencimiento de la suscripción— y
      // se le dice al usuario por correo, así que tiene que ser el mismo valor.
      //
      // Antes eran dos cuentas distintas del mismo hecho: aquí `Date.now() + 14 *
      // 24 * 3600 * 1000` y más abajo un `setDate(+14)`. Sumar milisegundos no es
      // sumar días de calendario en los países con horario de verano (México,
      // Chile, Paraguay), y encima el 14 estaba escrito a mano en los dos sitios.
      const vencimiento = new Date()
      vencimiento.setDate(vencimiento.getDate() + DIAS_PRUEBA)

      const org = await tx.organization.create({
        data: {
          nombre:        nombreOrganizacion.trim(),
          plan:          'starter',
          activo:        true,
          telefono:      telefonoLimpio,
          country,
          codigoReferido,
          planDemoHasta: vencimiento,
          ...(orgReferidora ? { referidoPorId: orgReferidora.id } : {}),
        },
      })

      // Generar codigo OTP de 6 digitos (expira en 30 min)
      const tokenVerificacion = String(Math.floor(100000 + Math.random() * 900000))
      const tokenExpira = new Date(Date.now() + 30 * 60 * 1000)

      const user = await tx.user.create({
        data: {
          nombre:                  nombre.trim(),
          email:                   emailNorm,
          telefono:                telefonoLimpio,
          password:                hash,
          rol:                     'owner',
          organizationId:          org.id,
          emailVerificado:         false,
          tokenVerificacion,
          tokenExpira,
          terminosAceptados:       true,
          fechaAceptacionTerminos: new Date(),
        },
      })

      // Misma fecha que `planDemoHasta`, calculada arriba.
      const ahora = new Date()

      await tx.suscripcion.create({
        data: {
          organizationId:   org.id,
          plan:             'starter',
          estado:           'activa',
          fechaInicio:      ahora,
          fechaVencimiento: vencimiento,
          montoCOP:         0,
        },
      })

      return { org, user, vencimiento }
    })

    // Enviar OTP por WhatsApp si el canal elegido es whatsapp
    if (canalRegistro === 'whatsapp' && resultado.user.telefono) {
      sendTemplate(resultado.user.telefono, 'verificacion_otp', [resultado.user.tokenVerificacion], 'es')
        .catch(e => console.error('[WA OTP]', e.message))
    }

    // Siempre enviar email de verificación como respaldo
    const { subject: svf, html: hvf } = emailVerificacion({ nombre: nombre.trim(), codigo: resultado.user.tokenVerificacion })
    enviarEmail({ to: emailNorm, subject: svf, html: hvf }).catch(e => console.error('[Email] Fallo envio:', e.message))

    // Enviar email de bienvenida en background (no bloquea).
    //
    // La fecha SALE DE LA TRANSACCIÓN, no de una cuenta nueva. Recalcularla aquí
    // era la tercera copia del mismo cálculo, y la que el usuario lee: si la
    // transacción tarda en cruzar la medianoche, el correo le prometía un día que
    // no es el que quedó en la base.
    const { subject, html } = emailBienvenida({
      nombre:           nombre.trim(),
      email:            emailNorm,
      nombreOrg:        nombreOrganizacion.trim(),
      fechaVencimiento: resultado.vencimiento,
    })
    enviarEmail({ to: emailNorm, subject, html }).catch(e => console.error('[Email] Fallo envio:', e.message))

    // Nota: la recompensa de referido (+30 días) se otorga cuando el referido
    // paga su primer plan, no al registrarse. Ver webhook de MercadoPago.

    // Buscar lead de Facebook Ads por teléfono del nuevo usuario y vincularlo
    const leadAsociado = await prisma.lead.findFirst({
      where: { telefono: telefonoLimpio, estado: { not: 'registrado' } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, telefono: true },
    }).catch(() => null)

    if (leadAsociado) {
      prisma.lead.update({
        where: { id: leadAsociado.id },
        data: { estado: 'registrado', organizationId: resultado.org.id },
      }).catch(e => console.error('[Registro] Fallo vincular lead FB:', e.message))
    }

    /* Vincular BotLead (WhatsApp) por teléfono → marcar como convertido + fuente.
     *
     * ⚠ POR LOS ÚLTIMOS DIEZ DÍGITOS, NUNCA POR IGUALDAD. Aquí se comparaba
     * `telefono: telefonoLimpio` —diez dígitos, como los escribe el usuario—
     * contra `BotLead.telefono`, que viene de WhatsApp con indicativo y tiene
     * doce. Medido el 1 sep 2026: de los 220 leads enlazados, CERO coinciden en
     * texto exacto con su usuario. Este bloque no enlazó a nadie nunca.
     *
     * Los enlaces que sí existen los hacía `verificarRegistro()` cuando la
     * persona volvía a escribirle al bot — y 195 no volvieron. Por eso el bot le
     * seguía mandando el link de registro a quien ya se había registrado. */
    buscarLeads(telefonoLimpio, { organizationId: null }).then(async (botLeads) => {
      if (botLeads.length) {
        await prisma.botLead.updateMany({
          where: { id: { in: botLeads.map(b => b.id) } },
          data: { organizationId: resultado.org.id, estado: 'registrado' },
        })
      }
      for (const bl of botLeads) notificarEstadoLead(bl.id, 'converted').catch(() => {})

      /* ══ EL BOT DEJA DE VENDER Y EMPIEZA A ACOMPAÑAR ══════════════════════
       *
       * Medido el 1 sep 2026: de las 475 organizaciones creadas desde junio,
       * 201 nunca cargaron un cliente y 189 se quedaron entre uno y cinco. El
       * 82 % no pasa del quinto. Y de todas las personas que han escrito al bot
       * desde julio, DOS preguntaron cómo pasar sus clientes: nadie pide ayuda
       * con algo que todavía no sabe que le va a costar.
       *
       * Por eso se ofrece aquí, sin que la pidan, en el minuto en que la cuenta
       * nace — que además es cuando la persona todavía tiene el teléfono en la
       * mano.
       *
       * ⚠ SOLO DENTRO DE LA VENTANA DE 24 h. Fuera de ella esto costaría una
       * plantilla de marketing por cada registro, que es justo el gasto que se
       * está tratando de bajar. Quien llega desde un anuncio de WhatsApp acaba
       * de escribir, así que la ventana está abierta y el mensaje es gratis; a
       * quien no, ya le escribe el cron de onboarding al día siguiente. */
      if (botLeads.length) {
        try {
          if (await ventanaAbierta(telefonoLimpio)) {
            const lead = botLeads[0]
            const texto = mensajeBienvenida(String(nombre || '').trim().split(/\s+/)[0] || '')
            const envio = await sendButtons(lead.telefono, texto, BOTONES_CARTERA)
            await prisma.botConversacion.create({
              data: { botLeadId: lead.id, rol: 'bot', texto, tipoMensaje: 'chat', wamid: wamidDe(envio) },
            }).catch(() => {})
            console.log(`[Registro] cartera ofrecida por WhatsApp a la org ${resultado.org.id}`)
          }
        } catch (e) {
          console.error('[Registro] no pude ofrecer la carga de cartera:', e.message)
        }
      }

      let fuente = null
      if (leadAsociado) {
        fuente = 'facebook_ads'
      } else if (botLeads.length > 0) {
        fuente = 'whatsapp_bot'
      } else if (orgReferidora) {
        fuente = 'referido'
      } else {
        fuente = 'organico'
      }
      if (fuente) {
        await prisma.organization.update({
          where: { id: resultado.org.id },
          data: { fuenteRegistro: fuente },
        })
      }
    }).catch(e => console.error('[Registro] Fallo vincular BotLead:', e.message))

    // Facebook CAPI: reportar conversión real con email + teléfono ingresado
    sendConversionEvent({
      eventName: 'CompleteRegistration',
      email: emailNorm,
      phone: telefonoLimpio,
    }).catch(e => console.error('[Email] Fallo envio:', e.message))

    return NextResponse.json({
      success: true,
      data: {
        ok:             true,
        email:          resultado.user.email,
        organizationId: resultado.org.id,
      },
    })
  } catch (err) {
    console.error('[registro] Error:', err)
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 })
  }
}
