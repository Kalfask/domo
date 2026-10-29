import { useState, useEffect } from 'react'
import './Nav.css'

const TABS = [
  { id: 'lights', label: 'Lights' },
  { id: 'scenes', label: 'Scenes' },
  { id: 'events', label: 'Events' },
]

export default function Nav({ current, onChange }) {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <nav className="topbar">
      <div className="topbar-left">
        <div className="topbar-reactor">
          <div className="topbar-reactor-core" />
        </div>
        <span className="topbar-name">Desk<span className="topbar-name-accent">OS</span></span>
      </div>

      <div className="topbar-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`topbar-tab ${current === t.id ? 'active' : ''}`}
            onClick={() => onChange(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="topbar-right">
        <span className="topbar-status">
          <span className="topbar-dot" />
          ONLINE
        </span>
        <span className="topbar-clock">
          {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      </div>
    </nav>
  )
}
