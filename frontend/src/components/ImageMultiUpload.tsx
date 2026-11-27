/**
 * ImageMultiUpload.tsx
 *
 * Multi-image picker and uploader:
 * - 1 to 5 images supported.
 * - Multi-select file picker using existing /api/v1/upload endpoint.
 * - ImageEditorModal integrated before upload for cropping, rotation, adjustments.
 * - Drag-and-drop or directional reordering controls.
 * - Remove control per image.
 * - Cover badge on index 0.
 * - Per-file upload progress and error states.
 * - Pure ASCII.
 */

import { ArrowLeft, ArrowRight, ImagePlus, Loader2, X } from 'lucide-react'
import { useRef, useState } from 'react'

import { ImageEditorModal } from '@/components/ImageEditorModal'
import { useUploadMedia } from '@/hooks/useMedia'

interface ImageMultiUploadProps {
  value: string[]
  onChange: (urls: string[]) => void
  maxImages?: number
  disabled?: boolean
}

interface UploadingItem {
  id: string
  name: string
  error?: string
}

export function ImageMultiUpload({
  value,
  onChange,
  maxImages = 5,
  disabled = false,
}: ImageMultiUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadMedia = useUploadMedia()
  const [uploadingList, setUploadingList] = useState<UploadingItem[]>([])
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  // Editor modal state
  const [pendingQueue, setPendingQueue] = useState<File[]>([])
  const [currentEditFile, setCurrentEditFile] = useState<File | null>(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    const remainingSlots = maxImages - (value.length + uploadingList.length)
    if (remainingSlots <= 0) return

    const selectedFiles = files.slice(0, remainingSlots)

    // Clear input so selecting the same file again triggers change
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }

    if (selectedFiles.length > 0) {
      setCurrentEditFile(selectedFiles[0])
      setPendingQueue(selectedFiles.slice(1))
      setIsEditorOpen(true)
    }
  }

  const handleEditorComplete = async (editedFile: File) => {
    setIsEditorOpen(false)
    const fileToUpload = editedFile
    const nextInQueue = pendingQueue[0] || null
    const remainingQueue = pendingQueue.slice(1)

    // Start uploading the edited file
    const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setUploadingList((prev) => [...prev, { id: uploadId, name: fileToUpload.name }])

    uploadMedia
      .mutateAsync({ file: fileToUpload, purpose: 'listings' })
      .then((res) => {
        const uploadedUrl = res.data?.url
        if (uploadedUrl) {
          onChange([...value, uploadedUrl])
        }
      })
      .catch(() => {
        setUploadingList((prev) =>
          prev.map((item) =>
            item.id === uploadId ? { ...item, error: 'Upload failed' } : item
          )
        )
        setTimeout(() => {
          setUploadingList((prev) => prev.filter((item) => item.id !== uploadId))
        }, 2500)
      })
      .finally(() => {
        setUploadingList((prev) => prev.filter((item) => item.id !== uploadId))
      })

    // Advance queue if more files exist
    if (nextInQueue) {
      setCurrentEditFile(nextInQueue)
      setPendingQueue(remainingQueue)
      setIsEditorOpen(true)
    } else {
      setCurrentEditFile(null)
      setPendingQueue([])
    }
  }

  const handleEditorClose = () => {
    setIsEditorOpen(false)
    const nextInQueue = pendingQueue[0] || null
    const remainingQueue = pendingQueue.slice(1)
    if (nextInQueue) {
      setCurrentEditFile(nextInQueue)
      setPendingQueue(remainingQueue)
      setIsEditorOpen(true)
    } else {
      setCurrentEditFile(null)
      setPendingQueue([])
    }
  }

  const handleRemove = (indexToRemove: number) => {
    const updated = value.filter((_, idx) => idx !== indexToRemove)
    onChange(updated)
  }

  const handleMove = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= value.length) return
    const updated = [...value]
    const [moved] = updated.splice(fromIndex, 1)
    updated.splice(toIndex, 0, moved)
    onChange(updated)
  }

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (targetIndex: number) => {
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null)
      return
    }
    handleMove(draggedIndex, targetIndex)
    setDraggedIndex(null)
  }

  const canAddMore = value.length + uploadingList.length < maxImages && !disabled

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold uppercase tracking-wider text-ink">
          Photos ({value.length}/{maxImages})
        </label>
        <span className="font-mono text-[11px] text-muted">
          First photo will be the cover
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
        {/* Uploaded Images */}
        {value.map((url, idx) => (
          <div
            key={url}
            draggable={!disabled}
            onDragStart={() => handleDragStart(idx)}
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(idx)}
            className={`group relative aspect-[4/3] rounded-xl border border-line bg-sunken overflow-hidden transition-all duration-150 select-none ${
              draggedIndex === idx ? 'opacity-40 scale-95 border-dashed border-structural' : 'hover:border-structural'
            }`}
          >
            <img
              src={url}
              alt={`Listing photo ${idx + 1}`}
              className="h-full w-full object-cover"
              loading="lazy"
            />

            {/* Cover Badge on Index 0 */}
            {idx === 0 && (
              <span className="absolute top-1.5 left-1.5 rounded-md border border-line/60 bg-ink px-1.5 py-0.5 font-mono text-[9px] uppercase font-bold text-page tracking-wider shadow-xs">
                Cover
              </span>
            )}

            {/* Remove Control */}
            {!disabled && (
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-ink/80 text-page flex items-center justify-center hover:bg-ink transition-colors shadow-xs"
                title="Remove photo"
              >
                <X size={13} />
              </button>
            )}

            {/* Reorder Directional Buttons */}
            {!disabled && value.length > 1 && (
              <div className="absolute bottom-1.5 inset-x-1.5 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => handleMove(idx, idx - 1)}
                  className="h-5 w-5 rounded bg-ink/80 text-page flex items-center justify-center hover:bg-ink disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  title="Move left"
                >
                  <ArrowLeft size={11} />
                </button>
                <button
                  type="button"
                  disabled={idx === value.length - 1}
                  onClick={() => handleMove(idx, idx + 1)}
                  className="h-5 w-5 rounded bg-ink/80 text-page flex items-center justify-center hover:bg-ink disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  title="Move right"
                >
                  <ArrowRight size={11} />
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Uploading In-Progress Items */}
        {uploadingList.map((item) => (
          <div
            key={item.id}
            className="aspect-[4/3] rounded-xl border border-dashed border-structural/60 bg-surface flex flex-col items-center justify-center p-2 text-center text-xs animate-pulse"
          >
            {item.error ? (
              <span className="text-[11px] font-bold text-ink">{item.error}</span>
            ) : (
              <>
                <Loader2 size={16} className="animate-spin text-ink mb-1" />
                <span className="text-[10px] text-muted truncate max-w-full font-mono">
                  {item.name}
                </span>
                <span className="text-[9px] text-muted font-mono">Uploading...</span>
              </>
            )}
          </div>
        ))}

        {/* Add Photo Button Tile */}
        {canAddMore && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="aspect-[4/3] rounded-xl border border-dashed border-line hover:border-structural bg-sunken/40 hover:bg-sunken flex flex-col items-center justify-center gap-1 text-muted hover:text-ink transition-colors cursor-pointer group"
          >
            <ImagePlus size={20} className="group-hover:scale-110 transition-transform" />
            <span className="font-mono text-[11px] font-bold">Add Photo</span>
            <span className="text-[9px] text-muted">Up to 5 photos</span>
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleFilesSelected}
        className="hidden"
      />

      {/* Editing modal before upload */}
      <ImageEditorModal
        isOpen={isEditorOpen}
        file={currentEditFile}
        mode="listing"
        onClose={handleEditorClose}
        onComplete={handleEditorComplete}
      />
    </div>
  )
}
