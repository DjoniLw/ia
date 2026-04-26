'use client'

import { Calendar, Link2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PhotoTagBadge } from './PhotoTagBadge'
import { PHOTO_TAG_COLOR } from '@/lib/status-colors'
import { cn } from '@/lib/utils'

type PhotoCategory = keyof typeof PHOTO_TAG_COLOR

export interface PhotoItem {
  id: string
  url: string
  category: PhotoCategory
  takenAt?: string | null
  bodyRegion?: string | null
  notes?: string | null
  measurementSessionId?: string | null
  uploadedByProfessional?: { id: string; name: string } | null
}

interface PhotoCardProps {
  photo: PhotoItem
  onClick: (photo: PhotoItem) => void
}

export function PhotoCard({ photo, onClick }: PhotoCardProps) {
  const date = photo.takenAt
    ? new Date(photo.takenAt).toLocaleDateString('pt-BR')
    : null

  return (
    <Button
      variant="ghost"
      onClick={() => onClick(photo)}
      className={cn(
        'group relative aspect-square h-auto w-full overflow-hidden rounded-lg border border-border bg-muted p-0',
        'focus-visible:ring-2 focus-visible:ring-primary',
      )}
      aria-label={`Foto — ${PHOTO_TAG_COLOR[photo.category].label}${date ? ` — ${date}` : ''}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.url}
        alt=""
        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
        loading="lazy"
      />

      {/* Overlay com badges */}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-1 bg-gradient-to-t from-black/60 to-transparent p-2">
        <PhotoTagBadge category={photo.category} />

        {photo.measurementSessionId && (
          <Link2 className="h-3.5 w-3.5 shrink-0 text-white" aria-label="Vinculada à sessão" />
        )}
      </div>

      {date && (
        <div className="absolute right-1 top-1 flex items-center gap-0.5 rounded bg-black/50 px-1 py-0.5">
          <Calendar className="h-3 w-3 text-white" />
          <span className="text-[10px] text-white">{date}</span>
        </div>
      )}
    </Button>
  )
}
