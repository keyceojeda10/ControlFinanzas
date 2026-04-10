'use client'

import { useState, useEffect, useCallback } from 'react'

const SPOTLIGHT_TARGETS = {
  'crear-cliente': {
    selector: '[data-tour="nuevo-cliente"]',
    mensaje: 'Empieza aqui: registra tu primer cliente',
    posicion: 'bottom',
  },
  'crear-prestamo': {
    selector: '[data-tour="nuevo-prestamo"]',
    mensaje: 'Crea un prestamo para tu cliente',
    posicion: 'bottom',
  },
  'registrar-pago': {
    selector: '[data-tour="prestamos"]',
    mensaje: 'Selecciona un prestamo y registra un pago',
    posicion: 'bottom',
  },
  'crear-ruta': {
    selector: '[data-tour="rutas"]',
    mensaje: 'Crea una ruta para organizar tus cobros',
    posicion: 'bottom',
  },
  'cierre-caja': {
    selector: '[data-tour="caja"]',
    mensaje: 'Cierra la caja del dia aqui',
    posicion: 'bottom',
  },
  'crear-cobrador': {
    selector: '[data-tour="cobradores"]',
    mensaje: 'Agrega un cobrador para tu equipo',
    posicion: 'bottom',
  },
  'instalar-app': {
    selector: null,
    mensaje: 'Descarga la app en tu celular',
    posicion: 'bottom',
  },
}

export function useOnboarding(esOwner) {
  const [misiones, setMisiones] = useState([])
  const [completadas, setCompletadas] = useState(0)
  const [total, setTotal] = useState(5)
  const [progreso, setProgreso] = useState(0)
  const [completado, setCompletado] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [spotlight, setSpotlight] = useState(null)
  const [showWizard, setShowWizard] = useState(false)
  const [wizardInitialStep, setWizardInitialStep] = useState(0)

  // Fetch progress
  const fetchProgreso = useCallback(async () => {
    try {
      const res = await fetch('/api/onboarding/progreso')
      const data = await res.json()

      // Si el backend dice que el onboarding está completo/dismissed (onboardingStep >= 99),
      // ocultar todo inmediatamente sin importar que misiones venga vacío.
      if (data.completado) {
        setMisiones([])
        setCompletadas(0)
        setTotal(0)
        setProgreso(100)
        setCompletado(true)
        setDismissed(true)
        setShowWizard(false)
        setWizardInitialStep(0)
        return
      }

      let misionesList = data.misiones || []

      // Client-side check: marcar 'instalar-app' si la PWA ya está instalada
      if (typeof window !== 'undefined') {
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches
          || window.navigator.standalone === true
        if (isStandalone) {
          misionesList = misionesList.map(m =>
            m.clientCheck === 'pwa-installed' ? { ...m, completada: true } : m
          )
        }
      }

      const completadasCount = misionesList.filter(m => m.completada).length
      const totalCount = misionesList.length

      setMisiones(misionesList)
      setCompletadas(completadasCount)
      setTotal(totalCount)
      setProgreso(totalCount > 0 ? Math.round((completadasCount / totalCount) * 100) : 0)
      setCompletado(completadasCount === totalCount && totalCount > 0)
      setShowWizard(data.showWizard || false)
      setWizardInitialStep(data.wizardInitialStep || 0)
      if (completadasCount === totalCount && totalCount > 0) setDismissed(true)
    } catch {
      setCompletado(true)
      setDismissed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // null = auth aún cargando, no hacer nada todavía
    if (esOwner === null || esOwner === undefined) return
    // false = explícitamente no es owner (cobrador), ocultar onboarding
    if (esOwner === false) {
      setDismissed(true)
      setLoading(false)
      return
    }
    // true = es owner, cargar progreso
    fetchProgreso()
  }, [esOwner, fetchProgreso])

  // Re-fetch when returning to dashboard (user might have completed a mission)
  useEffect(() => {
    if (!esOwner || dismissed) return
    const handleFocus = () => fetchProgreso()
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [esOwner, dismissed, fetchProgreso])

  // Listen for custom event from other pages
  useEffect(() => {
    if (!esOwner || dismissed) return
    const handler = () => fetchProgreso()
    window.addEventListener('onboarding-refresh', handler)
    return () => window.removeEventListener('onboarding-refresh', handler)
  }, [esOwner, dismissed, fetchProgreso])

  const dismiss = useCallback(async () => {
    setDismissed(true)
    setSpotlight(null)
    try {
      await fetch('/api/onboarding/progreso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss' }),
      })
    } catch {}
  }, [])

  const showSpotlight = useCallback((missionId) => {
    const config = SPOTLIGHT_TARGETS[missionId]
    if (!config) return
    setSpotlight({ ...config, missionId })
  }, [])

  const hideSpotlight = useCallback(() => {
    setSpotlight(null)
  }, [])

  const visible = esOwner && !dismissed && !completado && !loading

  return {
    misiones,
    completadas,
    total,
    progreso,
    completado,
    dismissed,
    loading,
    visible,
    showWizard: showWizard && !dismissed && !loading,
    wizardInitialStep,
    spotlight,
    dismiss,
    showSpotlight,
    hideSpotlight,
    refresh: fetchProgreso,
  }
}
