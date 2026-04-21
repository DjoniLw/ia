'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  useMeasurementSheets,
  useCreateMeasurementSheet,
  type MeasurementSheetType,
} from '@/lib/hooks/use-measurement-sheets'
import {
  CATEGORY_LABELS,
  MEASUREMENT_CATEGORIES_ORDER,
} from '@/lib/measurement-categories'
import { useQueryClient } from '@tanstack/react-query'

// ──── Props ────────────────────────────────────────────────────────────────────

interface NewCustomerSheetModalProps {
  customerId: string
  onClose: () => void
  onCreated: (sheetId: string, sheetType: MeasurementSheetType) => void
}

// ──── Component ────────────────────────────────────────────────────────────────

export function NewCustomerSheetModal({ customerId, onClose, onCreated }: NewCustomerSheetModalProps) {
  const qc = useQueryClient()
  const createSheet = useCreateMeasurementSheet()

  const [mode, setMode] = useState<'blank' | 'from-sheet'>('from-sheet')
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState('')
  const [selectedType, setSelectedType] = useState<MeasurementSheetType>('SIMPLE')
  const [selectedSystemSheetId, setSelectedSystemSheetId] = useState<string>('')

  const { data: systemSheets = [] } = useMeasurementSheets({ scope: 'SYSTEM' })
  const activeSystemSheets = systemSheets.filter((s) => s.active)

  // Pré-preencher nome ao selecionar ficha do sistema
  useEffect(() => {
    if (mode === 'from-sheet' && selectedSystemSheetId) {
      const sheet = activeSystemSheets.find((s) => s.id === selectedSystemSheetId)
      if (sheet) {
        setName(`${sheet.name} (Cliente)`)
        setSelectedType(sheet.type)
      }
    }
  }, [selectedSystemSheetId, mode]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setNameError('Nome obrigatório'); return }
    if (mode === 'from-sheet' && !selectedSystemSheetId) { setNameError('Selecione uma ficha base'); return }

    try {
      const sheet = await createSheet.mutateAsync({
        name: name.trim(),
        type: selectedType,
        category: 'PERSONALIZADA',
        scope: 'CUSTOMER',
        customerId,
        ...(mode === 'from-sheet' && selectedSystemSheetId
          ? { sourceSheetId: selectedSystemSheetId }
          : {}),
      })
      await qc.invalidateQueries({ queryKey: ['measurement-sheets'] })
      toast.success('Ficha personalizada criada com sucesso')
      onCreated(sheet.id, sheet.type)
    } catch {
      toast.error('Erro ao criar ficha personalizada')
    }
  }

  return (
    <Dialog open onClose={onClose} isDirty={name.length > 0} className="max-w-md p-0">
      <div className="sticky top-0 bg-card border-b px-6 py-4 flex items-center justify-between rounded-t-xl z-10">
        <DialogTitle className="mb-0">Nova ficha deste cliente</DialogTitle>
        <Button type="button" variant="ghost" size="icon" onClick={onClose} className="h-7 w-7 text-muted-foreground" aria-label="Fechar modal">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="p-6 space-y-5">
          {/* Modo */}
          <div className="space-y-2">
            <Label>Ponto de partida</Label>
            <div className="grid grid-cols-2 gap-2">
              {(['from-sheet', 'blank'] as const).map((m) => (
                <Button
                  key={m}
                  type="button"
                  variant="ghost"
                  onClick={() => { setMode(m); setSelectedSystemSheetId(''); setName(''); setNameError('') }}
                  className={[
                    'h-auto flex-col items-start whitespace-normal rounded-lg border p-3 text-left',
                    mode === m ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-muted/40',
                  ].join(' ')}
                >
                  <p className="text-sm font-medium">{m === 'from-sheet' ? 'Baseada em ficha do sistema' : 'Em branco'}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {m === 'from-sheet' ? 'Copia campos de uma ficha existente' : 'Cria do zero, você define os campos'}
                  </p>
                </Button>
              ))}
            </div>
          </div>

          {/* Ficha do sistema (modo from-sheet) */}
          {mode === 'from-sheet' && (
            <div className="space-y-1.5">
              <Label>Ficha base</Label>
              <Select value={selectedSystemSheetId} onValueChange={setSelectedSystemSheetId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione uma ficha do sistema…" />
                </SelectTrigger>
                <SelectContent>
                  {MEASUREMENT_CATEGORIES_ORDER.filter((cat) => cat !== 'PERSONALIZADA').map((cat) => {
                    const sheetsInCat = activeSystemSheets.filter((s) => s.category === cat)
                    if (sheetsInCat.length === 0) return null
                    return (
                      <div key={cat}>
                        <p className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          {CATEGORY_LABELS[cat]}
                        </p>
                        {sheetsInCat.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </div>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Formato (só modo blank — no from-sheet é herdado) */}
          {mode === 'blank' && (
            <div className="space-y-2">
              <Label>Formato</Label>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { value: 'SIMPLE' as const, label: 'Lista de campos', description: 'Campos individuais por linha' },
                  { value: 'TABULAR' as const, label: 'Tabela', description: 'Grade de linhas × colunas' },
                ]).map((opt) => (
                  <Button
                    key={opt.value}
                    type="button"
                    variant="ghost"
                    onClick={() => setSelectedType(opt.value)}
                    className={[
                      'h-auto w-full flex-col items-start whitespace-normal rounded-lg border p-3 text-left transition-colors',
                      selectedType === opt.value ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-muted/40',
                    ].join(' ')}
                  >
                    <p className="text-sm font-medium">{opt.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Nome */}
          <div className="space-y-1.5">
            <Label htmlFor="sheet-name">
              Nome <span className="text-destructive">*</span>
            </Label>
            <Input
              id="sheet-name"
              placeholder="Ex: Avaliação facial personalizada"
              value={name}
              onChange={(e) => { setName(e.target.value); setNameError('') }}
            />
            {nameError && <p className="text-xs text-destructive">{nameError}</p>}
          </div>
        </div>

        <div className="sticky bottom-0 bg-card border-t px-6 py-4 flex justify-end gap-2 rounded-b-xl">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={createSheet.isPending}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={createSheet.isPending || !name.trim()}>
            {createSheet.isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
            Criar ficha
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
