import { useState, useEffect, useRef } from 'react'
import AiCircle from './AiCircle'
import './EventsPage.css'

export default function EventsPage() {
  const [events, setEvents] = useState([])
  const [error, setError] = useState(false)
  const [ping, setPing] = useState(0)
  const [pingType, setPingType] = useState('arrived')
  const prevCount = useRef(0)
  const timer = useRef(null)

  useEffect(() => {
    let active = true

    async function poll() {
      try {
        const res = await fetch('/events/vision')
        if (!res.ok) throw new Error(res.status)
        const data = await res.json()
        if (active) {
          if (data.length > prevCount.current && prevCount.current > 0) {
            const latest = data[0]
            setPingType(latest?.eventType || 'arrived')
            setPing(p => p + 1)
          }
          prevCount.current = data.length
          setEvents(data)
          setError(false)
        }
      } catch {
        if (active) setError(true)
      }
    }

    poll()
    timer.current = setInterval(poll, 3000)
    return () => { active = false; clearInterval(timer.current) }
  }, [])

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Events</h1>
        <span className="page-badge">Vision feed</span>
      </div>

      <AiCircle
        status={error ? 'standby' : 'active'}
        personCount={events.filter(e => e.eventType === 'arrived').length}
        ping={ping}
        pingType={pingType}
      />

      <div className={`events-status ${error ? 'events-status--error' : ''}`}>
        <span className="events-status-dot" />
        {error ? 'Hub unreachable' : 'Live — polling hub'}
      </div>

      {events.length === 0 && !error ? (
        <div className="events-empty">
          <svg className="events-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          <span className="events-empty-text">Awaiting vision events</span>
        </div>
      ) : (
        <div className="events-feed">
          {events.map((ev, i) => (
            <div key={ev.id ?? i} className="event-row">
              <span className={`event-dot event-dot--${ev.eventType}`} />
              <div className="event-body">
                <span className="event-text">
                  <span className="event-person">{ev.personName || 'Unknown'}</span>
                  {' '}
                  <span className="event-action">
                    {ev.eventType === 'arrived' ? 'entered the room' : 'left the room'}
                  </span>
                </span>
              </div>
              <div className="event-meta">
                {ev.confidence != null && (
                  <span className="event-confidence">{(ev.confidence * 100).toFixed(0)}%</span>
                )}
                {ev.timestamp && (
                  <span className="event-time">
                    {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
