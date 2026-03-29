'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  GripVertical,
  Loader2,
  Minus,
  Pencil,
  Plus,
  X,
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  type AnamnesisGroup,
  type AnamnesisItem,
  type AnamnesisQuestion,
  type AnamnesisQuestionOption,
  DEFAULT_ANAMNESIS_GROUP,
  useAnamnesisGroups,
  useSaveAnamnesisGroups,
} from '@/lib/hooks/use-settings'
import { BusinessHoursTab } from './_components/business-hours-tab'
import { ClinicTab } from './_components/clinic-tab'
import { PaymentMethodsTab } from './_components/payment-methods-tab'
import { UsersTab } from './_components/users-tab'
import { BodyMeasurementsTab } from './_components/body-measurements-tab'
import { ContractTemplatesTab } from './_components/contract-templates-tab'

// ── Types ──────────────────────────────────────────────────────────────────────

interface AnamnesisActionsRef {
  save: () => Promise<void>
  discard: () => void
}

type PendingAction = { type: 'tab'; tab: string } | { type: 'navigate'; href: string }

// ── Unsaved-changes confirmation dialog ────────────────────────────────────────

function UnsavedChangesDialog({
  isSaving,
  onSave,
  onDiscard,
  onCancel,
}: {
  isSaving: boolean
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="bg-card relative z-10 w-full max-w-sm space-y-4 rounded-xl border p-6 shadow-xl">
        <h3 className="text-base font-semibold">Alterações não salvas</h3>
        <p className="text-muted-foreground text-sm">
          Você tem alterações na configuração de Anamnese que ainda não foram salvas. O que deseja
          fazer?
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={isSaving}>
            Continuar editando
          </Button>
          <Button variant="destructive" size="sm" onClick={onDiscard} disabled={isSaving}>
            Descartar
          </Button>
          <Button size="sm" onClick={onSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                Salvando…
              </>
            ) : (
              'Salvar'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Anamnesis config tab ───────────────────────────────────────────────────────

function AnamnesisConfigTab({
  actionsRef,
  onDirtyChange,
}: {
  actionsRef: React.MutableRefObject<AnamnesisActionsRef>
  onDirtyChange: (dirty: boolean) => void
}) {
  type QuestionType = AnamnesisQuestion['type']

  const { data: serverGroups, isLoading } = useAnamnesisGroups()
  const save = useSaveAnamnesisGroups()

  // local mutable copy; null = not yet edited (use server data)
  const [groups, setGroups] = useState<AnamnesisGroup[] | null>(null)
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // ── add group form ──────────────────────────────────────────────────
  const [showAddGroup, setShowAddGroup] = useState(false)
  const [addingGroupName, setAddingGroupName] = useState('')
  const [groupNameError, setGroupNameError] = useState('')

  // ── rename group ────────────────────────────────────────────────────
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameError, setRenameError] = useState('')

  // ── add item form (per group) ───────────────────────────────────────
  const [addingToGroupId, setAddingToGroupId] = useState<string | null>(null)
  const [addMode, setAddMode] = useState<'question' | 'separator'>('question')
  const [newQ, setNewQ] = useState<{
    text: string
    type: QuestionType
    required: boolean
    options: string[]
    selectOptions: AnamnesisQuestionOption[]
  }>({ text: '', type: 'text', required: false, options: [], selectOptions: [] })
  const [newOptionText, setNewOptionText] = useState('')
  const [newOptionWithDesc, setNewOptionWithDesc] = useState(false)
  const [newSepText, setNewSepText] = useState('')

  // ── drag reorder ────────────────────────────────────────────────────
  const [dragInfo, setDragInfo] = useState<{ groupId: string; index: number } | null>(null)

  const effectiveGroups = groups ?? serverGroups ?? [DEFAULT_ANAMNESIS_GROUP]

  // ── dirty-state detection & navigation guard ────────────────────────

  const isDirty =
    groups !== null &&
    JSON.stringify(groups) !== JSON.stringify(serverGroups ?? [DEFAULT_ANAMNESIS_GROUP])

  // Keep a stable ref to the callback so the effect doesn't re-subscribe
  const onDirtyChangeRef = useRef(onDirtyChange)
  onDirtyChangeRef.current = onDirtyChange
  useEffect(() => {
    onDirtyChangeRef.current(isDirty)
  }, [isDirty])

  // Block browser close / page refresh when there are unsaved changes
  useEffect(() => {
    if (!isDirty) return
    function handler(e: BeforeUnloadEvent) {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  // Expose save / discard actions to parent (updated every render; safe for refs)
  actionsRef.current = {
    async save() {
      await handleSave()
    },
    discard() {
      setGroups(null)
      setSaved(false)
      cancelRename()
      setShowAddGroup(false)
      setAddingGroupName('')
      setGroupNameError('')
      setAddingToGroupId(null)
    },
  }

  const TYPE_LABEL: Record<QuestionType, string> = {
    text: 'Texto livre',
    yesno: 'Sim / Não',
    multiple: 'Múltipla escolha',
    select: 'Escolha única',
    numeric: 'Numérico',
    date: 'Data',
  }

  // ── group actions ───────────────────────────────────────────────────

  function addGroup() {
    const name = addingGroupName.trim()
    if (!name) return
    if (effectiveGroups.some((g) => g.name.toLowerCase() === name.toLowerCase())) {
      setGroupNameError('Já existe um grupo com esse nome.')
      return
    }
    const newGroup: AnamnesisGroup = { id: Date.now().toString(), name, questions: [] }
    const updated = [...effectiveGroups, newGroup]
    setGroups(updated)
    setExpandedGroupId(newGroup.id)
    setAddingGroupName('')
    setGroupNameError('')
    setShowAddGroup(false)
  }

  function duplicateGroup(id: string) {
    const src = effectiveGroups.find((g) => g.id === id)
    if (!src) return
    let newName = `Cópia de ${src.name}`
    let suffix = 2
    while (effectiveGroups.some((g) => g.name.toLowerCase() === newName.toLowerCase())) {
      newName = `Cópia de ${src.name} (${suffix++})`
    }
    const base = Date.now()
    const copy: AnamnesisGroup = {
      id: base.toString(),
      name: newName,
      questions: src.questions.map((q, i) => ({ ...q, id: `${q.id}_copy_${base + i}` })),
    }
    setGroups([...effectiveGroups, copy])
  }

  function removeGroup(id: string) {
    if (effectiveGroups.length === 1) return // keep at least one
    setGroups(effectiveGroups.filter((g) => g.id !== id))
    if (expandedGroupId === id) setExpandedGroupId(null)
    if (renamingGroupId === id) cancelRename()
  }

  function openRename(group: AnamnesisGroup) {
    setRenamingGroupId(group.id)
    setRenameValue(group.name)
    setRenameError('')
  }

  function confirmRename(id: string) {
    const name = renameValue.trim()
    if (!name) {
      setRenameError('O nome não pode estar vazio.')
      return
    }
    if (effectiveGroups.some((g) => g.id !== id && g.name.toLowerCase() === name.toLowerCase())) {
      setRenameError('Já existe um grupo com esse nome.')
      return
    }
    setGroups(effectiveGroups.map((g) => (g.id === id ? { ...g, name } : g)))
    setRenamingGroupId(null)
    setRenameValue('')
    setRenameError('')
  }

  function cancelRename() {
    setRenamingGroupId(null)
    setRenameValue('')
    setRenameError('')
  }

  function updateGroupItems(groupId: string, items: AnamnesisItem[]) {
    setGroups(effectiveGroups.map((g) => (g.id === groupId ? { ...g, questions: items } : g)))
  }

  function toggleRequired(groupId: string, itemId: string) {
    const group = effectiveGroups.find((g) => g.id === groupId)
    if (!group) return
    updateGroupItems(
      groupId,
      group.questions.map((q) =>
        q.id === itemId && q.type !== 'separator'
          ? { ...q, required: !(q as AnamnesisQuestion).required }
          : q,
      ),
    )
  }

  function removeItem(groupId: string, itemId: string) {
    const group = effectiveGroups.find((g) => g.id === groupId)
    if (!group) return
    updateGroupItems(
      groupId,
      group.questions.filter((q) => q.id !== itemId),
    )
  }

  // ── add item actions ────────────────────────────────────────────────

  function openAddForm(groupId: string) {
    setAddingToGroupId(groupId)
    setAddMode('question')
    setNewQ({ text: '', type: 'text', required: false, options: [], selectOptions: [] })
    setNewOptionText('')
    setNewOptionWithDesc(false)
    setNewSepText('')
  }

  function closeAddForm() {
    setAddingToGroupId(null)
    setNewOptionText('')
    setNewOptionWithDesc(false)
    setNewSepText('')
  }

  function addOption() {
    if (!newOptionText.trim()) return
    if (newQ.type === 'multiple') {
      setNewQ((prev) => ({ ...prev, options: [...prev.options, newOptionText.trim()] }))
    } else if (newQ.type === 'select') {
      setNewQ((prev) => ({
        ...prev,
        selectOptions: [
          ...prev.selectOptions,
          { label: newOptionText.trim(), withDescription: newOptionWithDesc },
        ],
      }))
    }
    setNewOptionText('')
    setNewOptionWithDesc(false)
  }

  function removeOption(idx: number) {
    if (newQ.type === 'multiple') {
      setNewQ((prev) => ({ ...prev, options: prev.options.filter((_, i) => i !== idx) }))
    } else if (newQ.type === 'select') {
      setNewQ((prev) => ({
        ...prev,
        selectOptions: prev.selectOptions.filter((_, i) => i !== idx),
      }))
    }
  }

  function addItemToGroup() {
    if (!addingToGroupId) return
    const group = effectiveGroups.find((g) => g.id === addingToGroupId)
    if (!group) return

    if (addMode === 'separator') {
      if (!newSepText.trim()) return
      const sep: AnamnesisItem = {
        id: Date.now().toString(),
        type: 'separator',
        text: newSepText.trim(),
      }
      updateGroupItems(addingToGroupId, [...group.questions, sep])
      setNewSepText('')
    } else {
      if (!newQ.text.trim()) return
      const q: AnamnesisQuestion = {
        id: Date.now().toString(),
        text: newQ.text,
        type: newQ.type,
        required: newQ.required,
        ...(newQ.type === 'multiple' && { options: newQ.options }),
        ...(newQ.type === 'select' && { selectOptions: newQ.selectOptions }),
      }
      updateGroupItems(addingToGroupId, [...group.questions, q])
      setNewQ({ text: '', type: 'text', required: false, options: [], selectOptions: [] })
      setNewOptionText('')
      setNewOptionWithDesc(false)
    }
  }

  // ── drag reorder (within a group) ───────────────────────────────────

  function handleDrop(groupId: string, toIndex: number) {
    if (!dragInfo || dragInfo.groupId !== groupId || dragInfo.index === toIndex) return
    const group = effectiveGroups.find((g) => g.id === groupId)
    if (!group) return
    const reordered = [...group.questions]
    const [moved] = reordered.splice(dragInfo.index, 1)
    reordered.splice(toIndex, 0, moved)
    updateGroupItems(groupId, reordered)
    setDragInfo(null)
  }

  // ── save ────────────────────────────────────────────────────────────

  async function handleSave() {
    await save.mutateAsync(effectiveGroups)
    setGroups(null) // clear local override — server is now authoritative
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  // ── render ──────────────────────────────────────────────────────────

  return (
    <div className="mt-6 space-y-6">
      <div className="bg-card rounded-xl border p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">Grupos de Anamnese</h3>
            <p className="text-muted-foreground mt-1 text-sm">
              Crie grupos de perguntas. Na ficha do cliente, selecione o grupo para aplicar.
            </p>
          </div>
          <Button size="sm" onClick={() => void handleSave()} disabled={save.isPending}>
            {save.isPending ? (
              <>
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                Salvando…
              </>
            ) : saved ? (
              '✓ Salvo!'
            ) : (
              'Salvar'
            )}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {effectiveGroups.map((group) => {
              const isExpanded = expandedGroupId === group.id
              return (
                <div key={group.id} className="bg-muted/10 rounded-lg border">
                  {/* Group header */}
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    {renamingGroupId === group.id ? (
                      /* ── inline rename form ── */
                      <div className="flex flex-1 flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Input
                            value={renameValue}
                            onChange={(e) => {
                              setRenameValue(e.target.value)
                              setRenameError('')
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                confirmRename(group.id)
                              }
                              if (e.key === 'Escape') cancelRename()
                            }}
                            autoFocus
                            className="h-7 flex-1 text-sm"
                          />
                          <Button
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => confirmRename(group.id)}
                            disabled={!renameValue.trim()}
                          >
                            Salvar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={cancelRename}
                          >
                            Cancelar
                          </Button>
                        </div>
                        {renameError && <p className="text-xs text-red-500">{renameError}</p>}
                      </div>
                    ) : (
                      /* ── normal header ── */
                      <>
                        <button
                          onClick={() => setExpandedGroupId(isExpanded ? null : group.id)}
                          className="flex flex-1 items-center gap-2 text-left"
                        >
                          {isExpanded ? (
                            <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0" />
                          ) : (
                            <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
                          )}
                          <span className="text-foreground text-sm font-medium">{group.name}</span>
                          <span className="bg-muted text-muted-foreground ml-1 rounded-full px-1.5 py-0.5 text-[10px]">
                            {group.questions.filter((q) => q.type !== 'separator').length} pergunta
                            {group.questions.filter((q) => q.type !== 'separator').length !== 1
                              ? 's'
                              : ''}
                          </span>
                        </button>
                        <button
                          title="Renomear grupo"
                          onClick={() => openRename(group)}
                          className="text-muted-foreground hover:bg-muted/60 hover:text-foreground rounded p-1 transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          title="Duplicar grupo"
                          onClick={() => duplicateGroup(group.id)}
                          className="text-muted-foreground hover:bg-muted/60 hover:text-foreground rounded p-1 transition-colors"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          title="Remover grupo"
                          onClick={() => removeGroup(group.id)}
                          disabled={effectiveGroups.length === 1}
                          className="text-muted-foreground rounded p-1 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-30"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>

                  {/* Group body (expanded) */}
                  {isExpanded && (
                    <div className="space-y-2 border-t px-3 py-3">
                      {/* Items list */}
                      {group.questions.length === 0 && (
                        <p className="text-muted-foreground py-1 text-xs italic">
                          Nenhuma pergunta. Adicione abaixo.
                        </p>
                      )}
                      {group.questions.map((item, i) => {
                        if (item.type === 'separator') {
                          return (
                            <div
                              key={item.id}
                              draggable
                              onDragStart={() => setDragInfo({ groupId: group.id, index: i })}
                              onDragEnd={() => setDragInfo(null)}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={() => handleDrop(group.id, i)}
                              className={[
                                'flex items-center gap-2',
                                dragInfo?.groupId === group.id && dragInfo.index === i
                                  ? 'opacity-40'
                                  : '',
                              ].join(' ')}
                            >
                              <GripVertical className="text-muted-foreground/40 h-4 w-4 shrink-0 cursor-grab" />
                              <div className="flex flex-1 items-center gap-2">
                                <Minus className="text-muted-foreground/60 h-3 w-3" />
                                <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                                  {item.text}
                                </span>
                                <div className="bg-border h-px flex-1" />
                              </div>
                              <button
                                onClick={() => removeItem(group.id, item.id)}
                                className="text-muted-foreground text-xs hover:text-red-500"
                              >
                                ✕
                              </button>
                            </div>
                          )
                        }
                        const q = item as AnamnesisQuestion
                        return (
                          <div
                            key={q.id}
                            draggable
                            onDragStart={() => setDragInfo({ groupId: group.id, index: i })}
                            onDragEnd={() => setDragInfo(null)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => handleDrop(group.id, i)}
                            className={[
                              'bg-background rounded-lg border px-3 py-2',
                              dragInfo?.groupId === group.id && dragInfo.index === i
                                ? 'opacity-40'
                                : '',
                            ].join(' ')}
                          >
                            <div className="flex items-center gap-2">
                              <GripVertical className="text-muted-foreground/50 h-4 w-4 shrink-0 cursor-grab active:cursor-grabbing" />
                              <span className="text-foreground flex-1 text-sm">{q.text}</span>
                              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                                {TYPE_LABEL[q.type]}
                              </span>
                              <button
                                onClick={() => toggleRequired(group.id, q.id)}
                                className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${q.required ? 'bg-red-100 text-red-700' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                              >
                                {q.required ? 'Obrigatório' : 'Opcional'}
                              </button>
                              <button
                                onClick={() => removeItem(group.id, q.id)}
                                className="text-muted-foreground text-xs transition-colors hover:text-red-500"
                              >
                                ✕
                              </button>
                            </div>
                            {q.type === 'multiple' && (q.options ?? []).length > 0 && (
                              <div className="mt-1.5 ml-6 flex flex-wrap gap-1">
                                {(q.options ?? []).map((opt) => (
                                  <span
                                    key={opt}
                                    className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-xs"
                                  >
                                    {opt}
                                  </span>
                                ))}
                              </div>
                            )}
                            {q.type === 'select' && (q.selectOptions ?? []).length > 0 && (
                              <div className="mt-1.5 ml-6 flex flex-wrap gap-1">
                                {(q.selectOptions ?? []).map((opt) => (
                                  <span
                                    key={opt.label}
                                    className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-xs"
                                  >
                                    {opt.label}
                                    {opt.withDescription ? ' ✎' : ''}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}

                      {/* Add item form */}
                      {addingToGroupId === group.id ? (
                        <div className="bg-muted/20 mt-2 space-y-3 rounded-lg border p-3">
                          {/* Mode switcher */}
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setAddMode('question')}
                              className={`rounded-full border px-3 py-0.5 text-xs font-medium transition-colors ${addMode === 'question' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground'}`}
                            >
                              Pergunta
                            </button>
                            <button
                              type="button"
                              onClick={() => setAddMode('separator')}
                              className={`rounded-full border px-3 py-0.5 text-xs font-medium transition-colors ${addMode === 'separator' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground'}`}
                            >
                              Separador de categoria
                            </button>
                          </div>

                          {addMode === 'separator' ? (
                            <div className="space-y-1">
                              <Label className="text-xs">Nome da categoria</Label>
                              <Input
                                value={newSepText}
                                onChange={(e) => setNewSepText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault()
                                    addItemToGroup()
                                  }
                                }}
                                placeholder="Ex: Histórico médico…"
                                className="text-sm"
                              />
                            </div>
                          ) : (
                            <>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="col-span-2 space-y-1">
                                  <Label className="text-xs">Pergunta</Label>
                                  <Input
                                    value={newQ.text}
                                    onChange={(e) => setNewQ({ ...newQ, text: e.target.value })}
                                    placeholder="Escreva a pergunta…"
                                    className="text-sm"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Tipo de resposta</Label>
                                  <select
                                    value={newQ.type}
                                    onChange={(e) =>
                                      setNewQ({
                                        ...newQ,
                                        type: e.target.value as QuestionType,
                                        options: [],
                                        selectOptions: [],
                                      })
                                    }
                                    className="bg-background w-full rounded-md border px-2 py-1.5 text-sm"
                                  >
                                    {Object.entries(TYPE_LABEL).map(([v, l]) => (
                                      <option key={v} value={v}>
                                        {l}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="flex items-end gap-2">
                                  <label className="text-muted-foreground flex cursor-pointer items-center gap-2 text-sm">
                                    <input
                                      type="checkbox"
                                      checked={newQ.required}
                                      onChange={(e) =>
                                        setNewQ({ ...newQ, required: e.target.checked })
                                      }
                                      className="rounded"
                                    />
                                    Obrigatório
                                  </label>
                                </div>
                              </div>

                              {newQ.type === 'multiple' && (
                                <div className="space-y-2">
                                  <Label className="text-xs">Alternativas</Label>
                                  {newQ.options.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5">
                                      {newQ.options.map((opt, idx) => (
                                        <span
                                          key={idx}
                                          className="bg-muted text-foreground flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
                                        >
                                          {opt}
                                          <button
                                            type="button"
                                            onClick={() => removeOption(idx)}
                                            className="hover:text-red-500"
                                          >
                                            <X className="h-3 w-3" />
                                          </button>
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  <div className="flex gap-2">
                                    <Input
                                      value={newOptionText}
                                      onChange={(e) => setNewOptionText(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault()
                                          addOption()
                                        }
                                      }}
                                      placeholder="Nova alternativa…"
                                      className="flex-1 text-sm"
                                    />
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={addOption}
                                      disabled={!newOptionText.trim()}
                                    >
                                      Adicionar
                                    </Button>
                                  </div>
                                </div>
                              )}

                              {newQ.type === 'select' && (
                                <div className="space-y-2">
                                  <Label className="text-xs">Alternativas</Label>
                                  <p className="text-muted-foreground text-xs">
                                    Marque ✎ para exibir campo de descrição ao selecionar.
                                  </p>
                                  {newQ.selectOptions.length > 0 && (
                                    <div className="space-y-1">
                                      {newQ.selectOptions.map((opt, idx) => (
                                        <div
                                          key={idx}
                                          className="bg-muted/50 flex items-center gap-2 rounded px-2 py-1"
                                        >
                                          <span className="flex-1 text-xs">{opt.label}</span>
                                          {opt.withDescription && (
                                            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700">
                                              com descrição
                                            </span>
                                          )}
                                          <button
                                            type="button"
                                            onClick={() => removeOption(idx)}
                                            className="text-muted-foreground hover:text-red-500"
                                          >
                                            <X className="h-3 w-3" />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  <div className="flex items-center gap-2">
                                    <Input
                                      value={newOptionText}
                                      onChange={(e) => setNewOptionText(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault()
                                          addOption()
                                        }
                                      }}
                                      placeholder="Nova alternativa…"
                                      className="flex-1 text-sm"
                                    />
                                    <label className="text-muted-foreground flex cursor-pointer items-center gap-1.5 text-xs whitespace-nowrap">
                                      <input
                                        type="checkbox"
                                        checked={newOptionWithDesc}
                                        onChange={(e) => setNewOptionWithDesc(e.target.checked)}
                                        className="rounded"
                                      />
                                      ✎ descrição
                                    </label>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={addOption}
                                      disabled={!newOptionText.trim()}
                                    >
                                      Adicionar
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </>
                          )}

                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={addItemToGroup}
                              disabled={
                                addMode === 'question' ? !newQ.text.trim() : !newSepText.trim()
                              }
                            >
                              {addMode === 'separator'
                                ? 'Adicionar separador'
                                : 'Adicionar pergunta'}
                            </Button>
                            <Button size="sm" variant="outline" onClick={closeAddForm}>
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => openAddForm(group.id)}
                          className="text-primary mt-1 flex items-center gap-1 text-sm font-medium hover:underline"
                        >
                          <Plus className="h-3.5 w-3.5" /> Adicionar item
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Add group section */}
            {showAddGroup ? (
              <div className="bg-muted/10 space-y-2 rounded-lg border border-dashed p-3">
                <p className="text-muted-foreground text-xs font-medium">Novo grupo</p>
                <div className="flex gap-2">
                  <Input
                    value={addingGroupName}
                    onChange={(e) => {
                      setAddingGroupName(e.target.value)
                      setGroupNameError('')
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addGroup()
                      }
                    }}
                    placeholder="Nome do grupo (ex: Pré-procedimento)…"
                    className="flex-1 text-sm"
                  />
                  <Button size="sm" onClick={addGroup} disabled={!addingGroupName.trim()}>
                    Criar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowAddGroup(false)
                      setAddingGroupName('')
                      setGroupNameError('')
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
                {groupNameError && <p className="text-xs text-red-500">{groupNameError}</p>}
              </div>
            ) : (
              <button
                onClick={() => setShowAddGroup(true)}
                className="text-primary hover:bg-primary/5 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed px-3 py-2 text-sm font-medium transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Adicionar grupo
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function WhatsAppAutomationTab() {
  const [enabled, setEnabled] = useState(false)
  const [sendTime, setSendTime] = useState('09:00')
  const [template, setTemplate] = useState(
    'Olá {nome}! 🎉\nA equipe da clínica deseja um feliz aniversário!\nComo presente, você ganhou {benefício}.\nEstamos aqui para te receber com muito carinho! 💜',
  )
  const [saved, setSaved] = useState(false)

  function handleSave() {
    // In a full implementation, this would save to backend
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="mt-6 space-y-6">
      {/* Birthday Automation */}
      <div className="bg-card rounded-xl border p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">Automação de Aniversários</h3>
            <p className="text-muted-foreground mt-1 text-sm">
              Envie mensagens automáticas de feliz aniversário via WhatsApp para seus clientes.
            </p>
          </div>
          <button
            onClick={() => setEnabled(!enabled)}
            className={[
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none',
              enabled ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700',
            ].join(' ')}
          >
            <span
              className={[
                'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                enabled ? 'translate-x-6' : 'translate-x-1',
              ].join(' ')}
            />
          </button>
        </div>

        {enabled && (
          <div className="mt-6 space-y-4 border-t pt-4">
            <div className="space-y-2">
              <Label>Horário de envio</Label>
              <input
                type="time"
                value={sendTime}
                onChange={(e) => setSendTime(e.target.value)}
                className="bg-background text-foreground focus:ring-primary rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
              />
              <p className="text-muted-foreground text-xs">
                O sistema enviará mensagens neste horário para todos os aniversariantes do dia.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Template da mensagem</Label>
              <p className="text-muted-foreground text-xs">
                Use <code className="bg-muted rounded px-1 py-0.5 font-mono">{'{nome}'}</code> para
                o nome do cliente e{' '}
                <code className="bg-muted rounded px-1 py-0.5 font-mono">{'{benefício}'}</code> para
                um benefício personalizado.
              </p>
              <textarea
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                rows={5}
                className="bg-background text-foreground focus:ring-primary w-full resize-none rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
              />
              <p className="text-muted-foreground text-xs">Prévia para "Maria":</p>
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm whitespace-pre-wrap text-green-900 dark:border-green-900/30 dark:bg-green-950/20 dark:text-green-300">
                {template
                  .replace('{nome}', 'Maria')
                  .replace('{benefício}', '10% de desconto no próximo tratamento')}
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSave} size="sm">
                {saved ? '✓ Salvo!' : 'Salvar configurações'}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Integration note */}
      <div className="bg-card rounded-xl border p-6 shadow-sm">
        <h3 className="text-base font-semibold">Integração WhatsApp</h3>
        <p className="text-muted-foreground mt-2 text-sm">
          Para envios automáticos, configure uma integração com Z-API ou Evolution API. Defina a
          variável de ambiente{' '}
          <code className="bg-muted mx-1 rounded px-1 py-0.5 font-mono text-xs">ZAPI_TOKEN</code> no
          serviço de API.
        </p>
        <p className="text-muted-foreground mt-2 text-sm">
          Sem integração configurada, os envios funcionam como links de WhatsApp (abertura manual
          pelo celular).
        </p>
      </div>
    </div>
  )
}

function AiIntegrationsTab() {
  return (
    <div className="mt-6 space-y-6">
      {/* Gemini API Key */}
      <div className="bg-card rounded-xl border p-6 shadow-sm">
        <h3 className="text-base font-semibold">Chave de API — Google Gemini (IA)</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Os recursos de IA (Briefing do dia, Resumo de clientes) usam o modelo Gemini do Google.
          Para ativá-los você precisa gerar uma chave gratuita e configurá-la na variável de
          ambiente
          <code className="bg-muted mx-1 rounded px-1 py-0.5 font-mono text-xs">
            GEMINI_API_KEY
          </code>
          do serviço de API.
        </p>

        <ol className="text-foreground mt-4 space-y-3 text-sm">
          <li className="flex gap-3">
            <span className="bg-primary text-primary-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">
              1
            </span>
            <span>
              Acesse{' '}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary inline-flex items-center gap-1 underline underline-offset-2 hover:opacity-80"
              >
                Google AI Studio
                <ExternalLink className="h-3 w-3" />
              </a>{' '}
              e faça login com sua conta Google.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="bg-primary text-primary-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">
              2
            </span>
            <span>
              Clique em <strong>Criar chave de API</strong> e copie a chave gerada (começa com{' '}
              <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">AIza…</code>).
            </span>
          </li>
          <li className="flex gap-3">
            <span className="bg-primary text-primary-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">
              3
            </span>
            <span>
              No painel do Railway, abra o serviço <strong>api</strong> → aba{' '}
              <strong>Variables</strong> e adicione:
            </span>
          </li>
        </ol>

        <div className="bg-muted mt-3 rounded-lg px-4 py-3 font-mono text-xs">
          GEMINI_API_KEY=<span className="text-muted-foreground">AIzaSy…sua_chave_aqui</span>
        </div>

        <ol className="text-foreground mt-3 space-y-3 text-sm" start={4}>
          <li className="flex gap-3">
            <span className="bg-primary text-primary-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">
              4
            </span>
            <span>
              Clique em <strong>Deploy</strong> para aplicar. Após o deploy, os recursos de IA
              estarão disponíveis automaticamente.
            </span>
          </li>
        </ol>

        <p className="border-primary/30 bg-primary/5 text-foreground mt-4 rounded-lg border px-4 py-3 text-sm">
          💡 A API do Gemini tem uma cota gratuita generosa (1 500 req/dia no plano free). Não é
          necessário cadastrar cartão de crédito para começar.
        </p>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('clinic')
  const [anamnesisDirty, setAnamnesisDirty] = useState(false)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [isSavingForNav, setIsSavingForNav] = useState(false)

  const anamnesisActionsRef = useRef<AnamnesisActionsRef>({
    save: () => Promise.resolve(),
    discard: () => {},
  })

  // Keep a stable ref so the event listener reads the latest dirty flag
  const anamnesisDirtyRef = useRef(false)
  anamnesisDirtyRef.current = anamnesisDirty

  // Intercept sidebar / in-app link clicks when there are unsaved changes
  useEffect(() => {
    function handleLinkClick(e: MouseEvent) {
      if (!anamnesisDirtyRef.current) return
      const link = (e.target as Element).closest('a[href]')
      if (!link) return
      const href = link.getAttribute('href') ?? ''
      // Allow external links and links that stay within /settings
      if (
        !href ||
        href.startsWith('http') ||
        href.startsWith('mailto') ||
        href.startsWith('/settings')
      )
        return
      e.preventDefault()
      e.stopPropagation()
      setPendingAction({ type: 'navigate', href })
    }
    // Capture phase: fires before React processes the click
    document.addEventListener('click', handleLinkClick, true)
    return () => document.removeEventListener('click', handleLinkClick, true)
  }, [])

  function handleTabChange(tab: string) {
    if (anamnesisDirty) {
      setPendingAction({ type: 'tab', tab })
    } else {
      setActiveTab(tab)
    }
  }

  function proceed(action: PendingAction) {
    if (action.type === 'tab') {
      setActiveTab(action.tab)
    } else {
      router.push(action.href)
    }
  }

  async function handleSaveAndProceed() {
    if (!pendingAction) return
    setIsSavingForNav(true)
    try {
      await anamnesisActionsRef.current.save()
    } finally {
      setIsSavingForNav(false)
    }
    const action = pendingAction
    setPendingAction(null)
    proceed(action)
  }

  function handleDiscardAndProceed() {
    if (!pendingAction) return
    anamnesisActionsRef.current.discard()
    const action = pendingAction
    setPendingAction(null)
    proceed(action)
  }

  return (
    <div>
      <h2 className="mb-6 text-2xl font-semibold">Configurações</h2>

      <Tabs value={activeTab} defaultValue="clinic" onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="clinic">Clínica</TabsTrigger>
          <TabsTrigger value="payment-methods">Formas de pagamento</TabsTrigger>
          <TabsTrigger value="hours">Horários</TabsTrigger>
          <TabsTrigger value="users">Usuários</TabsTrigger>
          <TabsTrigger value="ai">Integrações IA</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="anamnesis">Anamnese</TabsTrigger>
          <TabsTrigger value="body-measurements">Medidas Corporais</TabsTrigger>
          <TabsTrigger value="contracts">Contratos</TabsTrigger>
        </TabsList>

        <TabsContent value="clinic">
          <ClinicTab />
        </TabsContent>

        <TabsContent value="payment-methods">
          <PaymentMethodsTab />
        </TabsContent>

        <TabsContent value="hours">
          <BusinessHoursTab />
        </TabsContent>

        <TabsContent value="users">
          <UsersTab />
        </TabsContent>

        <TabsContent value="ai">
          <AiIntegrationsTab />
        </TabsContent>

        <TabsContent value="whatsapp">
          <WhatsAppAutomationTab />
        </TabsContent>

        <TabsContent value="anamnesis">
          <AnamnesisConfigTab actionsRef={anamnesisActionsRef} onDirtyChange={setAnamnesisDirty} />
        </TabsContent>

        <TabsContent value="body-measurements">
          <BodyMeasurementsTab />
        </TabsContent>

        <TabsContent value="contracts">
          <ContractTemplatesTab />
        </TabsContent>
      </Tabs>

      {pendingAction && (
        <UnsavedChangesDialog
          isSaving={isSavingForNav}
          onSave={() => void handleSaveAndProceed()}
          onDiscard={handleDiscardAndProceed}
          onCancel={() => setPendingAction(null)}
        />
      )}
    </div>
  )
}
