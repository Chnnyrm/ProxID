/**
 * Registers and unregisters the agent tools for the current auth state.
 *
 * Ported from the previous project. WebMCP has no `unregisterTool`: a tool lives until the
 * AbortSignal passed at registration time is aborted, so one AbortController is kept per
 * registered tool and aborted the moment the tool must disappear.
 *
 * The gating rule is the point: signed out, only the public tools are registered. A
 * signed-out session does not merely fail an auth check at call time; it never sees the
 * account tools at all.
 *
 * Pure and dependency-injected, so it can be tested without a browser.
 */

export interface WebMCPTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  execute: (input: unknown) => unknown | Promise<unknown>
  annotations?: { readOnlyHint?: boolean }
}

export interface ModelContext {
  registerTool(def: Record<string, unknown>, options?: { signal?: AbortSignal }): Promise<void> | void
}

export interface RegistrarOptions {
  tools: readonly WebMCPTool[]
  /** Names that stay registered even while signed out. */
  publicToolNames: ReadonlySet<string>
  isSignedIn: () => boolean
  getModelContext: () => ModelContext | null
  /** Hooks an auth listener; returns an unsubscribe function. */
  onAuthChange: (listener: () => void) => () => void
}

export interface Registrar {
  start: () => void
  stop: () => void
  sync: () => Promise<void>
}

export function createRegistrar(opts: RegistrarOptions): Registrar {
  const controllers = new Map<string, AbortController>()
  const registered = new Set<string>()
  let stopped = false
  let queue: Promise<unknown> = Promise.resolve()
  let unsubscribe: (() => void) | null = null

  function desiredToolNames(): Set<string> {
    const signedIn = opts.isSignedIn()
    const names = new Set<string>()
    for (const tool of opts.tools) {
      if (signedIn || opts.publicToolNames.has(tool.name)) names.add(tool.name)
    }
    return names
  }

  async function sync(): Promise<void> {
    if (stopped) return
    const context = opts.getModelContext()
    if (!context || typeof context.registerTool !== 'function') return

    const desired = desiredToolNames()

    for (const [name, controller] of [...controllers.entries()]) {
      if (!desired.has(name)) {
        controller.abort()
        controllers.delete(name)
        registered.delete(name)
      }
    }

    for (const tool of opts.tools) {
      if (!desired.has(tool.name) || registered.has(tool.name)) continue
      const controller = new AbortController()
      controllers.set(tool.name, controller)
      try {
        await context.registerTool(
          {
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
            annotations: tool.annotations,
            execute: tool.execute,
          },
          { signal: controller.signal },
        )
        registered.add(tool.name)
      } catch {
        // A duplicate name or an invalid definition must not take the page down. Dropping
        // the controller lets a later sync retry.
        if (controllers.get(tool.name) === controller) controllers.delete(tool.name)
      }
    }
  }

  function schedule(): void {
    queue = queue.then(sync).catch(() => undefined)
  }

  return {
    start() {
      if (stopped) return
      schedule()
      if (!unsubscribe) unsubscribe = opts.onAuthChange(() => schedule())
    },
    stop() {
      stopped = true
      if (unsubscribe) {
        unsubscribe()
        unsubscribe = null
      }
      for (const controller of controllers.values()) controller.abort()
      controllers.clear()
      registered.clear()
    },
    sync,
  }
}
