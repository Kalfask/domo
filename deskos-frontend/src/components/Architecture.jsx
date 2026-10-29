import useReveal from '../hooks/useReveal'
import './Architecture.css'

export default function Architecture() {
  const headerRef = useReveal()
  const diagramRef = useReveal(100)

  return (
    <section className="section section--light" id="architecture">
      <div className="container">
        <div className="section__header reveal" ref={headerRef}>
          <span className="section__number">S.06</span>
          <h2 className="section__title">Architecture</h2>
        </div>
        <div className="arch reveal" ref={diagramRef}>
          <div className="arch__flow">
            <div className="arch__node arch__node--entry">
              <span className="arch__node-label">Vision Event</span>
              <span className="arch__node-sub">POST /events/vision</span>
            </div>
            <div className="arch__arrow" />
            <div className="arch__node">
              <span className="arch__node-label">EventController</span>
              <span className="arch__node-sub">Validates &amp; persists</span>
            </div>
            <div className="arch__arrow" />
            <div className="arch__node">
              <span className="arch__node-label">SceneService</span>
              <span className="arch__node-sub">Picks first matching strategy</span>
            </div>
            <div className="arch__arrow" />
            <div className="arch__node arch__node--scenes">
              <span className="arch__node-label">Scene Strategies</span>
              <div className="arch__node-children">
                <span>MorningArrival</span>
                <span>EveningArrival</span>
                <span>LeftScene</span>
              </div>
            </div>
            <div className="arch__arrow" />
            <div className="arch__node arch__node--actuator">
              <span className="arch__node-label">Actuators</span>
              <span className="arch__node-sub">Fan-out to all registered</span>
            </div>
          </div>
          <div className="arch__storage">
            <div className="arch__arrow arch__arrow--down" />
            <div className="arch__node arch__node--db">
              <span className="arch__node-label">PostgreSQL</span>
              <span className="arch__node-sub">VisionEventRepository</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
