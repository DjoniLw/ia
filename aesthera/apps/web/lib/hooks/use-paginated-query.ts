'use client'

import { useCallback, useMemo } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'

function getStoredPageSize(lsKey: string): string | null {
  if (typeof window === 'undefined') return null
  try { return localStorage.getItem(lsKey) } catch { return null }
}

interface UsePaginatedQueryOptions {
  defaultPageSize?: number
  paramPrefix?: string
}

interface UsePaginatedQueryResult {
  page: number
  pageSize: number
  setPage: (page: number) => void
  setPageSize: (size: number) => void
  resetPage: () => void
  paginationParams: Record<string, string>
}

export function usePaginatedQuery(options: UsePaginatedQueryOptions = {}): UsePaginatedQueryResult {
  const { defaultPageSize = 20, paramPrefix = '' } = options

  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  const pageKey = paramPrefix ? `${paramPrefix}_page` : 'page'
  const pageSizeKey = paramPrefix ? `${paramPrefix}_pageSize` : 'pageSize'
  const lsKey = `aesthera-pageSize${paramPrefix ? `-${paramPrefix}` : ''}-${pathname}`

  const page = Math.max(1, parseInt(searchParams.get(pageKey) ?? '1', 10) || 1)
  const pageSize = Math.max(
    1,
    parseInt(
      searchParams.get(pageSizeKey) ??
        getStoredPageSize(lsKey) ??
        String(defaultPageSize),
      10,
    ) || defaultPageSize,
  )

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const current = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (value === null) {
          current.delete(key)
        } else {
          current.set(key, value)
        }
      }
      router.replace(`?${current.toString()}`, { scroll: false })
    },
    [router, searchParams],
  )

  const setPage = useCallback(
    (newPage: number) => {
      updateParams({ [pageKey]: String(newPage) })
    },
    [updateParams, pageKey],
  )

  const setPageSize = useCallback(
    (newSize: number) => {
      updateParams({ [pageSizeKey]: String(newSize), [pageKey]: '1' })
      try { localStorage.setItem(lsKey, String(newSize)) } catch {}
    },
    [updateParams, pageSizeKey, pageKey, lsKey],
  )

  const resetPage = useCallback(() => {
    updateParams({ [pageKey]: '1' })
  }, [updateParams, pageKey])

  const paginationParams = useMemo<Record<string, string>>(
    () => ({ page: String(page), limit: String(pageSize) }),
    [page, pageSize],
  )

  return { page, pageSize, setPage, setPageSize, resetPage, paginationParams }
}
