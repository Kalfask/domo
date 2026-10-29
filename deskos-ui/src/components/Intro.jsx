import { useEffect, useState } from 'react'
import './Intro.css'

const BOOT_LINES = [
  'DESKOS CORE v2.1.0',
  'Initializing vision subsystem...',
  'Connecting to hub @ localhost:8080...',
  'Loading scene engine...',
  'System ready.',
]

export default function Intro({ onEnter }) {
  const [lines, setLines] = useState([])

  useEffect(() => {
    let i = 0
    const id = setInterval(() => {
      if (i < BOOT_LINES.length) {
        setLines(prev => [...prev, BOOT_LINES[i]])
        i++
      } else {
        clearInterval(id)
        setTimeout(onEnter, 600)
      }
    }, 280)
    return () => clearInterval(id)
  }, [onEnter])

  return (
    <div className="splash">
      <div className="splash-ring">
        <div className="splash-ring-inner" />
      </div>
      <div className="splash-boot">
        {lines.map((line, i) => (
          <span key={i} className={`splash-line ${i === lines.length - 1 && line === 'System ready.' ? 'splash-line--ready' : ''}`}>
            <span className="splash-prefix">&gt;</span> {line}
          </span>
        ))}
        <span className="splash-cursor" />
      </div>
    </div>
  )
}
