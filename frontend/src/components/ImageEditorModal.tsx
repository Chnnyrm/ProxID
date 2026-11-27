/**
 * ImageEditorModal.tsx
 *
 * Full-featured image editor modal:
 * - Crop with draggable/resizable frame and fixed aspect presets row (1:1, 4:5, 16:9, free).
 * - Rotate in 90-degree steps.
 * - Straighten within [-15, +15] degrees.
 * - Zoom and pan inside the crop frame.
 * - Horizontal and vertical flip.
 * - Brightness, contrast, and saturation adjustments.
 * - Instant reset button.
 * - Keyboard accessible, responsive down to 390px mobile viewports with touch gesture support:
 *   pinch-to-zoom, two-finger rotate, drag to pan.
 * - Reusable across avatars, service listings, and job requests.
 * - For avatars: locks aspect to 1:1 and exports 256px circle-ready image.
 * - Pure ASCII only.
 */

import {
  Check,
  Contrast,
  Crop,
  FlipHorizontal,
  FlipVertical,
  Maximize2,
  RotateCcw,
  RotateCw,
  SlidersHorizontal,
  Sun,
  X,
  ZoomIn,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

export type AspectRatioPreset = '1:1' | '4:5' | '16:9' | 'free'

export interface ImageEditorModalProps {
  isOpen: boolean
  file: File | null
  mode?: 'avatar' | 'listing' | 'general'
  onClose: () => void
  onComplete: (editedFile: File) => void
}

export function ImageEditorModal({
  isOpen,
  file,
  mode = 'general',
  onClose,
  onComplete,
}: ImageEditorModalProps) {
  const isAvatar = mode === 'avatar'

  // Image source and dimensions
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Transform states
  const [aspect, setAspect] = useState<AspectRatioPreset>(isAvatar ? '1:1' : '16:9')
  const [rotation, setRotation] = useState<number>(0) // 0, 90, 180, 270
  const [straighten, setStraighten] = useState<number>(0) // -15 to +15
  const [scale, setScale] = useState<number>(1) // 1 to 3
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [flipH, setFlipH] = useState<boolean>(false)
  const [flipV, setFlipV] = useState<boolean>(false)

  // Free aspect crop dimensions
  const [freeCropWidth, setFreeCropWidth] = useState<number>(260)
  const [freeCropHeight, setFreeCropHeight] = useState<number>(180)

  // Color adjustments
  const [brightness, setBrightness] = useState<number>(0) // -100 to 100
  const [contrast, setContrast] = useState<number>(0) // -100 to 100
  const [saturation, setSaturation] = useState<number>(0) // -100 to 100

  // Active control tab on mobile
  const [activeTab, setActiveTab] = useState<'crop' | 'adjust' | 'transform'>('crop')

  // Dragging / panning state
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  // Touch gesture state (pinch-to-zoom & two-finger rotate)
  const touchGestureRef = useRef<{
    initialDist: number
    initialScale: number
    initialAngle: number
    initialStraighten: number
  } | null>(null)

  // Resizing free crop frame
  const isResizingCropRef = useRef(false)
  const cropResizeStartRef = useRef<{ x: number; y: number; w: number; h: number }>({
    x: 0,
    y: 0,
    w: 260,
    h: 180,
  })

  // Load file preview
  useEffect(() => {
    if (!file) {
      setImageSrc(null)
      return
    }
    const url = URL.createObjectURL(file)
    setImageSrc(url)
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [file])

  // Reset transforms
  const handleReset = useCallback(() => {
    setAspect(isAvatar ? '1:1' : '16:9')
    setRotation(0)
    setStraighten(0)
    setScale(1)
    setPan({ x: 0, y: 0 })
    setFlipH(false)
    setFlipV(false)
    setBrightness(0)
    setContrast(0)
    setSaturation(0)
    setFreeCropWidth(260)
    setFreeCropHeight(180)
  }, [isAvatar])

  // Keyboard navigation & Escape / Enter
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        void handleApply()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Mouse pan handlers
  const handlePointerDown = (clientX: number, clientY: number) => {
    if (isResizingCropRef.current) return
    isDraggingRef.current = true
    dragStartRef.current = { x: clientX - pan.x, y: clientY - pan.y }
  }

  const handlePointerMove = (clientX: number, clientY: number) => {
    if (isResizingCropRef.current) {
      const deltaX = clientX - cropResizeStartRef.current.x
      const deltaY = clientY - cropResizeStartRef.current.y
      setFreeCropWidth(Math.max(120, Math.min(320, cropResizeStartRef.current.w + deltaX)))
      setFreeCropHeight(Math.max(100, Math.min(280, cropResizeStartRef.current.h + deltaY)))
      return
    }
    if (!isDraggingRef.current) return
    setPan({
      x: clientX - dragStartRef.current.x,
      y: clientY - dragStartRef.current.y,
    })
  }

  const handlePointerUp = () => {
    isDraggingRef.current = false
    isResizingCropRef.current = false
  }

  // Multi-touch gestures: Pinch-to-zoom & two-finger rotate
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      isDraggingRef.current = false
      const t1 = e.touches[0]
      const t2 = e.touches[1]
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
      const angle = (Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * 180) / Math.PI
      touchGestureRef.current = {
        initialDist: dist,
        initialScale: scale,
        initialAngle: angle,
        initialStraighten: straighten,
      }
    } else if (e.touches.length === 1) {
      const touch = e.touches[0]
      handlePointerDown(touch.clientX, touch.clientY)
    }
  }

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && touchGestureRef.current) {
      const t1 = e.touches[0]
      const t2 = e.touches[1]
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
      const angle = (Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * 180) / Math.PI

      // Pinch zoom
      const scaleRatio = dist / (touchGestureRef.current.initialDist || 1)
      const nextScale = Math.min(3, Math.max(1, touchGestureRef.current.initialScale * scaleRatio))
      setScale(Number(nextScale.toFixed(2)))

      // Two-finger rotate (affects straighten within -15 to +15)
      const angleDelta = angle - touchGestureRef.current.initialAngle
      const nextStraighten = Math.min(
        15,
        Math.max(-15, touchGestureRef.current.initialStraighten + angleDelta)
      )
      setStraighten(Number(nextStraighten.toFixed(1)))
    } else if (e.touches.length === 1) {
      const touch = e.touches[0]
      handlePointerMove(touch.clientX, touch.clientY)
    }
  }

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length < 2) {
      touchGestureRef.current = null
    }
    if (e.touches.length === 0) {
      handlePointerUp()
    }
  }

  // Rotation controls
  const handleRotateLeft = () => setRotation((prev) => (prev - 90 + 360) % 360)
  const handleRotateRight = () => setRotation((prev) => (prev + 90) % 360)

  // Aspect ratio calculation
  const getAspectMultiplier = (): number => {
    switch (aspect) {
      case '1:1':
        return 1
      case '4:5':
        return 5 / 4
      case '16:9':
        return 9 / 16
      case 'free':
      default:
        return 0 // fluid
    }
  }

  // Render and export edited result to Canvas
  const handleApply = async () => {
    if (!imageRef.current) return

    const img = imageRef.current
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Target export resolution
    let targetWidth = isAvatar ? 256 : Math.min(img.naturalWidth || 1200, 1600)
    const aspectMult = getAspectMultiplier()
    let targetHeight =
      aspectMult > 0 ? Math.round(targetWidth * aspectMult) : img.naturalHeight || 900

    if (isAvatar) {
      targetWidth = 256
      targetHeight = 256
    }

    canvas.width = targetWidth
    canvas.height = targetHeight

    // Apply color filter matrix via CSS filter on canvas context
    const bVal = 100 + brightness
    const cVal = 100 + contrast
    const sVal = 100 + saturation
    ctx.filter = `brightness(${bVal}%) contrast(${cVal}%) saturate(${sVal}%)`

    ctx.save()
    // Center of canvas for rotation and transforms
    ctx.translate(targetWidth / 2, targetHeight / 2)

    // Apply total rotation: 90-degree step + fine straighten angle
    const totalAngle = ((rotation + straighten) * Math.PI) / 180
    ctx.rotate(totalAngle)

    // Apply flip
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1)

    // Apply zoom scale
    ctx.scale(scale, scale)

    // Apply pan offset
    ctx.translate(pan.x * (targetWidth / 300), pan.y * (targetHeight / 300))

    // Draw source image centered
    const drawWidth = targetWidth
    const drawHeight = (img.naturalHeight / (img.naturalWidth || 1)) * targetWidth
    ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight)

    ctx.restore()

    // Export canvas as Blob -> File
    const originalType = file?.type || 'image/png'
    const exportType = isAvatar ? 'image/png' : originalType.includes('png') ? 'image/png' : 'image/jpeg'
    const exportExtension = exportType.includes('png') ? '.png' : '.jpg'
    const baseName = (file?.name || 'edited_image').replace(/\.[^/.]+$/, '')
    const finalFilename = `${baseName}_edited${exportExtension}`

    canvas.toBlob(
      (blob) => {
        if (!blob) return
        const editedFile = new File([blob], finalFilename, {
          type: exportType,
          lastModified: Date.now(),
        })
        onComplete(editedFile)
        onClose()
      },
      exportType,
      0.92
    )
  }

  if (!isOpen || !file || !imageSrc) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image Editor"
      className="fixed inset-0 z-[1250] flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-sm select-none"
    >
      <div className="relative w-full max-w-2xl rounded-2xl border-2 border-structural bg-surface shadow-2xl flex flex-col overflow-hidden max-h-[96vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-4 py-3 bg-sunken/40">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-md bg-accent text-accent-ink">
              <Crop size={16} />
            </span>
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-ink">
              {isAvatar ? 'Edit Profile Avatar' : 'Edit Image'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              data-testid="image-editor-reset-btn"
              className="px-2.5 py-1 text-xs font-mono font-bold text-muted hover:text-ink hover:underline transition-colors"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={onClose}
              data-testid="image-editor-close-btn"
              className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-sunken transition-colors"
              title="Close editor"
              aria-label="Close editor"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Workspace Canvas / Viewport */}
        <div
          ref={containerRef}
          data-testid="image-editor-workspace"
          onMouseDown={(e) => handlePointerDown(e.clientX, e.clientY)}
          onMouseMove={(e) => handlePointerMove(e.clientX, e.clientY)}
          onMouseUp={handlePointerUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="relative w-full h-[320px] sm:h-[380px] bg-sunken/80 overflow-hidden flex items-center justify-center cursor-move touch-none"
        >
          {/* Transformed Preview Image */}
          <img
            ref={imageRef}
            src={imageSrc}
            alt="Editing Preview"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) rotate(${rotation + straighten}deg) scale(${scale * (flipH ? -1 : 1)}, ${scale * (flipV ? -1 : 1)})`,
              filter: `brightness(${100 + brightness}%) contrast(${100 + contrast}%) saturate(${100 + saturation}%)`,
              transition: isDraggingRef.current ? 'none' : 'transform 0.1s ease-out',
            }}
            className="max-h-[85%] max-w-[85%] object-contain select-none pointer-events-none drop-shadow-md"
          />

          {/* Crop Overlay Grid */}
          <div
            style={
              aspect === 'free' && !isAvatar
                ? { width: `${freeCropWidth}px`, height: `${freeCropHeight}px` }
                : undefined
            }
            className={`absolute pointer-events-none border-2 border-accent/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] transition-all duration-200 ${
              isAvatar
                ? 'w-[200px] h-[200px] rounded-full'
                : aspect === '1:1'
                  ? 'w-[240px] h-[240px] rounded-xl'
                  : aspect === '4:5'
                    ? 'w-[200px] h-[250px] rounded-xl'
                    : aspect === '16:9'
                      ? 'w-[280px] h-[157px] rounded-xl'
                      : 'rounded-xl pointer-events-auto'
            }`}
          >
            {/* Rule of thirds lines (when not circular) */}
            {!isAvatar && (
              <div className="w-full h-full grid grid-cols-3 grid-rows-3 opacity-30 pointer-events-none">
                <div className="border-r border-b border-page" />
                <div className="border-r border-b border-page" />
                <div className="border-b border-page" />
                <div className="border-r border-b border-page" />
                <div className="border-r border-b border-page" />
                <div className="border-b border-page" />
                <div className="border-r border-b border-page" />
                <div className="border-r border-b border-page" />
                <div />
              </div>
            )}

            {/* Draggable corner handle for freeform crop */}
            {aspect === 'free' && !isAvatar && (
              <div
                onMouseDown={(e) => {
                  e.stopPropagation()
                  isResizingCropRef.current = true
                  cropResizeStartRef.current = {
                    x: e.clientX,
                    y: e.clientY,
                    w: freeCropWidth,
                    h: freeCropHeight,
                  }
                }}
                className="absolute -bottom-1 -right-1 w-4 h-4 bg-accent border border-surface rounded-full cursor-se-resize pointer-events-auto"
                title="Drag to resize crop area"
              />
            )}
          </div>
        </div>

        {/* Control Tabs on Mobile / Desktop */}
        <div className="border-t border-line bg-surface p-3 space-y-3">
          {/* Tab Selection */}
          <div className="flex items-center justify-center gap-2 border-b border-line pb-2 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('crop')}
              data-testid="editor-tab-crop"
              className={`px-3 py-1 rounded-lg font-mono font-bold uppercase transition-colors ${
                activeTab === 'crop'
                  ? 'bg-ink text-page shadow-xs'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Crop size={13} />
                <span>Crop & Aspect</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('transform')}
              data-testid="editor-tab-transform"
              className={`px-3 py-1 rounded-lg font-mono font-bold uppercase transition-colors ${
                activeTab === 'transform'
                  ? 'bg-ink text-page shadow-xs'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <RotateCw size={13} />
                <span>Rotate & Flip</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('adjust')}
              data-testid="editor-tab-adjust"
              className={`px-3 py-1 rounded-lg font-mono font-bold uppercase transition-colors ${
                activeTab === 'adjust'
                  ? 'bg-ink text-page shadow-xs'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <SlidersHorizontal size={13} />
                <span>Adjustments</span>
              </span>
            </button>
          </div>

          {/* Tab 1: Crop Aspect Presets & Zoom */}
          {activeTab === 'crop' && (
            <div className="space-y-3">
              {/* Aspect presets row */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-mono uppercase text-muted font-bold">Aspect:</span>
                <div className="flex items-center gap-1.5">
                  {(['1:1', '4:5', '16:9', 'free'] as AspectRatioPreset[]).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      disabled={isAvatar && preset !== '1:1'}
                      onClick={() => setAspect(preset)}
                      data-testid={`aspect-preset-${preset.replace(':', '-')}`}
                      className={`px-2.5 py-1 text-xs rounded-lg font-mono transition-colors ${
                        aspect === preset
                          ? 'bg-structural text-page font-bold'
                          : 'bg-sunken text-ink hover:bg-line disabled:opacity-30'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Zoom Slider */}
              <div className="flex items-center gap-3 text-xs">
                <span className="w-16 font-mono text-[11px] uppercase text-muted flex items-center gap-1">
                  <ZoomIn size={12} />
                  <span>Zoom</span>
                </span>
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.05"
                  value={scale}
                  onChange={(e) => setScale(parseFloat(e.target.value))}
                  data-testid="zoom-slider"
                  className="flex-1 accent-structural"
                />
                <span className="w-10 text-right font-mono text-ink text-xs">{scale.toFixed(1)}x</span>
              </div>
            </div>
          )}

          {/* Tab 2: Rotate, Straighten, Flip */}
          {activeTab === 'transform' && (
            <div className="space-y-3">
              {/* Rotate & Flip buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleRotateLeft}
                    data-testid="rotate-left-btn"
                    className="p-1.5 rounded-lg border border-line bg-surface text-ink hover:bg-sunken flex items-center gap-1 text-xs"
                    title="Rotate left 90 deg"
                  >
                    <RotateCcw size={14} />
                    <span className="font-mono text-[11px]">-90</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRotateRight}
                    data-testid="rotate-right-btn"
                    className="p-1.5 rounded-lg border border-line bg-surface text-ink hover:bg-sunken flex items-center gap-1 text-xs"
                    title="Rotate right 90 deg"
                  >
                    <RotateCw size={14} />
                    <span className="font-mono text-[11px]">+90</span>
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFlipH((prev) => !prev)}
                    data-testid="flip-h-btn"
                    className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 ${
                      flipH
                        ? 'border-structural bg-ink text-page font-bold'
                        : 'border-line bg-surface text-ink hover:bg-sunken'
                    }`}
                    title="Flip horizontally"
                  >
                    <FlipHorizontal size={14} />
                    <span className="font-mono text-[11px]">Flip H</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFlipV((prev) => !prev)}
                    data-testid="flip-v-btn"
                    className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 ${
                      flipV
                        ? 'border-structural bg-ink text-page font-bold'
                        : 'border-line bg-surface text-ink hover:bg-sunken'
                    }`}
                    title="Flip vertically"
                  >
                    <FlipVertical size={14} />
                    <span className="font-mono text-[11px]">Flip V</span>
                  </button>
                </div>
              </div>

              {/* Straighten Slider [-15, +15] */}
              <div className="flex items-center gap-3 text-xs">
                <span className="w-16 font-mono text-[11px] uppercase text-muted">Angle</span>
                <input
                  type="range"
                  min="-15"
                  max="15"
                  step="0.5"
                  value={straighten}
                  onChange={(e) => setStraighten(parseFloat(e.target.value))}
                  data-testid="straighten-slider"
                  className="flex-1 accent-structural"
                />
                <span className="w-12 text-right font-mono text-ink text-xs">
                  {straighten > 0 ? `+${straighten.toFixed(1)}` : straighten.toFixed(1)}
                </span>
              </div>
            </div>
          )}

          {/* Tab 3: Brightness, Contrast, Saturation */}
          {activeTab === 'adjust' && (
            <div className="space-y-2.5">
              {/* Brightness */}
              <div className="flex items-center gap-3 text-xs">
                <span className="w-20 font-mono text-[11px] uppercase text-muted flex items-center gap-1">
                  <Sun size={12} />
                  <span>Bright</span>
                </span>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  step="1"
                  value={brightness}
                  onChange={(e) => setBrightness(parseInt(e.target.value, 10))}
                  data-testid="brightness-slider"
                  className="flex-1 accent-structural"
                />
                <span className="w-10 text-right font-mono text-ink text-xs">{brightness}</span>
              </div>

              {/* Contrast */}
              <div className="flex items-center gap-3 text-xs">
                <span className="w-20 font-mono text-[11px] uppercase text-muted flex items-center gap-1">
                  <Contrast size={12} />
                  <span>Contrast</span>
                </span>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  step="1"
                  value={contrast}
                  onChange={(e) => setContrast(parseInt(e.target.value, 10))}
                  data-testid="contrast-slider"
                  className="flex-1 accent-structural"
                />
                <span className="w-10 text-right font-mono text-ink text-xs">{contrast}</span>
              </div>

              {/* Saturation */}
              <div className="flex items-center gap-3 text-xs">
                <span className="w-20 font-mono text-[11px] uppercase text-muted flex items-center gap-1">
                  <Maximize2 size={12} />
                  <span>Saturate</span>
                </span>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  step="1"
                  value={saturation}
                  onChange={(e) => setSaturation(parseInt(e.target.value, 10))}
                  data-testid="saturation-slider"
                  className="flex-1 accent-structural"
                />
                <span className="w-10 text-right font-mono text-ink text-xs">{saturation}</span>
              </div>
            </div>
          )}

          {/* Modal Footer Controls */}
          <div className="flex items-center justify-between pt-2 border-t border-line">
            <button
              type="button"
              onClick={onClose}
              data-testid="image-editor-cancel-btn"
              className="px-4 py-2 rounded-xl border border-line bg-surface text-ink text-xs font-bold hover:bg-sunken transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => void handleApply()}
              data-testid="image-editor-apply-btn"
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-ink text-page text-xs font-bold font-mono hover:opacity-90 transition-opacity shadow-sm"
            >
              <Check size={14} />
              <span>Apply & Save</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
