import { useState } from 'react'
import Intro from './components/Intro'
import Nav from './components/Nav'
import LightsPage from './components/LightsPage'
import ScenesPage from './components/ScenesPage'
import EventsPage from './components/EventsPage'
import './App.css'

export default function App() {
  const [entered, setEntered] = useState(false)
  const [page, setPage] = useState('lights')

  if (!entered) {
    return <Intro onEnter={() => setEntered(true)} />
  }

  return (
    <div className="app">
      <Nav current={page} onChange={setPage} />
      <main className="app-main">
        {page === 'lights' && <LightsPage />}
        {page === 'scenes' && <ScenesPage />}
        {page === 'events' && <EventsPage />}
      </main>
    </div>
  )
}
