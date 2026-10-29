import './ScenesPage.css'

const SCENES = [
  { id: 'morning', name: 'Morning arrival', desc: 'Desk light on, room lights 60%' },
  { id: 'evening', name: 'Evening arrival', desc: 'Room lights warm, desk light off' },
  { id: 'leave', name: 'Left the room', desc: 'Everything off after 2 min' },
]

export default function ScenesPage() {
  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Scenes</h1>
        <span className="page-badge">{SCENES.length} configured</span>
      </div>

      <div className="scene-grid">
        {SCENES.map(s => (
          <div key={s.id} className="scene-tile">
            <svg className="scene-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M12 8v8" />
              <path d="M8 12h8" />
            </svg>
            <span className="scene-name">{s.name}</span>
            <span className="scene-desc">{s.desc}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
