import { useEffect, useState } from 'react'
import useReveal from '../hooks/useReveal'
import './About.css'

function AnimatedNumber({ target, suffix = '' }) {
  const [value, setValue] = useState(0)
  const ref = useReveal()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        if (target === 0) { setValue(0); observer.unobserve(el); return }
        let current = 0
        const step = Math.max(1, Math.floor(target / 60))
        const timer = setInterval(() => {
          current += step
          if (current >= target) { current = target; clearInterval(timer) }
          setValue(current)
        }, 20)
        observer.unobserve(el)
      },
      { threshold: 0.5 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [target, ref])

  return (
    <div className="stat reveal" ref={ref}>
      <span className="stat__number">{value.toLocaleString()}{suffix}</span>
    </div>
  )
}

const stats = [
  { target: 3, suffix: '', label: 'Active Scenes' },
  { target: 100, suffix: '%', label: 'Uptime' },
  { target: 0, suffix: '', label: 'Events Processed', id: 'eventCount' },
  { target: 1, suffix: '', label: 'Actuators Online' },
  { target: 8080, suffix: '', label: 'Listening Port' },
  { target: 24, suffix: '/7', label: 'Always Running' },
]

export default function About() {
  const headerRef = useReveal()
  const textRef = useReveal()

  return (
    <section className="section section--dark" id="about">
      <div className="container">
        <div className="section__header reveal" ref={headerRef}>
          <span className="section__number">S.01</span>
          <h2 className="section__title">About DeskOS</h2>
        </div>
        <div className="about__grid">
          <div className="about__text reveal" ref={textRef}>
            <p>
              DeskOS Hub is an intelligent office-automation system that ingests
              real-time vision events, persists them, and dispatches context-aware
              scenes to a pluggable actuator layer. Whether it's turning on lights
              at sunrise or powering down when you leave — DeskOS handles it.
            </p>
            <p>
              Built with a strategy-based scene engine, adding new behaviors is as
              simple as dropping in a new component. No rewiring, no downtime.
            </p>
          </div>
          <div className="stats">
            {stats.map(s => (
              <div className="stat-wrapper" key={s.label}>
                <AnimatedNumber target={s.target} suffix={s.suffix} />
                <span className="stat__label">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
