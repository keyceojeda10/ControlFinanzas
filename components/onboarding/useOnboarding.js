'use client'

import { useState, useEffect, useCallback } from 'react'

const SPOTLIGHT_TARGETS = {
  'crear-cliente': {
    selector: '[data-tour="nuevo-cliente"]',
    mensaje: 'Empieza aquí: registra tu primer cliente',
    posicion: 'bottom',
  },
  'crear-prestamo': {
    selector: '[data-tour="nuevo-prestamo"]',
    mensaje: 'Crea un préstamo para tu cliente',
    posicion: 'bottom',
  },
  'registrar-pago': {
    selector: '[data-tour="prestamos"]',
    mensaje: 'Selecciona un préstamo y registra un pago',
    posicion: 'bottom',
  },
  'crear-ruta': {
    selector: '[data-tour="rutas"]',
    mensaje: 'Crea una ruta para organizar tus cobros',
    posicion: 'bottom',
  },
  'cierre-caja': {
    selector: '[data-tour="caja"]',
    mensaje: 'Cierra la caja del día aquí',
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
  const [wizardFlujo, setWizardFlujo] = useState(null)
  const [plan, setPlan] = useState('basic')
  const [minimized, setMinimized] = useState(false)

  const fetchProgreso = useCallback(async () => {
    try {
      const res = await fetch('/api/onboarding/progreso')
      const data = await res.json()

      if (data.completado) {
        setMisiones([])
        setCompletadas(0)
        setTotal(0)
        setProgreso(100)
        setCompletado(true)
        setDismissed(true)
        setShowWizard(false)
        setWizardInitialStep(0)
        setWizardFlujo(null)
        return
      }

      let misionesList = data.misiones || []

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
      setWizardFlujo(data.flujo || null)
      setPlan(data.plan || 'basic')
      if (completadasCount === totalCount && totalCount > 0) setDismissed(true)

      // Restore minimized state from sessionStorage
      try {
        if (typeof window !== 'undefined' && sessionStorage.getItem('cf-wizard-minimized') === '1') {
          setMinimized(true)
        }
      } catch {}
    } catch {
      setCompletado(true)
      setDismissed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (esOwner === null || esOwner === undefined) return
    if (esOwner === false) {
      setDismissed(true)
      setLoading(false)
      return
    }
    fetchProgreso()
  }, [esOwner, fetchProgreso])

  useEffect(() => {
    if (!esOwner || dismissed) return
    const handleFocus = () => fetchProgreso()
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [esOwner, dismissed, fetchProgreso])

  useEffect(() => {
    if (!esOwner || dismissed) return
    const handler = () => fetchProgreso()
    window.addEventListener('onboarding-refresh', handler)
    return () => window.removeEventListener('onboarding-refresh', handler)
  }, [esOwner, dismissed, fetchProgreso])

  // Permanent dismiss (step=99) — only from WizardExito "Ir al dashboard"
  const dismiss = useCallback(async () => {
    setDismissed(true)
    setShowWizard(false)
    setSpotlight(null)
    try {
      await fetch('/api/onboarding/progreso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss' }),
      })
    } catch {}
  }, [])

  // Session-only minimize — wizard comes back on next visit
  const minimize = useCallback(() => {
    setMinimized(true)
    try { sessionStorage.setItem('cf-wizard-minimized', '1') } catch {}
  }, [])

  const unminimize = useCallback(() => {
    setMinimized(false)
    try { sessionStorage.removeItem('cf-wizard-minimized') } catch {}
  }, [])

  const showSpotlight = useCallback((missionId) => {
    const config = SPOTLIGHT_TARGETS[missionId]
    if (!config) return
    setSpotlight({ ...config, missionId })
  }, [])

  const hideSpotlight = useCallback(() => {
    setSpotlight(null)
  }, [])

  const visible = esOwner && !dismissed && !completado && !loading && !showWizard

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
    wizardMinimized: minimized,
    wizardInitialStep,
    wizardFlujo,
    plan,
    spotlight,
    dismiss,
    minimize,
    unminimize,
    showSpotlight,
    hideSpotlight,
    refresh: fetchProgreso,
  }
}
