import useReveal from '../hooks/useReveal'
import './Actuators.css'

const actuators = [
  { name: 'MockActuator', desc: 'Logs actions to console. Development & testing stand-in.', active: true },
  { name: 'ShellyActuator', desc: 'Controls Shelly smart relays and dimmers over local HTTP.', active: false },
  { name: 'WoLActuator', desc: 'Wake-on-LAN magic packets to boot workstations remotely.', active: false },
  { name: 'HueActuator', desc: 'Philips Hue bridge integration for smart lighting control.', active: false },
]

function ActuatorCard({ actuator, delay }) {
  const ref = useReveal(delay)
  return (
    <div className="actuator-card reveal" ref={ref}>
      <div className={`actuator-card__status ${actuator.active ? 'actuator-card__status--active' : 'actuator-card__status--planned'}`} />
      <h3 className="actuator-card__name">{actuator.name}</h3>
      <p className="actuator-card__desc">{actuator.desc}</p>
      <span className={`actuator-card__badge ${actuator.active ? '' : 'actuator-card__badge--planned'}`}>
        {actuator.active ? 'Active' : 'Planned'}
      </span>
    </div>
  )
}

export default function Actuators() {
  const headerRef = useReveal()

  return (
    <section className="section section--dark" id="actuators">
      <div className="container">
        <div className="section__header reveal" ref={headerRef}>
          <span className="section__number">S.03</span>
          <h2 className="section__title">Actuators</h2>
          <p className="section__subtitle">
            Pluggable outputs that drive the physical world. Add a new{' '}
            <code>@Component</code> implementing <code>Actuator</code> — Spring
            auto-discovers it.
          </p>
        </div>
        <div className="actuators__grid">
          {actuators.map((a, i) => (
            <ActuatorCard key={a.name} actuator={a} delay={i * 100} />
          ))}
        </div>
      </div>
    </section>
  )
}
