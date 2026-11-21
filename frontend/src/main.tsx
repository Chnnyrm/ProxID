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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A retry on a 4xx is a wasted request that also delays the message a person reads.
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 20_000,
    },
  },
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
