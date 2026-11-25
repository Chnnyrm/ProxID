/**
 * lightboxStore.ts - Global state for image lightbox viewer and downloader.
 * Pure ASCII.
 */

import { create } from 'zustand'

interface LightboxState {
  isOpen: boolean
  imageUrl: string | null
  title: string
  openLightbox: (imageUrl: string | null | undefined, title?: string) => void
  closeLightbox: () => void
}

export const useLightboxStore = create<LightboxState>((set) => ({
  isOpen: false,
  imageUrl: null,
  title: '',
  openLightbox: (imageUrl, title = 'Image Preview') => {
    if (!imageUrl) return
    set({
      isOpen: true,
      imageUrl,
      title,
    })
  },
  closeLightbox: () => set({ isOpen: false, imageUrl: null, title: '' }),
}))
