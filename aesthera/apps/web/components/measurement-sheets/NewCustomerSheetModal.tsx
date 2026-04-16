'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { InfoBanner } from '@/components/ui/info-banner'
import { useCreateMeasurementSheet } from '@/lib/hooks/use-measurement-sheets'
import { useQueryClient } from '@tanstack/react-query'

// ──── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
})

type FormValues = z.infer<typeof schema>

// ──── Props ────────────────────────────────────────────────────────────────────

interface NewCustomerSheetModalProps {
  customerId: string
  onClose: () => void
}

// ──── Component ────────────────────────────────────────────────────────────────

export function NewCustomerSheetModal({ customerId, onClose }: NewCustomerSheetModalProps) {
  const qc = useQueryClient()
  const createSheet = useCreateMeasurementSheet()
  const [selectedType, setSelectedType] = useState<'SIMPLE' | 'TABULAR'>('SIMPLE')

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '' },
    mode: 'onChange',
  })

  const onSubmit = handleSubmit(async (data) => {
    try {
      await createSheet.mutateAsync({
        name: data.name,
        type: selectedType,
        category: 'PERSONALIZADA',
        scope: 'CUSTOMER',
        customerId,
      })
      await qc.invalidateQueries({ queryKey: ['measurement-sheets'] })
      toast.success('Ficha personalizada criada com sucesso')
      onClose()
    } catch {
      toast.error('Erro ao criar ficha personalizada')
    }
  })

  return (
    <Dialog open onClose={onClose} isDirty={isDirty} className="max-w-md p-0">
      <div className="sticky top-0 bg-card border-b px-6 py-4 flex items-center justify-between rounded-t-xl z-10">
        <DialogTitle className="mb-0">Nova ficha deste cliente</DialogTitle>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-7 w-7 text-muted-foreground"
          aria-label="Fechar modal"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <form onSubmit={onSubmit}>
        <div className="p-6 space-y-5">
          {/* Nome */}
          <div className="space-y-1.5">
            <Label htmlFor="sheet-name">
              Nome <span className="text-destructive">*</span>
            </Label>
            <Input
              id="sheet-name"
              placeholder="Ex: Avaliação facial personalizada"
              {...register('name')}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Formato */}
          <div className="space-y-2">
            <Label>Formato</Label>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  { value: 'SIMPLE', label: 'Lista de campos', description: 'Campos individuais por linha' },
                  { value: 'TABULAR', label: 'Tabela', description: 'Grade de linhas × colunas' },
                ] as const
              ).map((opt) => (
                <Button
                  key={opt.value}
                  type="button"
                  variant="ghost"
                  onClick={() => setSelectedType(opt.value)}
                  className={[
                    'h-auto w-full flex-col items-start whitespace-normal rounded-lg border p-3 text-left transition-colors',
                    selectedType === opt.value
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border hover:bg-muted/40',
                  ].join(' ')}
                >
                  <p className="text-sm font-medium">{opt.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                </Button>
              ))}
            </div>
          </div>

          {/* Info */}
          <InfoBanner variant="info">
            Esta ficha será criada na categoria <strong>Personalizada</strong> e ficará disponível
            apenas para este cliente.
          </InfoBanner>
        </div>

        <div className="sticky bottom-0 bg-card border-t px-6 py-4 flex justify-end gap-2 rounded-b-xl">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={createSheet.isPending}
          >
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={createSheet.isPending || !isValid}>
            {createSheet.isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
            Criar ficha
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
