import './Footer.css'

export default function Footer() {
  const scrollTo = (e, id) => {
    e.preventDefault()
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__grid">
          <div className="footer__brand">
            <a href="#" className="nav__logo" onClick={e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
              <span className="nav__logo-icon">&#9678;</span>
              <span className="nav__logo-text">DeskOS<span className="nav__logo-accent">Hub</span></span>
            </a>
            <p className="footer__tagline">Intelligent office automation, powered by vision.</p>
          </div>
          <div className="footer__col">
            <h4>Explore</h4>
            <ul>
              <li><a href="#about" onClick={e => scrollTo(e, 'about')}>About</a></li>
              <li><a href="#scenes" onClick={e => scrollTo(e, 'scenes')}>Scenes</a></li>
              <li><a href="#actuators" onClick={e => scrollTo(e, 'actuators')}>Actuators</a></li>
              <li><a href="#tech" onClick={e => scrollTo(e, 'tech')}>Technology</a></li>
            </ul>
          </div>
          <div className="footer__col">
            <h4>Developer</h4>
            <ul>
              <li><a href="/actuator/health">Health Check</a></li>
              <li><a href="/events/vision">API: Events</a></li>
              <li><a href="#architecture" onClick={e => scrollTo(e, 'architecture')}>Architecture</a></li>
            </ul>
          </div>
          <div className="footer__col">
            <h4>API Endpoints</h4>
            <ul>
              <li><code>GET /events/vision</code></li>
              <li><code>POST /events/vision</code></li>
              <li><code>GET /actuator/health</code></li>
            </ul>
          </div>
        </div>
        <div className="footer__bottom">
          <p>&copy; 2026 DeskOS Hub &mdash; Smart Office Automation</p>
        </div>
      </div>
    </footer>
  )
}
