/**
 * The registrar's gating rule.
 *
 * These tests exist because the rule is a security control, not a convenience: an
 * account tool must never be visible to a signed-out agent. Each test would fail if the
 * registrar registered everything regardless of session, which is the obvious way to
 * break it.
 */

import { describe, expect, it, vi } from 'vitest'

import { createRegistrar, type ModelContext, type WebMCPTool } from './registry'

function tool(name: string): WebMCPTool {
  return {
    name,
    description: `${name} tool`,
    inputSchema: { type: 'object', properties: {} },
    execute: () => ({ ok: true }),
  }
}

const TOOLS = [tool('get_auth_status'), tool('search_providers'), tool('post_job'), tool('send_message')]
const PUBLIC = new Set(['get_auth_status', 'search_providers'])

interface RecordingContext extends ModelContext {
  registered: string[]
  signals: AbortSignal[]
}

function recordingContext(): RecordingContext {
  const context: RecordingContext = {
    registered: [],
    signals: [],
    registerTool: (def, options) => {
      context.registered.push(String((def as { name: string }).name))
      if (options?.signal) context.signals.push(options.signal)
    },
  }
  return context
}

function registrarFor(context: RecordingContext, isSignedIn: () => boolean) {
  let listener: (() => void) | null = null
  const registrar = createRegistrar({
    tools: TOOLS,
    publicToolNames: PUBLIC,
    isSignedIn,
    getModelContext: () => context,
    onAuthChange: (next) => {
      listener = next
      return () => {
        listener = null
      }
    },
  })
  return {
    registrar,
    signInStateChanged: () => listener?.(),
  }
}

describe('createRegistrar', () => {
  it('registers only the public tools while signed out', async () => {
    const context = recordingContext()
    const { registrar } = registrarFor(context, () => false)
    registrar.start()
    await registrar.sync()
    expect(context.registered.sort()).toEqual(['get_auth_status', 'search_providers'])
  })

  it('registers every tool once the person signs in', async () => {
    const context = recordingContext()
    let signedIn = false
    const { registrar } = registrarFor(context, () => signedIn)
    registrar.start()
    await registrar.sync()
    expect(context.registered).toHaveLength(2)

    signedIn = true
    await registrar.sync()
    expect(context.registered.sort()).toEqual([
      'get_auth_status',
      'post_job',
      'search_providers',
      'send_message',
    ])
  })

  it('aborts the account tools when the person signs out', async () => {
    const context = recordingContext()
    let signedIn = true
    const { registrar } = registrarFor(context, () => signedIn)
    registrar.start()
    await registrar.sync()
    expect(context.signals).toHaveLength(4)

    signedIn = false
    await registrar.sync()

    // The AbortSignal is the only way WebMCP removes a tool, so sign-out must abort it.
    const aborted = context.signals.filter((signal) => signal.aborted)
    expect(aborted).toHaveLength(2)
  })

  it('does nothing when the browser has no model context', async () => {
    const registrar = createRegistrar({
      tools: TOOLS,
      publicToolNames: PUBLIC,
      isSignedIn: () => true,
      getModelContext: () => null,
      onAuthChange: () => () => undefined,
    })
    registrar.start()
    await expect(registrar.sync()).resolves.toBeUndefined()
  })

  it('keeps going when a host rejects one registration', async () => {
    const rejected = vi.fn()
    const context: ModelContext = {
      registerTool: (def) => {
        const name = (def as { name: string }).name
        if (name === 'search_providers') throw new Error('duplicate name')
        rejected(name)
      },
    }
    const registrar = createRegistrar({
      tools: TOOLS,
      publicToolNames: PUBLIC,
      isSignedIn: () => false,
      getModelContext: () => context,
      onAuthChange: () => () => undefined,
    })
    registrar.start()
    await registrar.sync()
    // One rejected tool must not prevent the next one from registering.
    expect(rejected).toHaveBeenCalledWith('get_auth_status')
  })
})
