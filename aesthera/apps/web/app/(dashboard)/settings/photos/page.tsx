'use client'

import { useState } from 'react'
import { GripVertical, Loader2, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { usePhotoBodyRegions, useUpdatePhotoBodyRegions } from '@/lib/hooks/use-customer-photos'
import { useRole } from '@/lib/hooks/use-role'

const MAX_REGIONS = 30

export default function PhotoSettingsPage() {
  const { role } = useRole()
  const { data: regions, isLoading, isError } = usePhotoBodyRegions()
  const { mutateAsync: updateRegions, isPending } = useUpdatePhotoBodyRegions()

  const [draft, setDraft] = useState<string[]>([])
  const [newRegion, setNewRegion] = useState('')
  const [isDirty, setIsDirty] = useState(false)

  // Inicializa draft quando os dados carregam
  const initialized = isDirty || draft.length > 0

  const currentList = initialized ? draft : (regions ?? [])

  const handleAdd = () => {
    const trimmed = newRegion.trim()
    if (!trimmed) return
    if (currentList.includes(trimmed)) {
      toast.error('Essa região já está na lista.')
      return
    }
    if (currentList.length >= MAX_REGIONS) {
      toast.error(`Máximo de ${MAX_REGIONS} regiões permitido.`)
      return
    }
    const updated = [...currentList, trimmed]
    setDraft(updated)
    setNewRegion('')
    setIsDirty(true)
  }

  const handleRemove = (region: string) => {
    const updated = currentList.filter((r) => r !== region)
    setDraft(updated)
    setIsDirty(true)
  }

  const handleSave = async () => {
    try {
      await updateRegions(currentList)
      setIsDirty(false)
      toast.success('Regiões salvas com sucesso.')
    } catch {
      toast.error('Erro ao salvar. Tente novamente.')
    }
  }

  if (role !== 'admin') {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        Acesso restrito a administradores.
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">Configurações de Fotos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure as regiões do corpo disponíveis para classificação das fotos dos clientes.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-5">
        <Label className="text-sm font-medium">
          Regiões do corpo <span className="text-muted-foreground">({currentList.length}/{MAX_REGIONS})</span>
        </Label>
        <p className="mb-4 text-xs text-muted-foreground">
          Essas regiões serão exibidas como opções ao adicionar novas fotos.
        </p>

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando...
          </div>
        )}

        {isError && (
          <p className="text-sm text-destructive">Erro ao carregar as configurações.</p>
        )}

        {!isLoading && !isError && (
          <>
            {currentList.length === 0 ? (
              <p className="rounded-lg border bg-muted/40 py-8 text-center text-sm text-muted-foreground">
                Nenhuma região cadastrada.
              </p>
            ) : (
              <ul className="mb-4 flex flex-col gap-1">
                {currentList.map((region) => (
                  <li
                    key={region}
                    className="flex items-center justify-between rounded-md border bg-background px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                      <span className="text-sm">{region}</span>
                    </div>
                    <button
                      type="button"
                      aria-label={`Remover ${region}`}
                      onClick={() => handleRemove(region)}
                      disabled={isPending}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {currentList.length < MAX_REGIONS && (
              <div className="flex gap-2">
                <Input
                  value={newRegion}
                  onChange={(e) => setNewRegion(e.target.value)}
                  placeholder="Nova região (ex.: Abdômen)"
                  className="text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                  disabled={isPending}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAdd}
                  disabled={!newRegion.trim() || isPending}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Adicionar
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          disabled={!isDirty || isPending}
          onClick={() => {
            setDraft(regions ?? [])
            setIsDirty(false)
          }}
        >
          Descartar
        </Button>
        <Button disabled={!isDirty || isPending} onClick={handleSave}>
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            'Salvar'
          )}
        </Button>
      </div>
    </div>
  )
}
