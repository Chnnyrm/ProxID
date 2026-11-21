/**
 * Frontend entry point for the architecture check.
 *
 * The rules live in backend/arch_check.py, which scans both trees in one pass: layer
 * direction, no emoji, no direct transport access from a page. Keeping one implementation
 * means the two entry points cannot disagree about what is allowed.
 *
 * Run from the frontend directory: npm run arch-check
 */

import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const backend = resolve(here, '../../backend')

const result = spawnSync('python3', ['arch_check.py'], { cwd: backend, stdio: 'inherit' })
if (result.error) {
  console.error('[FAIL] could not run the architecture check:', result.error.message)
  process.exit(1)
}
process.exit(result.status ?? 1)
