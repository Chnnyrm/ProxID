/**
 * useMedia.ts - Media and image asset upload hook.
 * Pure ASCII.
 */

import { useMutation } from '@tanstack/react-query'

import { authService } from '@/services/authService'

export function useUploadMedia() {
  return useMutation({
    mutationFn: ({ file, purpose = 'listings' }: { file: File; purpose?: string }) =>
      authService.uploadMedia(file, purpose),
  })
}
