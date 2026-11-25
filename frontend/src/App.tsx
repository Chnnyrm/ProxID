/**
 * Routes. The shell (header, demo banner, theme) wraps every page, and a signed-in session
 * is restored once at boot rather than by each page.
 */

import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { Header } from '@/components/Header'
import { Navigation } from '@/components/Navigation'
import OnboardingOverlay from '@/components/OnboardingOverlay'
import VoiceAssistant from '@/components/VoiceAssistant'
import { registerServiceWorker, syncPushSubscription } from '@/lib/push'
import { AgentPage } from '@/pages/AgentPage'
import { JobDetailPage } from '@/pages/JobDetailPage'
import { JobRoomPage } from '@/pages/JobRoomPage'
import { JobsPage } from '@/pages/JobsPage'
import { LandingPage } from '@/pages/LandingPage'
import { LoginPage } from '@/pages/LoginPage'
import { MapPage } from '@/pages/MapPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { ServicesPage } from '@/pages/ServicesPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { useAuthStore } from '@/store/authStore'

export function App() {
  const bootstrap = useAuthStore((state) => state.bootstrap)
  const session = useAuthStore((state) => state.session)
  const location = useLocation()
  const isLanding = location.pathname === '/'

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  useEffect(() => {
    void registerServiceWorker()
  }, [])

  useEffect(() => {
    if (session) {
      void syncPushSubscription()
    }
  }, [session])

  return (
    <div className="flex min-h-screen flex-col bg-page text-ink">
      <Navigation />
      <Header />
      <OnboardingOverlay />
      <VoiceAssistant />
      <main className="flex-1 lg:pl-24 pb-20 lg:pb-0">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/jobs/:jobId" element={<JobDetailPage />} />
          <Route path="/jobs/:jobId/room" element={<JobRoomPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/providers" element={<Navigate to="/services" replace />} />
          <Route path="/agent" element={<AgentPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!isLanding && (
        <footer className="border-t border-line px-4 py-6 lg:pl-28 mb-16 lg:mb-0">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 text-xs text-muted">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
              PROXID // CONCORDIUM ZERO-KNOWLEDGE PROXIMITY INDEX
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
              ATTESTED NODES ONLY // NO SPECULATIVE ASSETS
            </span>
          </div>
        </footer>
      )}
    </div>
  )
}
