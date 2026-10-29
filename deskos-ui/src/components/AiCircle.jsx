import { useState, useEffect, useRef } from 'react'
import './AiCircle.css'

export default function AiCircle({ status = 'active', personCount = 0, ping = 0, pingType = 'arrived' }) {
  const [ripple, setRipple] = useState(false)
  const prevPing = useRef(ping)

  useEffect(() => {
    if (ping !== prevPing.current && ping > 0) {
      prevPing.current = ping
      setRipple(true)
      const id = setTimeout(() => setRipple(false), 900)
      return () => clearTimeout(id)
    }
  }, [ping])

  return (
    <div className="ai-wrap">
      <div className="ai-circle">
        {/* rotating rings */}
        <div className="ai-ring ai-ring--outer" />
        <div className="ai-ring ai-ring--mid" />
        <div className="ai-ring ai-ring--inner" />

        {/* tick marks */}
        <svg className="ai-ticks" viewBox="0 0 100 100">
          {Array.from({ length: 36 }, (_, i) => {
            const angle = i * 10
            const rad = (angle * Math.PI) / 180
            const x1 = 50 + 48 * Math.cos(rad)
            const y1 = 50 + 48 * Math.sin(rad)
            const x2 = 50 + 45 * Math.cos(rad)
            const y2 = 50 + 45 * Math.sin(rad)
            return (
              <line
                key={i}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={i % 9 === 0 ? 'rgba(0,212,255,.5)' : 'rgba(0,212,255,.15)'}
                strokeWidth={i % 9 === 0 ? '1' : '.5'}
              />
            )
          })}
        </svg>

        {/* scanning beam */}
        <div className="ai-scan" />

        {/* ripple on event */}
        <div className={`ai-ripple ${ripple ? (pingType === 'departed' ? 'fire fire--amber' : 'fire') : ''}`} />

        {/* pulsing core */}
        <div className="ai-core-wrap">
          <div className="ai-core">
            <div className={`ai-core-dot ${ripple ? 'flash' : ''}`} />
          </div>
        </div>
      </div>

      <div className="ai-label">
        <div className="ai-label-main">
          {status === 'active' ? 'Vision Active' : 'Standby'}
        </div>
        {personCount > 0 ? `${personCount} tracked` : 'Monitoring'}
      </div>
    </div>
  )
}
