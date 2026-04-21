'use client'

import { Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { useMeasurementSheets } from '@/lib/hooks/use-measurement-sheets'
import { SimpleSheetEditor } from '@/app/(dashboard)/settings/_components/measurement-sheets-settings'
import { TabularSheetEditor } from '@/app/(dashboard)/settings/_components/measurement-sheets-settings'

// ──── Props ────────────────────────────────────────────────────────────────────

interface CustomerSheetEditorDrawerProps {
  customerId: string
  sheetId: string
  onClose: () => void
}

// ──── Component ────────────────────────────────────────────────────────────────

export function CustomerSheetEditorDrawer({
  customerId,
  sheetId,
  onClose,
}: CustomerSheetEditorDrawerProps) {
  const { data: sheets = [], isLoading } = useMeasurementSheets({
    scope: 'CUSTOMER',
    customerId,
    includeInactive: true,
  })

  const sheet = sheets.find((s) => s.id === sheetId)

  return (
    <Dialog open onClose={onClose} className="max-w-2xl p-0">
      <div className="sticky top-0 bg-card border-b px-6 py-4 flex items-center justify-between rounded-t-xl z-10">
        <DialogTitle className="mb-0 truncate">
          {sheet ? sheet.name : 'Editar ficha'}
        </DialogTitle>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-7 w-7 shrink-0 text-muted-foreground"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-6">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !sheet ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Ficha não encontrada.
          </p>
        ) : sheet.type === 'SIMPLE' ? (
          <SimpleSheetEditor sheet={sheet} isReadonly={false} />
        ) : (
          <TabularSheetEditor sheet={sheet} isReadonly={false} />
        )}
      </div>

      <div className="sticky bottom-0 bg-card border-t px-6 py-4 flex justify-end rounded-b-xl">
        <Button type="button" size="sm" onClick={onClose}>
          Concluído
        </Button>
      </div>
    </Dialog>
  )
}
