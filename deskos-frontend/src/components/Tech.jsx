import useReveal from '../hooks/useReveal'
import './Tech.css'

const techs = [
  {
    title: 'Spring Boot 3',
    desc: 'JDK 21, auto-configuration, actuator health endpoints, REST controllers.',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M24 4L4 14l20 10 20-10L24 4z"/>
        <path d="M4 24l20 10 20-10"/>
        <path d="M4 34l20 10 20-10"/>
      </svg>
    ),
  },
  {
    title: 'PostgreSQL 16',
    desc: 'Persistent event storage with JPA/Hibernate, Docker-ready in one command.',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2">
        <ellipse cx="24" cy="24" rx="20" ry="8"/>
        <ellipse cx="24" cy="16" rx="20" ry="8"/>
        <ellipse cx="24" cy="32" rx="20" ry="8"/>
      </svg>
    ),
  },
  {
    title: 'Strategy Pattern',
    desc: 'Scenes are strategies — ordered, composable, independently deployable behaviors.',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="6" y="6" width="36" height="36" rx="4"/>
        <path d="M6 18h36M18 18v24"/>
      </svg>
    ),
  },
  {
    title: 'Spring DI',
    desc: 'Auto-discovered components. New actuators and scenes register themselves on startup.',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="24" cy="12" r="8"/>
        <circle cx="12" cy="36" r="8"/>
        <circle cx="36" cy="36" r="8"/>
        <path d="M24 20v8M18 32l-2-4M30 32l2-4"/>
      </svg>
    ),
  },
  {
    title: 'Computer Vision',
    desc: 'Accepts vision events via REST — person detection, arrival, departure tracking.',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 4h24v12L24 24 12 16V4z"/>
        <path d="M12 32h24v12H12z"/>
        <path d="M24 24v8"/>
      </svg>
    ),
  },
  {
    title: 'Extensible',
    desc: <>Implement <code>Actuator</code> or <code>SceneStrategy</code> to extend.</>,
    icon: (
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="4" y="4" width="40" height="40" rx="8"/>
        <path d="M14 24h20M24 14v20"/>
      </svg>
    ),
  },
]

function TechCard({ tech, delay }) {
  const ref = useReveal(delay)
  return (
    <div className="tech-card reveal" ref={ref}>
      <div className="tech-card__icon">{tech.icon}</div>
      <h3>{tech.title}</h3>
      <p>{tech.desc}</p>
    </div>
  )
}

export default function Tech() {
  const headerRef = useReveal()

  return (
    <section className="section section--dark" id="tech">
      <div className="container">
        <div className="section__header reveal" ref={headerRef}>
          <span className="section__number">S.05</span>
          <h2 className="section__title">Technology</h2>
          <p className="section__subtitle">Built on proven, production-grade infrastructure.</p>
        </div>
        <div className="tech__grid">
          {techs.map((t, i) => (
            <TechCard key={t.title} tech={t} delay={i * 100} />
          ))}
        </div>
      </div>
    </section>
  )
}
