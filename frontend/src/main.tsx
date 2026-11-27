/**
 * Entry point: the query client, the router, the stylesheet, and the WebMCP bootstrap.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import { App } from '@/App'
import { initWebMCP } from '@/lib/webmcp'
import '@/styles/index.css'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 45_000,
      gcTime: 10 * 60 * 1000,
      refetchOnMount: false,
    },
  },
})

// Hydrate most-read lists from persisted query cache on cold start
const PERSIST_CACHE_KEY = 'proxid_query_cache_v2'
try {
  const saved = localStorage.getItem(PERSIST_CACHE_KEY)
  if (saved) {
    const parsed = JSON.parse(saved) as Record<string, { data: unknown; updatedAt: number }>
    for (const [keyStr, entry] of Object.entries(parsed)) {
      if (Date.now() - entry.updatedAt < 10 * 60 * 1000) {
        queryClient.setQueryData(JSON.parse(keyStr), entry.data)
      }
    }
  }
} catch {
  // Ignore storage errors on restricted environments
}

// Persist most-read query responses on successful updates
queryClient.getQueryCache().subscribe((event) => {
  if (event.type === 'updated' && event.action.type === 'success') {
    const key = event.query.queryKey
    const firstKey = String(key[0])
    if (['jobs', 'listings', 'categories', 'services', 'providers', 'public-profile'].includes(firstKey)) {
      try {
        const saved = JSON.parse(localStorage.getItem(PERSIST_CACHE_KEY) || '{}')
        saved[JSON.stringify(key)] = {
          data: event.query.state.data,
          updatedAt: Date.now(),
        }
        localStorage.setItem(PERSIST_CACHE_KEY, JSON.stringify(saved))
      } catch {
        // Ignore storage errors
      }
    }
  }
})

// Registers the agent tools when the browser exposes WebMCP. A no-op elsewhere.
initWebMCP()

const container = document.getElementById('root')
if (!container) throw new Error('The root element is missing from index.html')

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
