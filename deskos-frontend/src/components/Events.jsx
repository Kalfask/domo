import { useState, useEffect, useCallback } from 'react'
import useReveal from '../hooks/useReveal'
import './Events.css'

function escapeHtml(str) {
  const el = document.createElement('div')
  el.textContent = str
  return el.innerHTML
}

function formatTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString()
}

export default function Events() {
  const headerRef = useReveal()
  const panelRef = useReveal()
  const [events, setEvents] = useState([])
  const [status, setStatus] = useState('Connecting...')
  const [sending, setSending] = useState(false)

  const loadEvents = useCallback(() => {
    setStatus('Loading...')
    fetch('/events/vision')
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json() })
      .then(data => {
        if (!Array.isArray(data) || data.length === 0) {
          setEvents([])
          setStatus('No events')
        } else {
          const sorted = [...data].sort(
            (a, b) => new Date(b.timestamp || b.createdAt || 0) - new Date(a.timestamp || a.createdAt || 0)
          )
          setEvents(sorted)
          setStatus(`${data.length} event(s)`)
        }
      })
      .catch(() => {
        setStatus('API offline — start the backend')
        setEvents([])
      })
  }, [])

  useEffect(() => { loadEvents() }, [loadEvents])

  const sendTest = () => {
    const names = ['kostas', 'alex', 'maria', 'dev']
    const payload = {
      eventType: Math.random() > 0.3 ? 'arrived' : 'left',
      personName: names[Math.floor(Math.random() * names.length)],
      confidence: +(Math.random() * 0.4 + 0.6).toFixed(2),
    }
    setSending(true)
    fetch('/events/vision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json() })
      .then(() => { setTimeout(() => setSending(false), 1200); loadEvents() })
      .catch(() => setSending(false))
  }

  return (
    <section className="section section--light" id="events">
      <div className="container">
        <div className="section__header reveal" ref={headerRef}>
          <span className="section__number">S.04</span>
          <h2 className="section__title">Live Events</h2>
          <p className="section__subtitle">Real-time vision event feed from the DeskOS API.</p>
        </div>
        <div className="events__panel reveal" ref={panelRef}>
          <div className="events__toolbar">
            <button className="btn btn--small btn--primary" onClick={loadEvents}>Refresh</button>
            <button className="btn btn--small btn--outline" onClick={sendTest} disabled={sending}>
              {sending ? 'Sent!' : 'Send Test Event'}
            </button>
            <span className="events__status">{status}</span>
          </div>
          <div className="events__feed">
            {events.length === 0 ? (
              <div className="events__empty">
                <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48">
                  <circle cx="24" cy="24" r="20"/>
                  <path d="M24 14v12l8 4"/>
                </svg>
                <p>
                  {status.includes('offline')
                    ? <>Could not reach the API.<br/>Make sure the backend is running on <code>localhost:8080</code>.</>
                    : 'No events yet. Trigger a vision event to see it here.'}
                </p>
              </div>
            ) : (
              events.map((ev, i) => {
                const type = (ev.eventType || '').toLowerCase()
                const isArrival = type === 'arrived'
                return (
                  <div className="event-row" key={ev.id || i}>
                    <div className={`event-row__icon ${isArrival ? 'event-row__icon--arrived' : 'event-row__icon--left'}`}>
                      {isArrival ? '▲' : '▼'}
                    </div>
                    <div className="event-row__body">
                      <div className="event-row__title">
                        {escapeHtml(ev.personName || 'Unknown')} &mdash; {escapeHtml(type)}
                      </div>
                      <div className="event-row__meta">
                        {ev.confidence != null ? `Confidence: ${(ev.confidence * 100).toFixed(0)}%` : ''}
                      </div>
                    </div>
                    <div className="event-row__time">{formatTime(ev.timestamp || ev.createdAt)}</div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
