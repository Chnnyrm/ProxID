/**
 * Class name composition. Two utilities, no abstraction: conditional strings and
 * Tailwind conflict resolution.
 */

import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
