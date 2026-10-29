import { useState } from 'react'
import Toggle from './Toggle'
import './DeviceCard.css'

export default function DeviceCard({ device }) {
  const [on, setOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(false)

  async function toggle() {
    if (busy) return
    setBusy(true)
    setErr(false)
    try {
      const res = await fetch(`/lights/${device.id}/toggle`, { method: 'POST' })
      if (!res.ok) throw new Error(res.status)
      setOn(prev => !prev)
    } catch {
      setErr(true)
      setTimeout(() => setErr(false), 2000)
    } finally {
      setBusy(false)
    }
  }

  const cls = ['tile', on && 'on', busy && 'busy', err && 'err'].filter(Boolean).join(' ')

  return (
    <button className={cls} onClick={toggle}>
      <div className="tile-top">
        <svg className="tile-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18h6" />
          <path d="M10 22h4" />
          <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
        </svg>
        <Toggle on={on} />
      </div>
      <div className="tile-bottom">
        <span className="tile-name">{device.name}</span>
        <span className="tile-state">{err ? 'Error' : on ? 'On' : 'Off'}</span>
      </div>
    </button>
  )
}
