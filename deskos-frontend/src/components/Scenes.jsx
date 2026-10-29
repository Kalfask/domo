import useReveal from '../hooks/useReveal'
import './Scenes.css'

const scenes = [
  {
    title: 'Morning Arrival',
    desc: 'Triggered Mon–Fri, 7 AM – 12 PM when a person is detected. Lights on, blinds up, workstation powered.',
    tag: '07:00 – 12:00',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="24" cy="24" r="10"/>
        <path d="M24 4v6M24 38v6M4 24h6M38 24h6M8.93 8.93l4.24 4.24M34.83 34.83l4.24 4.24M8.93 39.07l4.24-4.24M34.83 13.17l4.24-4.24"/>
      </svg>
    ),
  },
  {
    title: 'Evening Arrival',
    desc: 'After-hours arrival scene. Warm lighting, ambient mode, security notifications enabled.',
    tag: '18:00 – 23:00',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M24 38a14 14 0 1 1 0-28"/>
        <path d="M24 10v28"/>
        <circle cx="24" cy="24" r="4"/>
        <path d="M4 24h6M38 24h6"/>
      </svg>
    ),
  },
  {
    title: 'Left Scene',
    desc: 'Fires when the last person leaves. All lights off, devices to standby, HVAC to eco mode.',
    tag: 'Always Active',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="8" y="8" width="32" height="32" rx="4"/>
        <path d="M16 16l16 16M32 16L16 32"/>
      </svg>
    ),
  },
]

function SceneCard({ scene, delay }) {
  const ref = useReveal(delay)
  return (
    <div className="scene-card reveal" ref={ref}>
      <div className="scene-card__icon">{scene.icon}</div>
      <h3 className="scene-card__title">{scene.title}</h3>
      <p className="scene-card__desc">{scene.desc}</p>
      <div className="scene-card__tag">{scene.tag}</div>
    </div>
  )
}

export default function Scenes() {
  const headerRef = useReveal()

  return (
    <section className="section section--light" id="scenes">
      <div className="container">
        <div className="section__header reveal" ref={headerRef}>
          <span className="section__number">S.02</span>
          <h2 className="section__title">Scene Engine</h2>
          <p className="section__subtitle">
            Strategy-based scene matching. First match wins. Drop in a new{' '}
            <code>@Component</code> to add behavior — zero rewiring.
          </p>
        </div>
        <div className="scenes__grid">
          {scenes.map((s, i) => (
            <SceneCard key={s.title} scene={s} delay={i * 100} />
          ))}
        </div>
      </div>
    </section>
  )
}
