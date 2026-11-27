/**
 * CategorySelect.tsx
 *
 * Category dropdown with inline "+ Create category" workflow:
 * - Renders category options alphabetically.
 * - Inline "+ Create category" affordance for authenticated users.
 * - Auth check triggers auth modal if visitor is signed out.
 * - Guards against empty/whitespace names and case-insensitive duplicates.
 * - Selected immediately upon creation.
 * - Pure ASCII.
 */

import { Check, Plus, Tag, X } from 'lucide-react'
import { useState } from 'react'

import { useAuth } from '@/hooks/useAuth'
import { useCategories, useCreateCategory } from '@/hooks/useProviders'

interface CategorySelectProps {
  value: string
  onChange: (categoryId: string) => void
  categories?: Array<{ id: string; name: string }>
  label?: string
  placeholder?: string
  disabled?: boolean
  required?: boolean
  id?: string
}

export function CategorySelect({
  value,
  onChange,
  categories: propCategories,
  label = 'Category',
  placeholder = 'Select a category',
  disabled = false,
  required = false,
  id = 'category-select',
}: CategorySelectProps) {
  const { isSignedIn } = useAuth()
  const fetchedCategories = useCategories()
  const createCategoryMutation = useCreateCategory()

  const categories = propCategories || fetchedCategories.data || []

  const [isCreating, setIsCreating] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleStartCreate = () => {
    if (!isSignedIn) {
      window.dispatchEvent(
        new CustomEvent('proxid-require-auth', {
          detail: { action: 'create a new category' },
        })
      )
      return
    }
    setError(null)
    setNewCatName('')
    setIsCreating(true)
  }

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const clean = newCatName.trim()
    if (!clean) {
      setError('Enter a valid category name.')
      return
    }

    // Client-side case-insensitive duplicate check
    const existing = categories.find(
      (c) => c.name.trim().toLowerCase() === clean.toLowerCase()
    )
    if (existing) {
      setError(`Category "${existing.name}" already exists.`)
      onChange(existing.id)
      setIsCreating(false)
      return
    }

    try {
      const res = await createCategoryMutation.mutateAsync({ name: clean })
      const newId = res?.id ?? (res as unknown as { data?: { id?: string } })?.data?.id
      if (newId) {
        onChange(newId)
      }
      setIsCreating(false)
      setNewCatName('')
      setError(null)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not create category.'
      setError(msg)
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="block text-xs font-bold uppercase tracking-wider text-ink">
          {label} {required && <span className="text-accent">*</span>}
        </label>
        {!isCreating && (
          <button
            type="button"
            onClick={handleStartCreate}
            data-testid="inline-create-category-btn"
            className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-ink hover:underline cursor-pointer"
          >
            <Plus size={12} />
            <span>Create new</span>
          </button>
        )}
      </div>

      {!isCreating ? (
        <select
          id={id}
          value={value}
          onChange={(e) => {
            if (e.target.value === '__create_new__') {
              handleStartCreate()
            } else {
              onChange(e.target.value)
            }
          }}
          disabled={disabled}
          required={required}
          className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs sm:text-sm text-ink focus:outline-none focus:ring-1 focus:ring-structural"
        >
          <option value="">{placeholder}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="__create_new__">+ Create new category...</option>
        </select>
      ) : (
        /* Inline Creation Form */
        <div
          data-testid="inline-category-create-form"
          className="rounded-xl border border-structural/60 bg-sunken/60 p-3 space-y-2 animate-scale-up"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] font-bold uppercase text-ink flex items-center gap-1">
              <Tag size={12} />
              <span>New Category</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setIsCreating(false)
                setError(null)
              }}
              className="p-1 text-muted hover:text-ink rounded transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              autoFocus
              placeholder="e.g. Solar Maintenance"
              value={newCatName}
              onChange={(e) => {
                setNewCatName(e.target.value)
                if (error) setError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  void handleSaveCategory(e)
                } else if (e.key === 'Escape') {
                  setIsCreating(false)
                }
              }}
              className="flex-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink placeholder:text-muted focus:outline-none focus:border-structural"
            />
            <button
              type="button"
              onClick={(e) => void handleSaveCategory(e)}
              disabled={createCategoryMutation.isPending || !newCatName.trim()}
              data-testid="inline-category-save-btn"
              className="inline-flex items-center gap-1 rounded-lg border border-structural bg-ink px-3 py-1.5 text-xs font-mono font-bold text-page hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {createCategoryMutation.isPending ? (
                <span>Adding...</span>
              ) : (
                <>
                  <Check size={12} />
                  <span>Add</span>
                </>
              )}
            </button>
          </div>

          {error && (
            <p role="alert" className="text-[11px] font-mono text-ink bg-accent-wash border border-structural/40 rounded-md px-2 py-1">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
