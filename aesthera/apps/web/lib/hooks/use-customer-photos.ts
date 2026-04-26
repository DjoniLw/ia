import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

// ──── Types ────────────────────────────────────────────────────────────────────

export type PhotoCategory =
  | 'BEFORE_PHOTO'
  | 'AFTER_PHOTO'
  | 'PROGRESS_PHOTO'
  | 'GALLERY_PHOTO'

export interface CustomerPhoto {
  id: string
  category: PhotoCategory
  takenAt: string | null
  bodyRegion: string | null
  notes: string | null
  measurementSessionId: string | null
  uploadedByProfessional: { id: string; name: string } | null
  storageKey: string
  url: string
}

export interface PhotoUploadUrlItem {
  storageKey: string
  uploadUrl: string
}

export interface RequestUploadUrlsResponse {
  uploads: PhotoUploadUrlItem[]
}

export interface CreatePhotoItem {
  storageKey: string
  category: PhotoCategory
  takenAt?: string
  bodyRegion?: string
  notes?: string
  sessionId?: string
}

interface ListPhotosQuery {
  category?: PhotoCategory
  bodyRegion?: string
  takenAtFrom?: string
  takenAtTo?: string
  limit?: number
}

// ──── Hooks ────────────────────────────────────────────────────────────────────

export function useCustomerPhotos(customerId: string, query: ListPhotosQuery = {}) {
  return useInfiniteQuery({
    queryKey: ['customer-photos', customerId, query],
    queryFn: async ({ pageParam = 1 }) => {
      const params = new URLSearchParams({ page: String(pageParam), limit: String(query.limit ?? 24) })
      if (query.category) params.set('category', query.category)
      if (query.bodyRegion) params.set('bodyRegion', query.bodyRegion)
      if (query.takenAtFrom) params.set('takenAtFrom', query.takenAtFrom)
      if (query.takenAtTo) params.set('takenAtTo', query.takenAtTo)
      const { data } = await api.get<{ items: CustomerPhoto[]; total: number; page: number; limit: number }>(
        `/customers/${customerId}/photos?${params}`,
      )
      return data
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page * lastPage.limit < lastPage.total ? lastPage.page + 1 : undefined,
    enabled: Boolean(customerId),
  })
}

export function useRequestPhotoUploadUrls(customerId: string) {
  return useMutation({
    mutationFn: async (items: Array<{ filename: string; mimeType: string; sizeBytes: number }>) => {
      const { data } = await api.post<RequestUploadUrlsResponse>(
        `/customers/${customerId}/photos/upload-url`,
        { files: items },
      )
      return data
    },
  })
}

export function useCreatePhotos(customerId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (photos: CreatePhotoItem[]) => {
      const { data } = await api.post<CustomerPhoto[]>(
        `/customers/${customerId}/photos`,
        { photos },
      )
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-photos', customerId] })
    },
  })
}

export function useDeletePhoto(customerId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ photoId, reason }: { photoId: string; reason: string }) => {
      await api.delete(`/customers/${customerId}/photos/${photoId}`, {
        data: { reason },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-photos', customerId] })
    },
  })
}

export function useGetPhotoUrl(customerId: string, photoId: string, enabled = false) {
  return useQuery({
    queryKey: ['photo-url', customerId, photoId],
    queryFn: async () => {
      const { data } = await api.get<{ url: string }>(
        `/customers/${customerId}/photos/${photoId}/url`,
      )
      return data.url
    },
    enabled,
    staleTime: 1000 * 60 * 55, // 55 min — presigned URL válida por ~1h
  })
}

// ──── Body Regions ─────────────────────────────────────────────────────────────

export function usePhotoBodyRegions() {
  return useQuery({
    queryKey: ['photo-body-regions'],
    queryFn: async () => {
      const { data } = await api.get<{ regions: string[] }>('/settings/photo-body-regions')
      return data.regions
    },
    staleTime: 1000 * 60 * 5,
  })
}

export function useUpdatePhotoBodyRegions() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (regions: string[]) => {
      await api.patch('/settings/photo-body-regions', { regions })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photo-body-regions'] })
    },
  })
}
