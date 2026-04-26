'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, ExternalLink, Loader2, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PhotoTagBadge } from './PhotoTagBadge'
import { cn } from '@/lib/utils'
import type { PhotoItem } from './PhotoCard'

interface PhotoLightboxProps {
  photos: PhotoItem[]
  initialIndex: number
  open: boolean
  onClose: () => void
  /** Chamado quando o usuário clica em "Ver sessão" — abre aba Avaliações */
  onViewSession?: (sessionId: string) => void
  /** Callback para re-requisitar URL ao expirar */
  onRefreshUrl?: (photoId: string) => Promise<string>
}

export function PhotoLightbox({
  photos,
  initialIndex,
  open,
  onClose,
  onViewSession,
  onRefreshUrl,
}: PhotoLightboxProps) {
  const [index, setIndex] = useState(initialIndex)
  const [imgError, setImgError] = useState(false)
  const [imgLoading, setImgLoading] = useState(true)
  const touchStartX = useRef<number | null>(null)

  const photo = photos[index]

  // Sincroniza index quando o modal abre
  useEffect(() => {
    if (open) {
      setIndex(initialIndex)
      setImgError(false)
      setImgLoading(true)
    }
  }, [open, initialIndex])

  const goTo = useCallback(
    (newIndex: number) => {
      const clamped = (newIndex + photos.length) % photos.length
      setIndex(clamped)
      setImgError(false)
      setImgLoading(true)
    },
    [photos.length],
  )

  // Navegação por teclado
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goTo(index - 1)
      else if (e.key === 'ArrowRight') goTo(index + 1)
      else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, index, goTo, onClose])

  // Suporte a swipe mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const delta = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(delta) > 50) goTo(delta < 0 ? index + 1 : index - 1)
    touchStartX.current = null
  }

  const handleRefresh = async () => {
    if (!onRefreshUrl || !photo) return
    setImgError(false)
    setImgLoading(true)
    try {
      await onRefreshUrl(photo.id)
    } catch {
      setImgError(true)
      setImgLoading(false)
    }
  }

  if (!open || !photo) return null

  const date = photo.takenAt
    ? new Date(photo.takenAt).toLocaleDateString('pt-BR')
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div
        className="relative z-10 flex h-[calc(100dvh-2rem)] w-full max-w-5xl flex-col gap-0 overflow-hidden rounded-lg bg-black/95"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-white/60">
            {index + 1} / {photos.length}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="text-white/80 hover:text-white"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Imagem */}
        <div className="relative flex flex-1 items-center justify-center overflow-hidden">
          {imgLoading && !imgError && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-white/60" />
              <span className="ml-2 text-sm text-white/60">Carregando...</span>
            </div>
          )}

          {imgError ? (
            <div className="flex flex-col items-center gap-3 text-white/60">
              <span className="text-sm">Não foi possível carregar a foto.</span>
              {onRefreshUrl && (
                <Button variant="outline" size="sm" onClick={handleRefresh}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Recarregar
                </Button>
              )}
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={photo.id}
              src={photo.url}
              alt=""
              className={cn(
                'max-h-full max-w-full object-contain transition-opacity',
                imgLoading ? 'opacity-0' : 'opacity-100',
              )}
              onLoad={() => setImgLoading(false)}
              onError={() => {
                setImgLoading(false)
                setImgError(true)
              }}
            />
          )}

          {/* Setas de navegação */}
          {photos.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Foto anterior"
                onClick={() => goTo(index - 1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white hover:bg-black/70"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                aria-label="Próxima foto"
                onClick={() => goTo(index + 1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white hover:bg-black/70"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}
        </div>

        {/* Painel de informações — sempre visível (não precisa de hover/mobile) */}
        <div className="flex flex-wrap items-start gap-3 border-t border-white/10 px-4 py-3">
          <PhotoTagBadge category={photo.category} />

          {date && (
            <span className="text-xs text-white/60">{date}</span>
          )}

          {photo.bodyRegion && (
            <span className="text-xs text-white/60">{photo.bodyRegion}</span>
          )}

          {photo.uploadedByProfessional && (
            <span className="text-xs text-white/60">
              por {photo.uploadedByProfessional.name}
            </span>
          )}

          {photo.notes && (
            <p className="w-full text-xs text-white/70">{photo.notes}</p>
          )}

          {photo.measurementSessionId && (
            <div className="flex w-full items-center gap-2 rounded bg-white/10 px-2 py-1.5">
              <span className="text-xs text-white/80">
                Vinculada à sessão de avaliação
                {date ? ` de ${date}` : ''}
              </span>
              {onViewSession && (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs text-blue-300 hover:text-blue-200"
                  onClick={() => {
                    onClose()
                    onViewSession(photo.measurementSessionId!)
                  }}
                >
                  Ver sessão
                  <ExternalLink className="ml-1 h-3 w-3" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
