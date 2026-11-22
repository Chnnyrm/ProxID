/**
 * Routes. The shell (header, demo banner, theme) wraps every page, and a signed-in session
 * is restored once at boot rather than by each page.
 */

import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { DemoBanner } from '@/components/DemoBanner'
import { Header } from '@/components/Header'
import { AgentPage } from '@/pages/AgentPage'
import { JobRoomPage } from '@/pages/JobRoomPage'
import { JobsPage } from '@/pages/JobsPage'
import { LandingPage } from '@/pages/LandingPage'
import { LoginPage } from '@/pages/LoginPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { ProvidersPage } from '@/pages/ProvidersPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { useAuthStore } from '@/store/authStore'

export function App() {
  const bootstrap = useAuthStore((state) => state.bootstrap)
  const location = useLocation()
  const isLanding = location.pathname === '/'

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <DemoBanner />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/jobs/:jobId" element={<JobRoomPage />} />
          <Route path="/jobs/:jobId/room" element={<JobRoomPage />} />
          <Route path="/providers" element={<ProvidersPage />} />
          <Route path="/agent" element={<AgentPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!isLanding && (
        <footer className="border-t border-line px-4 py-4">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 text-xs text-muted">
            <span>ProxID. Local work, verified people.</span>
          </div>
        </footer>
      )}
    </div>
  )
}
