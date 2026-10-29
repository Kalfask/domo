import DeviceCard from './DeviceCard'
import './LightsPage.css'

const DEVICES = [
  { id: 'desk-light', name: 'Desk light' },
  { id: 'room-lights', name: 'Room lights' },
]

export default function LightsPage() {
  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Light Control</h1>
        <span className="page-badge">{DEVICES.length} devices</span>
      </div>

      <section className="room-section">
        <h2 className="room-label">Office</h2>
        <div className="device-grid">
          {DEVICES.map(d => <DeviceCard key={d.id} device={d} />)}
        </div>
      </section>
    </div>
  )
}
