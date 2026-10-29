import './Toggle.css'

export default function Toggle({ on }) {
  return (
    <div className={`toggle ${on ? 'on' : ''}`}>
      <div className="toggle-knob" />
    </div>
  )
}
