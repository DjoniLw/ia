'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { PackageOpen, Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import {
  type Supply,
  useSupplies,
  useCreateSupply,
  useUpdateSupply,
  useDeleteSupply,
} from '@/lib/hooks/use-resources'

function formatCost(cents: number | null) {
  if (cents == null) return '—'
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ──── Supply Form ──────────────────────────────────────────────────────────────

function SupplyForm({
  initial,
  onSave,
  onCancel,
  isPending,
  showActiveToggle = false,
}: {
  initial?: Supply
  onSave: (data: {
    name: string
    description: string
    unit: string
    costPrice: number | null
    stock: number
    minStock: number
    active?: boolean
  }) => Promise<void>
  onCancel: () => void
  isPending: boolean
  showActiveToggle?: boolean
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [unit, setUnit] = useState(initial?.unit ?? 'un')
  const [costPrice, setCostPrice] = useState(
    initial?.costPrice != null ? (initial.costPrice / 100).toFixed(2).replace('.', ',') : '',
  )
  const [stock, setStock] = useState(String(initial?.stock ?? 0))
  const [minStock, setMinStock] = useState(String(initial?.minStock ?? 0))
  const [active, setActive] = useState(initial?.active ?? true)

  function parseCost(v: string): number | null {
    if (!v.trim()) return null
    const n = parseFloat(v.replace(/\./g, '').replace(',', '.'))
    return isNaN(n) ? null : Math.round(n * 100)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await onSave({
      name: name.trim(),
      description: description.trim(),
      unit: unit.trim() || 'un',
      costPrice: parseCost(costPrice),
      stock: parseInt(stock) || 0,
      minStock: parseInt(minStock) || 0,
      ...(showActiveToggle ? { active } : {}),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Nome *</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Seringa 5ml" required />
      </div>
      <div className="space-y-2">
        <Label>Descrição</Label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Opcional" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Unidade</Label>
          <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="un, ml, g…" />
        </div>
        <div className="space-y-2">
          <Label>Custo unitário (R$)</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
            <Input
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
              placeholder="0,00"
              className="pl-9"
              inputMode="decimal"
            />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Estoque atual</Label>
          <Input type="number" value={stock} onChange={(e) => setStock(e.target.value)} min={0} />
        </div>
        <div className="space-y-2">
          <Label>Estoque mínimo</Label>
          <Input type="number" value={minStock} onChange={(e) => setMinStock(e.target.value)} min={0} />
        </div>
      </div>
      {showActiveToggle && (
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="supply-active"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 rounded border-input accent-primary"
          />
          <Label htmlFor="supply-active" className="cursor-pointer">Insumo ativo</Label>
        </div>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={isPending || !name.trim()}>
          {isPending ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </form>
  )
}

// ──── Page ────────────────────────────────────────────────────────────────────

export default function SuppliesPage() {
  const { data, isLoading } = useSupplies()
  const createSupply = useCreateSupply()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Supply | null>(null)
  const [deleting, setDeleting] = useState<Supply | null>(null)

  async function handleCreate(d: Parameters<typeof createSupply.mutateAsync>[0]) {
    try {
      await createSupply.mutateAsync(d)
      toast.success('Insumo criado')
      setCreating(false)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao criar insumo')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Insumos</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie consumíveis utilizados nos serviços.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Novo Insumo
        </Button>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground">Carregando…</div>
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-lg border bg-card py-16 text-center text-muted-foreground">
          <PackageOpen className="mx-auto mb-2 h-8 w-8 opacity-30" />
          <p className="text-sm">Nenhum insumo cadastrado.</p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Nome</th>
                <th className="text-left px-4 py-3 font-medium">Unidade</th>
                <th className="text-right px-4 py-3 font-medium">Custo unitário</th>
                <th className="text-right px-4 py-3 font-medium">Estoque</th>
                <th className="text-center px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.items.map((s) => (
                <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">
                    {s.name}
                    {s.description && <span className="block text-xs text-muted-foreground">{s.description}</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{s.unit}</td>
                  <td className="px-4 py-3 text-right">{formatCost(s.costPrice)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={s.stock <= s.minStock ? 'text-orange-600 font-medium' : ''}>
                      {s.stock}
                    </span>
                    {s.minStock > 0 && <span className="text-xs text-muted-foreground"> / mín {s.minStock}</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${s.active ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                      {s.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(s)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleting(s)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <Dialog open onClose={() => setCreating(false)}>
          <DialogTitle>Novo Insumo</DialogTitle>
          <div className="mt-4">
            <SupplyForm
              onSave={handleCreate}
              onCancel={() => setCreating(false)}
              isPending={createSupply.isPending}
            />
          </div>
        </Dialog>
      )}

      {editing && <EditSupplyDialog supply={editing} onClose={() => setEditing(null)} />}
      {deleting && <DeleteSupplyDialog supply={deleting} onClose={() => setDeleting(null)} />}
    </div>
  )
}

function EditSupplyDialog({ supply, onClose }: { supply: Supply; onClose: () => void }) {
  const update = useUpdateSupply(supply.id)

  async function handleSave(d: Parameters<typeof update.mutateAsync>[0]) {
    try {
      await update.mutateAsync(d)
      toast.success('Insumo atualizado')
      onClose()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao atualizar insumo')
    }
  }

  return (
    <Dialog open onClose={onClose}>
      <DialogTitle>Editar Insumo</DialogTitle>
      <div className="mt-4">
        <SupplyForm initial={supply} onSave={handleSave} onCancel={onClose} isPending={update.isPending} showActiveToggle />
      </div>
    </Dialog>
  )
}

function DeleteSupplyDialog({ supply, onClose }: { supply: Supply; onClose: () => void }) {
  const del = useDeleteSupply()

  async function handleConfirm() {
    try {
      await del.mutateAsync(supply.id)
      toast.success('Insumo removido')
      onClose()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao remover insumo')
    }
  }

  return (
    <Dialog open onClose={onClose}>
      <DialogTitle>Remover Insumo</DialogTitle>
      <div className="space-y-4 mt-4">
        <p className="text-sm text-muted-foreground">
          Remover o insumo <strong>{supply.name}</strong>? Esta ação não pode ser desfeita.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="destructive" onClick={handleConfirm}>Remover</Button>
        </div>
      </div>
    </Dialog>
  )
}
