'use client'

import { useRef, useState } from 'react'
import { FileText, Loader2, Pencil, Plus, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import {
  useContractTemplates,
  useCreateContractTemplate,
  useDeleteContractTemplate,
  usePresignTemplate,
  type ContractTemplate,
} from '@/lib/hooks/use-resources'

// ─── Form ──────────────────────────────────────────────────────────────────────

interface TemplateFormProps {
  initial?: ContractTemplate
  onClose: () => void
}

function TemplateForm({ initial, onClose }: TemplateFormProps) {
  const qc = useQueryClient()
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [storageKey, setStorageKey] = useState<string | undefined>(initial?.storageKey ?? undefined)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const create = useCreateContractTemplate()
  const presign = usePresignTemplate()
  const updateMutation = useMutation({
    mutationFn: (data: { name?: string; description?: string | null; storageKey?: string | null }) =>
      api.patch(`/contract-templates/${initial?.id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contract-templates'] }),
  })

  const isPending = create.isPending || updateMutation.isPending || uploading

  async function handleSave() {
    if (!name.trim()) {
      toast.error('Nome do contrato é obrigatório')
      return
    }

    let finalStorageKey = storageKey

    if (file) {
      setUploading(true)
      try {
        const { storageKey: sk, presignedUrl } = await presign.mutateAsync({
          fileName: file.name,
          mimeType: file.type,
          size: file.size,
        })
        await fetch(presignedUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type },
        })
        finalStorageKey = sk
      } catch {
        toast.error('Erro ao fazer upload do arquivo')
        setUploading(false)
        return
      }
      setUploading(false)
    }

    try {
      if (initial) {
        await updateMutation.mutateAsync({
          name: name.trim(),
          description: description.trim() || null,
          storageKey: finalStorageKey ?? null,
        })
      } else {
        await create.mutateAsync({
          name: name.trim(),
          description: description.trim() || undefined,
          storageKey: finalStorageKey,
        })
      }
      toast.success(initial ? 'Modelo atualizado' : 'Modelo criado')
      onClose()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao salvar modelo')
    }
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label htmlFor="tpl-name">Nome *</Label>
        <Input
          id="tpl-name"
          className="h-8 text-sm"
          placeholder="Ex: Direito de imagem"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="tpl-desc">Descrição</Label>
        <Input
          id="tpl-desc"
          className="h-8 text-sm"
          placeholder="Descrição opcional"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>Arquivo (PDF ou DOC)</Label>
        {initial?.storageKey && !file && (
          <p className="text-xs text-muted-foreground">Arquivo atual vinculado</p>
        )}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            {file ? file.name : 'Selecionar arquivo'}
          </Button>
          {file && (
            <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</span>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.doc,.docx"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
        <Button size="sm" onClick={() => void handleSave()} disabled={isPending}>
          {isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          {initial ? 'Salvar' : 'Criar'}
        </Button>
      </div>
    </div>
  )
}

// ─── Main Tab ─────────────────────────────────────────────────────────────────

export function ContractTemplatesTab() {
  const { data: templates = [], isLoading } = useContractTemplates()
  const deleteTemplate = useDeleteContractTemplate()

  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<ContractTemplate | null>(null)
  const [deleting, setDeleting] = useState<ContractTemplate | null>(null)

  async function handleDelete(id: string) {
    try {
      await deleteTemplate.mutateAsync(id)
      toast.success('Modelo excluído')
      setDeleting(null)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao excluir modelo')
    }
  }

  return (
    <div className="space-y-4 py-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Modelos de Contrato</p>
          <p className="text-xs text-muted-foreground">
            Defina os contratos/termos padrão da empresa para vincular a clientes.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Novo modelo
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Carregando modelos...
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum modelo cadastrado</p>
          <p className="text-xs text-muted-foreground mt-1">
            Crie modelos de contrato para vincular aos seus clientes.
          </p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => setCreating(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Criar primeiro modelo
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((tpl) => (
            <div key={tpl.id} className="flex items-center justify-between rounded-lg border px-4 py-3">
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-medium flex items-center gap-2">
                    {tpl.name}
                    {!tpl.active && (
                      <span className="text-xs text-muted-foreground rounded-full border px-2 py-0.5">
                        Inativo
                      </span>
                    )}
                  </p>
                  {tpl.description && (
                    <p className="text-xs text-muted-foreground">{tpl.description}</p>
                  )}
                  {tpl.storageKey && (
                    <p className="text-xs text-muted-foreground">Arquivo vinculado</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(tpl)}
                  title="Editar"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleting(tpl)}
                  title="Excluir"
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {creating && (
        <Dialog open onClose={() => setCreating(false)}>
          <DialogTitle>Novo modelo de contrato</DialogTitle>
          <TemplateForm onClose={() => setCreating(false)} />
        </Dialog>
      )}

      {editing && (
        <Dialog open onClose={() => setEditing(null)}>
          <DialogTitle>Editar modelo</DialogTitle>
          <TemplateForm initial={editing} onClose={() => setEditing(null)} />
        </Dialog>
      )}

      {deleting && (
        <Dialog open onClose={() => setDeleting(null)}>
          <DialogTitle>Excluir modelo</DialogTitle>
          <div className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Excluir o modelo <strong>{deleting.name}</strong>? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setDeleting(null)}>Cancelar</Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => void handleDelete(deleting.id)}
                disabled={deleteTemplate.isPending}
              >
                {deleteTemplate.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                Excluir
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  )
}
