import { useState, useEffect } from 'react'
import './Navbar.css'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const handleLink = (e, id) => {
    e.preventDefault()
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    setOpen(false)
  }

  return (
    <nav className={`nav${scrolled ? ' nav--scrolled' : ''}`}>
      <div className="nav__inner">
        <a href="#" className="nav__logo" onClick={e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
          <span className="nav__logo-icon">&#9678;</span>
          <span className="nav__logo-text">DeskOS<span className="nav__logo-accent">Hub</span></span>
        </a>
        <button className="nav__toggle" onClick={() => setOpen(!open)} aria-label="Toggle menu">
          <span /><span /><span />
        </button>
        <ul className={`nav__links${open ? ' open' : ''}`}>
          <li><a href="#about" onClick={e => handleLink(e, 'about')}>About</a></li>
          <li><a href="#scenes" onClick={e => handleLink(e, 'scenes')}>Scenes</a></li>
          <li><a href="#actuators" onClick={e => handleLink(e, 'actuators')}>Actuators</a></li>
          <li><a href="#events" onClick={e => handleLink(e, 'events')}>Events</a></li>
          <li><a href="#tech" onClick={e => handleLink(e, 'tech')}>Technology</a></li>
          <li><a href="#architecture" onClick={e => handleLink(e, 'architecture')}>Architecture</a></li>
          <li><a href="#events" className="nav__cta" onClick={e => handleLink(e, 'events')}>Dashboard</a></li>
        </ul>
      </div>
    </nav>
  )
}
