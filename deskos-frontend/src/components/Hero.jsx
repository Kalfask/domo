import './Hero.css'

export default function Hero() {
  const scrollTo = (e, id) => {
    e.preventDefault()
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <header className="hero" id="hero">
      <div className="hero__bg" />
      <div className="hero__content">
        <p className="hero__label">Office Automation Platform</p>
        <h1 className="hero__title">
          The Brain of Your<br />
          <span className="hero__title-accent">Smart Office</span>
        </h1>
        <p className="hero__subtitle">
          Vision-powered automation that knows when you arrive, adapts your
          environment, and orchestrates every device — seamlessly.
        </p>
        <div className="hero__actions">
          <a href="#about" className="btn btn--primary" onClick={e => scrollTo(e, 'about')}>Explore</a>
          <a href="#events" className="btn btn--outline" onClick={e => scrollTo(e, 'events')}>Live Events</a>
        </div>
        <div className="hero__scroll">
          <span>Scroll</span>
          <div className="hero__scroll-line" />
        </div>
      </div>
    </header>
  )
}
