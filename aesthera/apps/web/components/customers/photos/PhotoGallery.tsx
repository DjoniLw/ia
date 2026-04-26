'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ImageIcon, Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRole } from '@/lib/hooks/use-role'
import { useCustomerPhotos } from '@/lib/hooks/use-customer-photos'
import type { PhotoCategory, CustomerPhoto } from '@/lib/hooks/use-customer-photos'
import { PhotoCard } from './PhotoCard'
import type { PhotoItem } from './PhotoCard'
import { PhotoFilterPills } from './PhotoFilterPills'
import { PhotoLightbox } from './PhotoLightbox'
import { PhotoUploadSheet } from './PhotoUploadSheet'

type FilterCategory = PhotoCategory | 'all'

interface PhotoGalleryProps {
  customerId: string
  /** Callback para abrir aba Avaliações quando "Ver sessão" é clicado no lightbox */
  onViewSession?: (sessionId: string) => void
}

function toPhotoItem(p: CustomerPhoto): PhotoItem {
  return {
    id: p.id,
    url: p.url,
    category: p.category,
    takenAt: p.takenAt,
    bodyRegion: p.bodyRegion,
    notes: p.notes,
    measurementSessionId: p.measurementSessionId,
    uploadedByProfessional: p.uploadedByProfessional,
  }
}

export function PhotoGallery({ customerId, onViewSession }: PhotoGalleryProps) {
  const role = useRole()
  const canUpload = role === 'admin' || role === 'staff' || role === 'professional'

  const [filterCategory, setFilterCategory] = useState<FilterCategory>('all')
  const [takenAtFrom, setTakenAtFrom] = useState('')
  const [takenAtTo, setTakenAtTo] = useState('')
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)

  const sentinelRef = useRef<HTMLDivElement>(null)

  const {
    data,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    isLoading,
    isError,
    refetch,
  } = useCustomerPhotos(customerId, {
    category: filterCategory === 'all' ? undefined : filterCategory,
    takenAtFrom: takenAtFrom || undefined,
    takenAtTo: takenAtTo || undefined,
  })

  // Agrega todas as páginas em array flat
  const photos: PhotoItem[] = (data?.pages ?? []).flatMap((page) =>
    page.items.map(toPhotoItem),
  )

  // IntersectionObserver para scroll infinito
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { threshold: 0.1 },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const handleCardClick = useCallback(
    (photo: PhotoItem) => {
      const idx = photos.findIndex((p) => p.id === photo.id)
      setLightboxIndex(idx)
    },
    [photos],
  )

  // Estado de carregamento inicial — skeleton grid
  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <SkeletonFilters />
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  // Estado de erro
  if (isError) {
    return (
      <div className="rounded-lg border bg-card py-16 text-center text-muted-foreground">
        <p className="mb-3 text-sm">Não foi possível carregar as fotos.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Tentar novamente
        </Button>
      </div>
    )
  }

  // Estado vazio — sem nenhuma foto registrada
  if (photos.length === 0 && filterCategory === 'all' && !takenAtFrom && !takenAtTo) {
    return (
      <div className="rounded-lg border bg-card py-16 text-center text-muted-foreground">
        <ImageIcon className="mx-auto mb-3 h-10 w-10 opacity-40" />
        <p className="mb-4 text-sm">Nenhuma foto registrada.</p>
        {canUpload && (
          <>
            <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar primeira foto
            </Button>
            <PhotoUploadSheet
              customerId={customerId}
              open={uploadOpen}
              onClose={() => setUploadOpen(false)}
            />
          </>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Barra de filtros + botão de upload */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PhotoFilterPills
          value={filterCategory}
          onChange={setFilterCategory}
          takenAtFrom={takenAtFrom}
          takenAtTo={takenAtTo}
          onDateFromChange={setTakenAtFrom}
          onDateToChange={setTakenAtTo}
        />

        {canUpload && (
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar fotos
          </Button>
        )}
      </div>

      {/* Estado vazio após filtro */}
      {photos.length === 0 && (
        <div className="rounded-lg border bg-card py-16 text-center text-muted-foreground">
          <p className="text-sm">Nenhuma foto encontrada para os filtros selecionados.</p>
        </div>
      )}

      {/* Grade de fotos */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {photos.map((photo) => (
            <PhotoCard key={photo.id} photo={photo} onClick={handleCardClick} />
          ))}
        </div>
      )}

      {/* Sentinel para scroll infinito */}
      <div ref={sentinelRef} className="flex h-8 items-center justify-center">
        {isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={photos}
          initialIndex={lightboxIndex}
          open={lightboxIndex !== null}
          onClose={() => setLightboxIndex(null)}
          onViewSession={onViewSession}
        />
      )}

      {/* Sheet de upload */}
      <PhotoUploadSheet
        customerId={customerId}
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
      />
    </div>
  )
}

// ──── Skeleton auxiliar ───────────────────────────────────────────────────────

function SkeletonFilters() {
  return (
    <div className="flex gap-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-6 w-20 animate-pulse rounded-full bg-muted" />
      ))}
    </div>
  )
}
