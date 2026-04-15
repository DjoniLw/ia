'use client'

import { useEffect } from 'react'
import { Loader2, X, List, Table2, ClipboardList } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  useMeasurementTemplates,
  useCopyMeasurementTemplate,
  type MeasurementTemplate,
} from '@/lib/hooks/use-measurement-sheets'
import { CATEGORY_LABELS, SHEET_TYPE_LABELS, CATEGORY_BADGE_COLOR } from '@/lib/measurement-categories'

// ── Custom drawer (sheet.tsx não existe no projeto) ────────────────────────────

function DrawerRoot({
  open,
  onClose,
  children,
}: {
  open: boolean
  onClose: () => void
  children: React.ReactNode
}) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-card border-l shadow-xl flex flex-col">
        {children}
      </div>
    </div>
  )
}

// ── Template card ──────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  onUse,
  isCopying,
}: {
  template: MeasurementTemplate
  onUse: () => void
  isCopying: boolean
}) {
  const count = template.type === 'SIMPLE' ? template.fieldsCount : template.columnsCount
  const countLabel =
    template.type === 'SIMPLE'
      ? `${count} campo${count !== 1 ? 's' : ''}`
      : `${template.fieldsCount} linha${template.fieldsCount !== 1 ? 's' : ''}, ${template.columnsCount} coluna${template.columnsCount !== 1 ? 's' : ''}`

  return (
    <div className="rounded-lg border bg-background p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm leading-snug">{template.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{countLabel}</p>
        </div>
        <div className="flex flex-col gap-1 items-end shrink-0">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_BADGE_COLOR[template.category]}`}
          >
            {CATEGORY_LABELS[template.category]}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {template.type === 'SIMPLE' ? (
              <List className="h-3 w-3" />
            ) : (
              <Table2 className="h-3 w-3" />
            )}
            {SHEET_TYPE_LABELS[template.type]}
          </span>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onUse}
        disabled={isCopying}
        className="w-full"
      >
        {isCopying ? (
          <>
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            Copiando…
          </>
        ) : (
          'Usar este modelo'
        )}
      </Button>
    </div>
  )
}

// ── Main drawer component ──────────────────────────────────────────────────────

interface MeasurementTemplatesDrawerProps {
  open: boolean
  onClose: () => void
  onSheetCreated: (sheetId: string) => void
}

export function MeasurementTemplatesDrawer({
  open,
  onClose,
  onSheetCreated,
}: MeasurementTemplatesDrawerProps) {
  const { data: templates = [], isPending, isError } = useMeasurementTemplates()
  const copyMutation = useCopyMeasurementTemplate()

  async function handleUseTemplate(template: MeasurementTemplate) {
    try {
      const sheet = await copyMutation.mutateAsync(template.id)
      toast.success(`Ficha "${sheet.name}" criada com sucesso`)
      onSheetCreated(sheet.id)
    } catch {
      toast.error('Erro ao copiar modelo. Tente novamente.')
    }
  }

  return (
    <DrawerRoot open={open} onClose={onClose}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
        <div>
          <h2 className="text-base font-semibold">Biblioteca de modelos</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Escolha um modelo para criar uma nova ficha pré-configurada
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {isPending ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            Erro ao carregar modelos
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-12">
            <ClipboardList className="mx-auto mb-2 h-8 w-8 opacity-30" />
            <p className="text-sm text-muted-foreground">Nenhum modelo disponível</p>
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                isCopying={copyMutation.isPending && copyMutation.variables === template.id}
                onUse={() => handleUseTemplate(template)}
              />
            ))}
          </div>
        )}
      </div>
    </DrawerRoot>
  )
}
