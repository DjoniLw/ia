'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface DataPaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  pageSizeOptions?: number[]
}

function buildPageNumbers(currentPage: number, lastPage: number): Array<number | '...'> {
  if (lastPage <= 7) {
    return Array.from({ length: lastPage }, (_, i) => i + 1)
  }

  const pages: Array<number | '...'> = [1]

  const rangeStart = Math.max(2, currentPage - 2)
  const rangeEnd = Math.min(lastPage - 1, currentPage + 2)

  if (rangeStart > 2) pages.push('...')

  for (let i = rangeStart; i <= rangeEnd; i++) {
    pages.push(i)
  }

  if (rangeEnd < lastPage - 1) pages.push('...')

  pages.push(lastPage)

  return pages
}

export function DataPagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [20, 50, 100],
}: DataPaginationProps) {
  if (total === 0) return null

  const lastPage = Math.ceil(total / pageSize)
  const singlePage = lastPage <= 1
  const safePage = Math.min(Math.max(1, page), lastPage)
  const from = singlePage ? 1 : (safePage - 1) * pageSize + 1
  const to = singlePage ? total : Math.min(safePage * pageSize, total)
  const pageNumbers = singlePage ? [] : buildPageNumbers(safePage, lastPage)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm">
      {/* Esquerda: contador */}
      <p className="text-xs text-muted-foreground">
        {singlePage
          ? `${total} registro${total !== 1 ? 's' : ''}`
          : `Exibindo ${from}–${to} de ${total} registros`}
      </p>

      {/* Centro: números de página */}
      {!singlePage && (
        <div className="hidden items-center gap-1 sm:flex">
          {pageNumbers.map((p, idx) =>
            p === '...' ? (
              <span key={`ellipsis-${idx}`} className="px-1 text-xs text-muted-foreground">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                className={[
                  'flex h-7 w-7 items-center justify-center rounded text-xs font-medium transition-colors',
                  safePage === p
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted',
                ].join(' ')}
              >
                {p}
              </button>
            ),
          )}
        </div>
      )}

      {/* Direita: seletor por página + botões prev/next */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Por página:</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => onPageSizeChange(Number(v))}
          >
            <SelectTrigger className="h-7 w-16 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => onPageChange(safePage - 1)}
          disabled={singlePage || safePage === 1}
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => onPageChange(safePage + 1)}
          disabled={singlePage || safePage >= lastPage}
          aria-label="Próxima página"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
