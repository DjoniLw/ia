'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  type Service,
  useAssignServiceSupplies,
  useCreateService,
  useDeleteService,
  useServiceSupplies,
  useServices,
  useSupplies,
  useUpdateService,
} from '@/lib/hooks/use-resources'

function parseBRL(value: string): number {
  // Accept "150,00" or "150.00" or "150" → returns cents
  const normalized = value.replace(/\./g, '').replace(',', '.')
  return Math.round(parseFloat(normalized) * 100)
}

const serviceSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  category: z.string().optional(),
  durationMinutes: z.coerce.number().int().positive().refine((v) => v % 15 === 0, 'Múltiplo de 15'),
  priceDisplay: z.string().min(1, 'Informe o preço').refine((v) => {
    const n = parseBRL(v)
    return !isNaN(n) && n >= 0
  }, 'Preço inválido'),
})
type ServiceFormData = z.infer<typeof serviceSchema>

function ServiceForm({
  defaultValues,
  onSave,
  isPending,
  showActiveToggle = false,
  onDirtyChange,
}: {
  defaultValues?: Partial<ServiceFormData & { price: number; active?: boolean }>
  onSave: (data: ServiceFormData & { active?: boolean }) => Promise<void>
  isPending: boolean
  showActiveToggle?: boolean
  onDirtyChange?: (dirty: boolean) => void
}) {
  const [active, setActive] = useState(defaultValues?.active ?? true)
  const { register, handleSubmit, formState: { errors, isDirty } } = useForm<ServiceFormData>({
    resolver: zodResolver(serviceSchema),
    defaultValues: defaultValues
      ? {
          ...defaultValues,
          // Convert cents to display string (e.g. 15000 → "150,00")
          priceDisplay: defaultValues.price != null
            ? (defaultValues.price / 100).toFixed(2).replace('.', ',')
            : '',
        }
      : undefined,
  })

  useEffect(() => { onDirtyChange?.(isDirty) }, [isDirty, onDirtyChange])

  return (
    <form onSubmit={handleSubmit((data) => onSave({ ...data, ...(showActiveToggle ? { active } : {}) }))} className="space-y-4">
      <div className="space-y-2">
        <Label>Nome</Label>
        <Input {...register('name')} placeholder="Botox" />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>
      <div className="space-y-2">
        <Label>Descrição</Label>
        <Input {...register('description')} placeholder="Opcional" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Categoria</Label>
          <Input {...register('category')} placeholder="facial, corporal..." />
        </div>
        <div className="space-y-2">
          <Label>Duração (min)</Label>
          <Input type="number" {...register('durationMinutes')} placeholder="60" />
          {errors.durationMinutes && (
            <p className="text-xs text-destructive">{errors.durationMinutes.message}</p>
          )}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Preço (R$)</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
          <Input
            {...register('priceDisplay')}
            placeholder="150,00"
            className="pl-9"
            inputMode="decimal"
          />
        </div>
        {errors.priceDisplay && <p className="text-xs text-destructive">{errors.priceDisplay.message}</p>}
      </div>
      {showActiveToggle && (
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="svc-active"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 rounded border-input accent-primary"
          />
          <Label htmlFor="svc-active" className="cursor-pointer">
            Serviço ativo (disponível para agendamentos)
          </Label>
        </div>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </form>
  )
}

function priceDisplay(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ──── ServiceSuppliesDialog ────────────────────────────────────────────────────

function ServiceSuppliesDialog({ service, onClose }: { service: Service; onClose: () => void }) {
  const { data: suppliesData } = useSupplies({ active: 'true', limit: '100' })
  const { data: assigned, isLoading: loadingAssigned } = useServiceSupplies(service.id)
  const assignMutation = useAssignServiceSupplies(service.id)

  type Item = { supplyId: string; quantity: number; usageUnit: string; conversionFactor: number }

  // Build local editable list from current assigned
  const [items, setItems] = useState<Item[]>(() =>
    assigned?.map((ss) => ({
      supplyId: ss.supplyId,
      quantity: ss.quantity,
      usageUnit: ss.usageUnit ?? ss.supply.unit,
      conversionFactor: ss.conversionFactor ?? 1,
    })) ?? []
  )

  const [isDirty, setIsDirty] = useState(false)

  // Sync from server when data loads
  const [initialised, setInitialised] = useState(false)
  if (!initialised && assigned) {
    setItems(assigned.map((ss) => ({
      supplyId: ss.supplyId,
      quantity: ss.quantity,
      usageUnit: ss.usageUnit ?? ss.supply.unit,
      conversionFactor: ss.conversionFactor ?? 1,
    })))
    setInitialised(true)
  }

  function addSupply(supplyId: string) {
    if (items.some((i) => i.supplyId === supplyId)) return
    const supply = suppliesData?.items.find((s) => s.id === supplyId)
    setItems((prev) => [...prev, { supplyId, quantity: 1, usageUnit: supply?.unit ?? 'un', conversionFactor: 1 }])
    setIsDirty(true)
  }

  function removeSupply(supplyId: string) {
    setItems((prev) => prev.filter((i) => i.supplyId !== supplyId))
    setIsDirty(true)
  }

  function setQty(supplyId: string, qty: number) {
    setItems((prev) => prev.map((i) => i.supplyId === supplyId ? { ...i, quantity: qty } : i))
    setIsDirty(true)
  }

  function setUsageUnit(supplyId: string, unit: string) {
    setItems((prev) => prev.map((i) => i.supplyId === supplyId ? { ...i, usageUnit: unit } : i))
    setIsDirty(true)
  }

  function setConversionFactor(supplyId: string, factor: number) {
    setItems((prev) => prev.map((i) => i.supplyId === supplyId ? { ...i, conversionFactor: factor } : i))
    setIsDirty(true)
  }

  const unassigned = suppliesData?.items.filter((s) => !items.some((i) => i.supplyId === s.id)) ?? []

  async function handleSave() {
    try {
      await assignMutation.mutateAsync(
        items.map((i) => ({
          supplyId: i.supplyId,
          quantity: i.quantity,
          usageUnit: i.usageUnit || null,
          conversionFactor: i.conversionFactor,
        })),
      )
      toast.success('Insumos atualizados')
      onClose()
    } catch {
      toast.error('Erro ao salvar insumos')
    }
  }

  // Compute total cost — cost = (costPrice * quantity) / conversionFactor
  const totalCost = items.reduce((sum, item) => {
    const supply = suppliesData?.items.find((s) => s.id === item.supplyId)
    return sum + (supply?.costPrice ?? 0) * item.quantity / (item.conversionFactor || 1)
  }, 0)

  return (
    <Dialog open onClose={onClose} className="max-w-2xl" isDirty={isDirty}>
      <DialogTitle>Insumos de: {service.name}</DialogTitle>
      <p className="text-xs text-muted-foreground mb-3">
        Defina os insumos, quantidades e unidades usadas por execução deste serviço.
        Use o fator de conversão quando a unidade de uso for diferente da unidade de compra.
      </p>

      {loadingAssigned ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <div className="space-y-3">
          {/* Column headers */}
          {items.length > 0 && (
            <div className="grid grid-cols-[1fr_80px_80px_90px_70px_24px] gap-2 px-3 text-xs text-muted-foreground font-medium">
              <span>Insumo</span>
              <span className="text-center">Qtd</span>
              <span className="text-center">Un. uso</span>
              <span className="text-center">Fator conv.</span>
              <span className="text-right">Custo</span>
              <span />
            </div>
          )}

          {/* Assigned supplies list */}
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground italic">Nenhum insumo atribuído.</p>
          )}
          {items.map((item) => {
            const supply = suppliesData?.items.find((s) => s.id === item.supplyId)
            if (!supply) return null
            const lineCost = (supply.costPrice ?? 0) * item.quantity / (item.conversionFactor || 1)
            const stockConsumed = item.quantity / (item.conversionFactor || 1)
            const showConversion = item.conversionFactor !== 1 || item.usageUnit !== supply.unit
            return (
              <div key={item.supplyId} className="rounded-lg border bg-card px-3 py-2 space-y-1">
                <div className="grid grid-cols-[1fr_80px_80px_90px_70px_24px] gap-2 items-center">
                  <div>
                    <span className="text-sm font-medium">{supply.name}</span>
                    <span className="ml-1 text-xs text-muted-foreground">({supply.unit})</span>
                  </div>
                  <Input
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={item.quantity}
                    onChange={(e) => setQty(item.supplyId, parseFloat(e.target.value) || 0)}
                    className="w-full text-center text-sm"
                  />
                  <Input
                    type="text"
                    value={item.usageUnit}
                    onChange={(e) => setUsageUnit(item.supplyId, e.target.value)}
                    placeholder={supply.unit}
                    className="w-full text-center text-sm"
                  />
                  <Input
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={item.conversionFactor}
                    onChange={(e) => setConversionFactor(item.supplyId, parseFloat(e.target.value) || 1)}
                    className="w-full text-center text-sm"
                    title={`1 ${supply.unit} = ${item.conversionFactor} ${item.usageUnit}`}
                  />
                  <span className="text-xs text-muted-foreground text-right">
                    {lineCost > 0 ? `R$ ${(lineCost / 100).toFixed(2)}` : '—'}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeSupply(item.supplyId)}
                    className="text-destructive hover:text-destructive/80 text-sm font-medium"
                  >
                    ✕
                  </button>
                </div>
                {showConversion && (
                  <p className="text-[10px] text-muted-foreground pl-1">
                    1 {supply.unit} = {item.conversionFactor} {item.usageUnit}
                    {' · '}consumo por exec.: {stockConsumed.toFixed(3)} {supply.unit}
                  </p>
                )}
              </div>
            )
          })}

          {/* Total cost */}
          {items.length > 0 && (
            <div className="flex justify-between items-center rounded-lg border border-dashed px-3 py-2 text-sm font-medium">
              <span>Custo total em insumos:</span>
              <span className="text-primary">R$ {(totalCost / 100).toFixed(2)}</span>
            </div>
          )}

          {/* Add supply dropdown */}
          {unassigned.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Adicionar insumo</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                defaultValue=""
                onChange={(e) => { if (e.target.value) { addSupply(e.target.value); e.target.value = '' } }}
              >
                <option value="">Selecione um insumo…</option>
                {unassigned.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.unit}){s.costPrice ? ` — R$ ${(s.costPrice / 100).toFixed(2)}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          {unassigned.length === 0 && suppliesData?.items.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Cadastre insumos na página "Insumos" antes de atribuir ao serviço.
            </p>
          )}

          {/* Legend */}
          <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground space-y-0.5">
            <p><strong>Qtd:</strong> quantidade usada por execução (na unidade de uso)</p>
            <p><strong>Un. uso:</strong> unidade em que o insumo é aplicado no serviço (ex: ml, g)</p>
            <p><strong>Fator conv.:</strong> quantas unidades de uso equivalem a 1 unidade de compra (ex: 1 un = 200 ml → fator 200)</p>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button onClick={handleSave} disabled={assignMutation.isPending}>
          {assignMutation.isPending ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </Dialog>
  )
}

export default function ServicesPage() {
  const { data, isLoading } = useServices()
  const { mutateAsync: create, isPending: creating } = useCreateService()
  const { mutateAsync: del } = useDeleteService()

  const [showCreate, setShowCreate] = useState(false)
  const [formDirty, setFormDirty] = useState(false)
  const [editing, setEditing] = useState<Service | null>(null)
  const [managingSupplies, setManagingSupplies] = useState<Service | null>(null)
  const { mutateAsync: update, isPending: updating } = useUpdateService(editing?.id ?? '')

  async function handleCreate(data: ServiceFormData) {
    try {
      await create({
        name: data.name,
        description: data.description ?? null,
        category: data.category ?? null,
        durationMinutes: data.durationMinutes,
        price: parseBRL(data.priceDisplay),
      })
      toast.success('Serviço criado')
      setShowCreate(false)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao criar serviço')
    }
  }

  async function handleUpdate(data: ServiceFormData & { active?: boolean }) {
    try {
      await update({
        name: data.name,
        description: data.description ?? null,
        category: data.category ?? null,
        durationMinutes: data.durationMinutes,
        price: parseBRL(data.priceDisplay),
        ...(data.active !== undefined ? { active: data.active } : {}),
      })
      toast.success('Serviço atualizado')
      setEditing(null)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao atualizar serviço')
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Excluir "${name}"?`)) return
    try {
      await del(id)
      toast.success('Serviço excluído')
    } catch {
      toast.error('Erro ao excluir serviço')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold">Serviços</h2>
        <Button onClick={() => setShowCreate(true)}>+ Novo serviço</Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Nome</th>
                <th className="text-left px-4 py-3 font-medium">Categoria</th>
                <th className="text-right px-4 py-3 font-medium">Duração</th>
                <th className="text-right px-4 py-3 font-medium">Preço</th>
                <th className="text-center px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {data?.items.map((s) => (
                <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.category ?? '—'}</td>
                  <td className="px-4 py-3 text-right">{s.durationMinutes}min</td>
                  <td className="px-4 py-3 text-right">{priceDisplay(s.price)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${s.active ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                      {s.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(s)}>Editar</Button>
                    <Button variant="ghost" size="sm" onClick={() => setManagingSupplies(s)}>Insumos</Button>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(s.id, s.name)}>Excluir</Button>
                  </td>
                </tr>
              ))}
              {data?.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum serviço cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={showCreate} onClose={() => setShowCreate(false)} isDirty={formDirty}>
        <DialogTitle>Novo serviço</DialogTitle>
        <ServiceForm onSave={handleCreate} isPending={creating} onDirtyChange={setFormDirty} />
      </Dialog>

      <Dialog open={!!editing} onClose={() => setEditing(null)} isDirty={formDirty}>
        <DialogTitle>Editar serviço</DialogTitle>
        {editing && (
          <ServiceForm
            defaultValues={{
              ...editing,
              description: editing.description ?? undefined,
              category: editing.category ?? undefined,
            }}
            onSave={handleUpdate}
            isPending={updating}
            showActiveToggle
            onDirtyChange={setFormDirty}
          />
        )}
      </Dialog>

      {managingSupplies && (
        <ServiceSuppliesDialog
          service={managingSupplies}
          onClose={() => setManagingSupplies(null)}
        />
      )}
    </div>
  )
}
