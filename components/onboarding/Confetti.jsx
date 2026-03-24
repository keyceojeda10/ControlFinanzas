'use client'

import { useEffect, useState } from 'react'

const COLORS = ['#f5c518', '#22c55e', '#3b82f6', '#a855f7', '#ef4444', '#f59e0b']

function randomBetween(min, max) {
  return Math.random() * (max - min) + min
}

export default function Confetti({ active, duration = 3000 }) {
  const [particles, setParticles] = useState([])

  useEffect(() => {
    if (!active) { setParticles([]); return }

    const count = 60
    const newParticles = Array.from({ length: count }, (_, i) => ({
      id: i,
      x: randomBetween(10, 90),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      delay: randomBetween(0, 0.5),
      size: randomBetween(4, 8),
      rotation: randomBetween(0, 360),
      xDrift: randomBetween(-30, 30),
    }))

    setParticles(newParticles)
    const timer = setTimeout(() => setParticles([]), duration)
    return () => clearTimeout(timer)
  }, [active, duration])

  if (particles.length === 0) return null

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute confetti-particle"
          style={{
            left: `${p.x}%`,
            top: '-10px',
            width: `${p.size}px`,
            height: `${p.size * 1.5}px`,
            backgroundColor: p.color,
            borderRadius: '2px',
            transform: `rotate(${p.rotation}deg)`,
            animation: `confetti-fall ${randomBetween(2, 3)}s ease-in ${p.delay}s forwards`,
            '--x-drift': `${p.xDrift}px`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(0) translateX(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) translateX(var(--x-drift)) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}
