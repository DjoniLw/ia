'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Bot, ClipboardList, FileSignature, Loader2, Package, Plus, Scissors, Search, User } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  type Customer,
  type ClinicalRecord,
  useCreateClinicalRecord,
  useUpdateClinicalRecord,
  useCreateCustomer,
  useClinicalRecords,
  useCustomerHistory,
  useCustomers,
  useDeleteCustomer,
  useUpdateCustomer,
} from '@/lib/hooks/use-resources'
import { type AnamnesisQuestion, useAnamnesisTemplate } from '@/lib/hooks/use-settings'
import { api } from '@/lib/api'

// ──── Masks ────────────────────────────────────────────────────────────────────

function applyCpfMask(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

function applyPhoneMask(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

function applyCepMask(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 8)
  if (d.length <= 5) return d
  return `${d.slice(0, 5)}-${d.slice(5)}`
}

// ──── Schema ───────────────────────────────────────────────────────────────────

const customerSchema = z.object({
  // Basic
  name: z.string().min(2, 'Nome obrigatório'),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  phone2: z.string().optional(),
  document: z.string().optional(),
  rg: z.string().optional(),
  gender: z.string().optional(),
  birthDate: z.string().optional(),
  occupation: z.string().optional(),
  howFound: z.string().optional(),
  notes: z.string().optional(),
  // Address
  addr_street: z.string().optional(),
  addr_number: z.string().optional(),
  addr_complement: z.string().optional(),
  addr_neighborhood: z.string().optional(),
  addr_city: z.string().optional(),
  addr_state: z.string().optional(),
  addr_zip: z.string().optional(),
  // Anamnesis
  ana_skinType: z.string().optional(),
  ana_allergies: z.string().optional(),
  ana_medications: z.string().optional(),
  ana_conditions: z.string().optional(),
  ana_previousTreatments: z.string().optional(),
  ana_currentTreatments: z.string().optional(),
  ana_observations: z.string().optional(),
  ana_consentSigned: z.boolean().optional(),
})
type CustomerFormData = z.infer<typeof customerSchema>

function toApiPayload(formData: CustomerFormData) {
  return {
    name: formData.name,
    email: formData.email || null,
    phone: formData.phone || null,
    phone2: formData.phone2 || null,
    document: formData.document || null,
    rg: formData.rg || null,
    gender: formData.gender || null,
    birthDate: formData.birthDate || null,
    occupation: formData.occupation || null,
    howFound: formData.howFound || null,
    notes: formData.notes || null,
    address: {
      street: formData.addr_street || undefined,
      number: formData.addr_number || undefined,
      complement: formData.addr_complement || undefined,
      neighborhood: formData.addr_neighborhood || undefined,
      city: formData.addr_city || undefined,
      state: formData.addr_state || undefined,
      zip: formData.addr_zip || undefined,
    },
    anamnesis: {
      skinType: formData.ana_skinType || undefined,
      allergies: formData.ana_allergies || undefined,
      medications: formData.ana_medications || undefined,
      conditions: formData.ana_conditions || undefined,
      previousTreatments: formData.ana_previousTreatments || undefined,
      currentTreatments: formData.ana_currentTreatments || undefined,
      observations: formData.ana_observations || undefined,
      consentSigned: formData.ana_consentSigned,
    },
  }
}

function fromCustomer(c: Customer): Partial<CustomerFormData> {
  const addr = c.address ?? {}
  const ana = c.metadata?.anamnesis ?? {}
  const meta = c.metadata ?? {}
  return {
    name: c.name,
    email: c.email ?? '',
    phone: c.phone ?? '',
    phone2: (meta.phone2 as string) ?? '',
    document: c.document ?? '',
    rg: (meta.rg as string) ?? '',
    gender: (meta.gender as string) ?? '',
    birthDate: c.birthDate?.slice(0, 10) ?? '',
    occupation: (meta.occupation as string) ?? '',
    howFound: (meta.howFound as string) ?? '',
    notes: c.notes ?? '',
    addr_street: addr.street ?? '',
    addr_number: addr.number ?? '',
    addr_complement: addr.complement ?? '',
    addr_neighborhood: addr.neighborhood ?? '',
    addr_city: addr.city ?? '',
    addr_state: addr.state ?? '',
    addr_zip: addr.zip ?? '',
    ana_skinType: ana.skinType ?? '',
    ana_allergies: ana.allergies ?? '',
    ana_medications: ana.medications ?? '',
    ana_conditions: ana.conditions ?? '',
    ana_previousTreatments: ana.previousTreatments ?? '',
    ana_currentTreatments: ana.currentTreatments ?? '',
    ana_observations: ana.observations ?? '',
    ana_consentSigned: ana.consentSigned ?? false,
  }
}

// ──── Form Tabs ─────────────────────────────────────────────────────────────────

type FormTab = 'basic' | 'address' | 'health'

function CustomerForm({
  defaultValues,
  onSave,
  isPending,
}: {
  defaultValues?: Partial<CustomerFormData>
  onSave: (data: CustomerFormData) => Promise<void>
  isPending: boolean
}) {
  const [tab, setTab] = useState<FormTab>('basic')

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues,
  })

  const tabs: Array<{ id: FormTab; label: string }> = [
    { id: 'basic', label: 'Dados Básicos' },
    { id: 'address', label: 'Endereço' },
    { id: 'health', label: 'Saúde & Anamnese' },
  ]

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4">
      {/* Tab bar */}
      <div className="flex rounded-lg border overflow-hidden">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={[
              'flex-1 py-1.5 px-1 text-xs sm:text-sm font-medium transition-colors',
              tab === t.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-muted-foreground hover:bg-accent',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Basic tab */}
      {tab === 'basic' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input {...register('name')} placeholder="Maria Silva" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input {...register('email')} type="email" placeholder="maria@email.com" />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Gênero</Label>
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register('gender')}>
                <option value="">Selecione…</option>
                <option>Feminino</option>
                <option>Masculino</option>
                <option>Não binário</option>
                <option>Prefiro não informar</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Telefone principal</Label>
              <Input
                {...register('phone')}
                placeholder="(11) 99999-9999"
                inputMode="numeric"
                onChange={(e) => { const v = applyPhoneMask(e.target.value); e.target.value = v; setValue('phone', v) }}
              />
            </div>
            <div className="space-y-2">
              <Label>Telefone secundário</Label>
              <Input
                {...register('phone2')}
                placeholder="(11) 99999-9999"
                inputMode="numeric"
                onChange={(e) => { const v = applyPhoneMask(e.target.value); e.target.value = v; setValue('phone2', v) }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>CPF</Label>
              <Input
                {...register('document')}
                placeholder="000.000.000-00"
                inputMode="numeric"
                onChange={(e) => { const v = applyCpfMask(e.target.value); e.target.value = v; setValue('document', v) }}
              />
            </div>
            <div className="space-y-2">
              <Label>RG</Label>
              <Input {...register('rg')} placeholder="00.000.000-0" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data de nascimento</Label>
              <Input {...register('birthDate')} type="date" />
            </div>
            <div className="space-y-2">
              <Label>Profissão</Label>
              <Input {...register('occupation')} placeholder="Ex: Professora" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Como nos encontrou</Label>
            <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register('howFound')}>
              <option value="">Selecione…</option>
              <option>Instagram</option>
              <option>Google</option>
              <option>Indicação de amigo</option>
              <option>Facebook</option>
              <option>TikTok</option>
              <option>Passando na rua</option>
              <option>Outro</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label>Observações gerais</Label>
            <textarea
              {...register('notes')}
              rows={3}
              placeholder="Alergia a látex, preferências…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
            />
          </div>
        </div>
      )}

      {/* Address tab */}
      {tab === 'address' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-2">
              <Label>Logradouro</Label>
              <Input {...register('addr_street')} placeholder="Rua das Flores" />
            </div>
            <div className="space-y-2">
              <Label>Número</Label>
              <Input {...register('addr_number')} placeholder="123" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Complemento</Label>
              <Input {...register('addr_complement')} placeholder="Apto 4B" />
            </div>
            <div className="space-y-2">
              <Label>Bairro</Label>
              <Input {...register('addr_neighborhood')} placeholder="Centro" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-2">
              <Label>Cidade</Label>
              <Input {...register('addr_city')} placeholder="São Paulo" />
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register('addr_state')}>
                <option value="">UF</option>
                {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map((uf) => <option key={uf}>{uf}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-2 max-w-xs">
            <Label>CEP</Label>
            <Input
              {...register('addr_zip')}
              placeholder="00000-000"
              inputMode="numeric"
              onChange={(e) => { const v = applyCepMask(e.target.value); e.target.value = v; setValue('addr_zip', v) }}
            />
          </div>
        </div>
      )}

      {/* Health / Anamnesis tab */}
      {tab === 'health' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de pele</Label>
            <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register('ana_skinType')}>
              <option value="">Selecione…</option>
              <option>Normal</option>
              <option>Seca</option>
              <option>Oleosa</option>
              <option>Mista</option>
              <option>Sensível</option>
              <option>Acneica</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label>Alergias conhecidas</Label>
            <textarea
              {...register('ana_allergies')}
              rows={2}
              placeholder="Ex: alergia a látex, peróxido de benzoíla…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label>Medicamentos em uso</Label>
            <textarea
              {...register('ana_medications')}
              rows={2}
              placeholder="Ex: Isotretinoína 20mg, anticoagulantes…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label>Condições de saúde / doenças</Label>
            <textarea
              {...register('ana_conditions')}
              rows={2}
              placeholder="Ex: diabetes, hipertensão, epilepsia…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tratamentos anteriores</Label>
              <textarea
                {...register('ana_previousTreatments')}
                rows={3}
                placeholder="Quais procedimentos já realizou…"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
              />
            </div>
            <div className="space-y-2">
              <Label>Tratamentos em andamento</Label>
              <textarea
                {...register('ana_currentTreatments')}
                rows={3}
                placeholder="Procedimentos em curso em outra clínica…"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observações clínicas</Label>
            <textarea
              {...register('ana_observations')}
              rows={3}
              placeholder="Outras informações relevantes…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="consent" {...register('ana_consentSigned')} className="h-4 w-4" />
            <label htmlFor="consent" className="text-sm text-foreground">
              Termo de consentimento assinado
            </label>
          </div>
        </div>
      )}

      <div className="flex justify-between gap-2 border-t pt-4">
        <div className="flex gap-2">
          {tab !== 'basic' && (
            <Button type="button" variant="outline" size="sm" onClick={() => setTab(tab === 'health' ? 'address' : 'basic')}>
              ← Anterior
            </Button>
          )}
          {tab !== 'health' && (
            <Button type="button" variant="outline" size="sm" onClick={() => setTab(tab === 'basic' ? 'address' : 'health')}>
              Próximo →
            </Button>
          )}
        </div>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </form>
  )
}

// ──── AI Summary Dialog ────────────────────────────────────────────────────────

function AiSummaryDialog({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const [summary, setSummary] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useState(() => {
    api
      .post<{ summary: string }>(`/ai/summary/customer/${customer.id}`)
      .then((r) => setSummary(r.data.summary))
      .catch((err: unknown) => {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        setSummary('Não foi possível gerar o resumo. ' + (msg ?? 'Verifique se GEMINI_API_KEY está configurada.'))
      })
      .finally(() => setLoading(false))
  })

  return (
    <Dialog open onClose={onClose}>
      <DialogTitle className="flex items-center gap-2">
        <Bot className="h-4 w-4 text-violet-600" />
        Resumo IA — {customer.name}
      </DialogTitle>
      <div className="mt-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
            <span className="ml-2 text-sm text-muted-foreground">Gerando resumo…</span>
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{summary}</p>
        )}
      </div>
      <div className="mt-4 flex justify-end">
        <Button variant="ghost" size="sm" onClick={onClose}>Fechar</Button>
      </div>
    </Dialog>
  )
}

// ──── Customer Detail Panel ────────────────────────────────────────────────────

type DetailTab = 'profile' | 'history' | 'prontuario' | 'contracts'

// Types for the new-entry form
type EntryType = ClinicalRecord['type']

const ENTRY_TYPES: { value: EntryType; label: string }[] = [
  { value: 'anamnesis', label: 'Anamnese' },
  { value: 'exam',      label: 'Exame' },
  { value: 'note',      label: 'Observação' },
  { value: 'procedure', label: 'Procedimento' },
  { value: 'prescription', label: 'Prescrição' },
]

const TYPE_LABEL: Record<string, string> = {
  anamnesis:    'Anamnese',
  exam:         'Exame',
  note:         'Observação',
  procedure:    'Procedimento',
  prescription: 'Prescrição',
}
const TYPE_COLOR: Record<string, string> = {
  anamnesis:    'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  exam:         'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  note:         'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  procedure:    'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  prescription: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
}

function CustomerDetail({ customer, onEdit, onClose }: { customer: Customer; onEdit: () => void; onClose: () => void }) {
  const [detailTab, setDetailTab] = useState<DetailTab>('profile')

  // ── clinical / prontuário ──────────────────────────────────────────────
  const clinicalRecords = useClinicalRecords(customer.id)
  const { data: anamnesisTemplate, isLoading: templateLoading } = useAnamnesisTemplate()
  const createRecord = useCreateClinicalRecord()

  // new-entry form
  const [showEntryForm, setShowEntryForm] = useState(false)
  const [entryType, setEntryType] = useState<EntryType>('anamnesis')
  // for non-anamnesis types
  const [simpleRecord, setSimpleRecord] = useState({ title: '', content: '', performedAt: '' })
  // for anamnesis type
  const [anamnesisAnswers, setAnamnesisAnswers] = useState<Record<string, string>>({})
  const [entrySubmitting, setEntrySubmitting] = useState(false)

  // edit record
  const [editingRecord, setEditingRecord] = useState<ClinicalRecord | null>(null)
  const [editValues, setEditValues] = useState({ title: '', content: '', performedAt: '' })
  const updateRecord = useUpdateClinicalRecord(editingRecord?.id ?? '')
  const [editSubmitting, setEditSubmitting] = useState(false)

  function openEntryForm() {
    setEntryType('anamnesis')
    setSimpleRecord({ title: '', content: '', performedAt: '' })
    setAnamnesisAnswers({})
    setShowEntryForm(true)
  }

  function openEditRecord(r: ClinicalRecord) {
    setEditingRecord(r)
    setEditValues({
      title: r.title,
      content: r.content,
      performedAt: r.performedAt ? r.performedAt.slice(0, 10) : '',
    })
  }

  async function submitEdit() {
    if (!editingRecord) return
    setEditSubmitting(true)
    try {
      await updateRecord.mutateAsync({
        customerId: customer.id,
        title: editValues.title,
        content: editValues.content,
        performedAt: editValues.performedAt ? new Date(editValues.performedAt).toISOString() : null,
      })
      setEditingRecord(null)
      toast.success('Lançamento atualizado')
    } catch {
      toast.error('Erro ao atualizar lançamento')
    } finally {
      setEditSubmitting(false)
    }
  }

  async function submitEntry() {
    setEntrySubmitting(true)
    try {
      if (entryType === 'anamnesis') {
        const questions = anamnesisTemplate ?? []
        const missing = questions.filter((q: AnamnesisQuestion) => q.required && !anamnesisAnswers[q.id]?.trim())
        if (missing.length > 0) {
          toast.error(`Preencha os campos obrigatórios: ${missing.map((q: AnamnesisQuestion) => q.text).join(', ')}`)
          setEntrySubmitting(false)
          return
        }
        const entries = questions.map((q: AnamnesisQuestion) => ({
          question: q.text,
          answer: anamnesisAnswers[q.id] ?? '',
          type: q.type,
        }))
        await createRecord.mutateAsync({
          customerId: customer.id,
          title: 'Anamnese',
          content: JSON.stringify(entries),
          type: 'anamnesis',
        })
      } else {
        if (!simpleRecord.title.trim()) { toast.error('Preencha o título'); return }
        if (!simpleRecord.content.trim()) { toast.error('Preencha o conteúdo'); return }
        await createRecord.mutateAsync({
          customerId: customer.id,
          title: simpleRecord.title,
          content: simpleRecord.content,
          type: entryType,
          performedAt: simpleRecord.performedAt ? new Date(simpleRecord.performedAt).toISOString() : null,
        })
      }
      setShowEntryForm(false)
      setAnamnesisAnswers({})
      setSimpleRecord({ title: '', content: '', performedAt: '' })
      toast.success('Lançamento salvo')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao salvar lançamento')
    } finally {
      setEntrySubmitting(false)
    }
  }

  // ── misc ──────────────────────────────────────────────────────────────
  const history = useCustomerHistory(customer.id)
  const addr = customer.address
  const meta = customer.metadata
  const ana = meta?.anamnesis

  function Row({ label, value }: { label: string; value: string | null | undefined }) {
    if (!value) return null
    return (
      <div className="flex gap-2 text-sm">
        <span className="min-w-[140px] text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{value}</span>
      </div>
    )
  }

  const hasAddress = addr && Object.values(addr).some(Boolean)
  const hasAna = ana && Object.values(ana).some(Boolean)

  const STATUS_LABEL: Record<string, string> = {
    draft: 'Rascunho', confirmed: 'Confirmado', in_progress: 'Em andamento',
    completed: 'Concluído', cancelled: 'Cancelado', no_show: 'Não compareceu',
  }
  const STATUS_COLOR: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700', confirmed: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-amber-100 text-amber-900', completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-muted text-muted-foreground', no_show: 'bg-red-100 text-red-800',
  }

  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <User className="h-6 w-6 text-primary" />
        </div>
        <div>
          <p className="text-lg font-semibold">{customer.name}</p>
          <p className="text-muted-foreground">{customer.email ?? '—'}</p>
        </div>
      </div>

      {/* Detail tabs */}
      <div className="flex rounded-lg border overflow-hidden">
        {([['profile', 'Dados'], ['history', 'Histórico'], ['prontuario', 'Prontuário'], ['contracts', 'Contratos']] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setDetailTab(id as DetailTab)}
            className={[
              'flex-1 py-1.5 px-1 text-xs font-medium transition-colors',
              detailTab === id ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-accent',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Dados ─────────────────────────────────────────────────────── */}
      {detailTab === 'profile' && (
        <>
          <div className="space-y-1.5 rounded-lg border bg-muted/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Dados Básicos</p>
            <Row label="Telefone" value={customer.phone} />
            <Row label="Telefone 2" value={meta?.phone2 as string} />
            <Row label="CPF" value={customer.document} />
            <Row label="RG" value={meta?.rg as string} />
            <Row label="Data de Nascimento" value={customer.birthDate ? new Date(customer.birthDate).toLocaleDateString('pt-BR') : null} />
            <Row label="Gênero" value={meta?.gender as string} />
            <Row label="Profissão" value={meta?.occupation as string} />
            <Row label="Como nos conheceu" value={meta?.howFound as string} />
            {!customer.phone && !customer.document && !meta?.rg && (
              <p className="text-xs text-muted-foreground italic">Nenhuma informação adicional cadastrada.</p>
            )}
          </div>

          {hasAddress && (
            <div className="space-y-1.5 rounded-lg border bg-muted/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Endereço</p>
              <Row label="Rua" value={addr?.street} />
              <Row label="Número" value={addr?.number as string} />
              <Row label="Complemento" value={addr?.complement as string} />
              <Row label="Bairro" value={addr?.neighborhood as string} />
              <Row label="Cidade" value={addr?.city} />
              <Row label="Estado" value={addr?.state} />
              <Row label="CEP" value={addr?.zip} />
            </div>
          )}

          {hasAna && (
            <div className="space-y-1.5 rounded-lg border bg-muted/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Saúde & Anamnese</p>
              {Object.entries(ana as Record<string, unknown>).map(([k, v]) => (
                <Row key={k} label={k} value={String(v ?? '')} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Histórico de atendimentos ─────────────────────────────────── */}
      {detailTab === 'history' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Scissors className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Atendimentos & Compras</p>
          </div>

          {history.isLoading ? (
            <div className="flex items-center justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          ) : !history.data?.appointments.length && !history.data?.sales.length ? (
            <p className="rounded-lg border bg-muted/10 px-3 py-4 text-center text-xs text-muted-foreground">
              Nenhum atendimento ou compra registrada.
            </p>
          ) : (
            <div className="space-y-2">
              {(history.data?.appointments ?? []).map((appt) => (
                <div key={appt.id} className="rounded-lg border bg-muted/10 p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-foreground">{appt.service.name}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLOR[appt.status] ?? 'bg-muted text-muted-foreground'}`}>
                      {STATUS_LABEL[appt.status] ?? appt.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground/70">
                    <span>{new Date(appt.scheduledAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    {appt.professional && <span>· {appt.professional.name}</span>}
                    {appt.billing && <span>· R$ {Number(appt.billing.amount).toFixed(2)}</span>}
                  </div>
                </div>
              ))}
              {(history.data?.sales ?? []).map((sale) => (
                <div key={sale.id} className="rounded-lg border bg-muted/10 p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-foreground">{sale.product.name} ×{sale.quantity}</p>
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                      Compra
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground/70">
                    <span>{new Date(sale.soldAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    <span>· R$ {Number(sale.totalPrice).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Prontuário (anamnese + exames + observações…) ─────────────── */}
      {detailTab === 'prontuario' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prontuário</p>
            </div>
            {!showEntryForm && (
              <button
                onClick={openEntryForm}
                className="flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/50"
              >
                <Plus className="h-3 w-3" />
                Novo lançamento
              </button>
            )}
          </div>

          {/* ── New-entry form ── */}
          {showEntryForm && (
            <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
              {/* Type selector */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Tipo de lançamento</label>
                <div className="flex flex-wrap gap-1.5">
                  {ENTRY_TYPES.map((et) => (
                    <button
                      key={et.value}
                      type="button"
                      onClick={() => setEntryType(et.value)}
                      className={[
                        'rounded-full px-3 py-1 text-xs font-medium transition-colors border',
                        entryType === et.value
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-muted-foreground hover:bg-muted/50',
                      ].join(' ')}
                    >
                      {et.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Anamnese form — uses configured template */}
              {entryType === 'anamnesis' && (
                <div className="space-y-3">
                  {templateLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : (anamnesisTemplate ?? []).length === 0 ? (
                    <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/30 dark:bg-amber-950/10 dark:text-amber-300">
                      Nenhuma pergunta configurada. Configure as perguntas em{' '}
                      <strong>Configurações → Anamnese</strong>.
                    </p>
                  ) : (
                    (anamnesisTemplate ?? []).map((q: AnamnesisQuestion) => (
                      <div key={q.id} className="space-y-1">
                        <label className="text-xs font-medium text-foreground">
                          {q.text}
                          {q.required && <span className="ml-1 text-red-500">*</span>}
                        </label>
                        {q.type === 'text' && (
                          <textarea
                            value={anamnesisAnswers[q.id] ?? ''}
                            onChange={(e) => setAnamnesisAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                            rows={2}
                            className="w-full rounded-md border bg-background px-2 py-1 text-xs resize-none"
                            placeholder="Escreva aqui…"
                          />
                        )}
                        {q.type === 'yesno' && (
                          <div className="flex gap-4">
                            {(['Sim', 'Não'] as const).map((opt) => (
                              <label key={opt} className="flex items-center gap-1.5 text-xs cursor-pointer">
                                <input
                                  type="radio"
                                  name={`anamnesis-${q.id}`}
                                  value={opt}
                                  checked={anamnesisAnswers[q.id] === opt}
                                  onChange={() => setAnamnesisAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                                />
                                {opt}
                              </label>
                            ))}
                          </div>
                        )}
                        {q.type === 'numeric' && (
                          <input
                            type="number"
                            value={anamnesisAnswers[q.id] ?? ''}
                            onChange={(e) => setAnamnesisAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                            className="w-32 rounded-md border bg-background px-2 py-1 text-xs"
                          />
                        )}
                        {q.type === 'date' && (
                          <input
                            type="date"
                            value={anamnesisAnswers[q.id] ?? ''}
                            onChange={(e) => setAnamnesisAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                            className="rounded-md border bg-background px-2 py-1 text-xs"
                          />
                        )}
                        {q.type === 'multiple' && (q.options ?? []).map((opt) => (
                          <label key={opt} className="flex items-center gap-1.5 text-xs cursor-pointer">
                            <input
                              type="checkbox"
                              checked={(anamnesisAnswers[q.id] ?? '').split(',').filter(Boolean).includes(opt)}
                              onChange={(e) => {
                                const current = (anamnesisAnswers[q.id] ?? '').split(',').filter(Boolean)
                                const updated = e.target.checked ? [...current, opt] : current.filter((v) => v !== opt)
                                setAnamnesisAnswers((prev) => ({ ...prev, [q.id]: updated.join(',') }))
                              }}
                            />
                            {opt}
                          </label>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Generic form for other types */}
              {entryType !== 'anamnesis' && (
                <div className="space-y-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Título</label>
                    <input
                      value={simpleRecord.title}
                      onChange={(e) => setSimpleRecord((prev) => ({ ...prev, title: e.target.value }))}
                      placeholder={
                        entryType === 'exam' ? 'Ex: Exame de sangue, Dermatoscopia…' :
                        entryType === 'procedure' ? 'Ex: Botox, Limpeza de pele…' :
                        entryType === 'prescription' ? 'Ex: Prescrição de ácido…' :
                        'Ex: Observação pós-atendimento…'
                      }
                      className="w-full rounded-md border bg-background px-2 py-1 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Conteúdo / Descrição</label>
                    <textarea
                      value={simpleRecord.content}
                      onChange={(e) => setSimpleRecord((prev) => ({ ...prev, content: e.target.value }))}
                      rows={3}
                      placeholder="Descreva o resultado, observações clínicas, dosagens…"
                      className="w-full rounded-md border bg-background px-2 py-1 text-xs resize-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Data de realização (opcional)</label>
                    <input
                      type="date"
                      value={simpleRecord.performedAt}
                      onChange={(e) => setSimpleRecord((prev) => ({ ...prev, performedAt: e.target.value }))}
                      className="w-full rounded-md border bg-background px-2 py-1 text-xs"
                    />
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => void submitEntry()}
                  disabled={entrySubmitting || (entryType !== 'anamnesis' && (!simpleRecord.title.trim() || !simpleRecord.content.trim()))}
                  className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
                >
                  {entrySubmitting ? 'Salvando…' : 'Salvar lançamento'}
                </button>
                <button
                  onClick={() => setShowEntryForm(false)}
                  className="rounded-md border px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* ── Edit record modal ── */}
          {editingRecord && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
              <p className="text-xs font-semibold text-primary">Editar lançamento</p>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Título</label>
                <input
                  value={editValues.title}
                  onChange={(e) => setEditValues((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full rounded-md border bg-background px-2 py-1 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Conteúdo</label>
                <textarea
                  value={editValues.content}
                  onChange={(e) => setEditValues((prev) => ({ ...prev, content: e.target.value }))}
                  rows={3}
                  className="w-full rounded-md border bg-background px-2 py-1 text-xs resize-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Data de realização</label>
                <input
                  type="date"
                  value={editValues.performedAt}
                  onChange={(e) => setEditValues((prev) => ({ ...prev, performedAt: e.target.value }))}
                  className="w-full rounded-md border bg-background px-2 py-1 text-xs"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => void submitEdit()}
                  disabled={editSubmitting}
                  className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
                >
                  {editSubmitting ? 'Salvando…' : 'Salvar alterações'}
                </button>
                <button
                  onClick={() => setEditingRecord(null)}
                  className="rounded-md border px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* ── Chronological history ── */}
          {clinicalRecords.isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : !clinicalRecords.data?.items.length ? (
            <p className="rounded-lg border bg-muted/10 px-3 py-4 text-center text-xs text-muted-foreground">
              Nenhum lançamento. Clique em "Novo lançamento" para iniciar.
            </p>
          ) : (
            <div className="space-y-2">
              {clinicalRecords.data.items.map((r) => {
                // For anamnesis, parse JSON entries; for others show content as text
                let anamnesisEntries: Array<{ question: string; answer: string }> = []
                if (r.type === 'anamnesis') {
                  try { anamnesisEntries = JSON.parse(r.content) } catch { anamnesisEntries = [] }
                }
                return (
                  <div key={r.id} className="rounded-lg border bg-muted/10 p-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-foreground">
                        {r.type === 'anamnesis' ? 'Anamnese' : r.title}
                      </p>
                      <div className="flex items-center gap-1">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${TYPE_COLOR[r.type] ?? 'bg-muted text-muted-foreground'}`}>
                          {TYPE_LABEL[r.type] ?? r.type}
                        </span>
                        {r.type !== 'anamnesis' && (
                          <button
                            onClick={() => openEditRecord(r)}
                            className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted/50 hover:text-foreground border"
                          >
                            Editar
                          </button>
                        )}
                      </div>
                    </div>

                    {r.type === 'anamnesis' ? (
                      <div className="space-y-1">
                        {anamnesisEntries.filter((e) => e.answer?.trim()).map((e, i) => (
                          <div key={i} className="flex gap-2 text-xs">
                            <span className="min-w-0 flex-1 text-muted-foreground">{e.question}:</span>
                            <span className="font-medium text-foreground text-right max-w-[55%]">{e.answer}</span>
                          </div>
                        ))}
                        {anamnesisEntries.filter((e) => e.answer?.trim()).length === 0 && (
                          <p className="text-xs text-muted-foreground italic">Sem respostas registradas.</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap">{r.content}</p>
                    )}

                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60 pt-0.5">
                      {r.performedAt && (
                        <span className="font-medium text-muted-foreground/80">
                          Realizado: {new Date(r.performedAt).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                      {r.performedAt && <span>·</span>}
                      <span>
                        {new Date(r.createdAt).toLocaleString('pt-BR', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                      {r.professional && <span>· {r.professional.name}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Contratos ─────────────────────────────────────────────────── */}
      {detailTab === 'contracts' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSignature className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contratos Digitais</p>
            </div>
          </div>

          {/* Contract type templates */}
          <div className="space-y-2">
            {[
              { name: 'Autorização de uso de imagem', desc: 'Permite o uso de fotos para fins clínicos' },
              { name: 'Termo de consentimento de tratamento', desc: 'Consentimento informado para procedimentos' },
              { name: 'Contrato de prestação de serviços', desc: 'Acordo de prestação de serviços estéticos' },
            ].map((tpl) => (
              <div key={tpl.name} className="flex items-center justify-between rounded-lg border bg-muted/10 px-3 py-2.5">
                <div>
                  <p className="text-xs font-medium text-foreground">{tpl.name}</p>
                  <p className="text-[10px] text-muted-foreground">{tpl.desc}</p>
                </div>
                <button className="rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/50">
                  Gerar link
                </button>
              </div>
            ))}
          </div>

          <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:border-blue-900/30 dark:bg-blue-950/10 dark:text-blue-300">
            💡 A geração e assinatura de contratos digitais estará disponível em breve.
            Os contratos serão enviados via WhatsApp com link único para assinatura online.
          </p>
        </div>
      )}

      <div className="flex justify-end gap-2 border-t pt-3">
        <Button variant="outline" size="sm" onClick={onEdit}>Editar</Button>
        <Button variant="ghost" size="sm" onClick={onClose}>Fechar</Button>
      </div>
    </div>
  )
}

// ──── Page ─────────────────────────────────────────────────────────────────────

export default function CustomersPage() {
  const [search, setSearch] = useState('')
  const { data, isLoading } = useCustomers(search ? { name: search } : undefined)
  const createCustomer = useCreateCustomer()
  const deleteCustomer = useDeleteCustomer()

  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [viewing, setViewing] = useState<Customer | null>(null)
  const [aiSummary, setAiSummary] = useState<Customer | null>(null)

  const updateCustomer = useUpdateCustomer(editing?.id ?? '')

  function formatDate(iso: string | null) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('pt-BR')
  }

  async function handleCreate(formData: CustomerFormData) {
    try {
      await createCustomer.mutateAsync(toApiPayload(formData) as unknown as Parameters<typeof createCustomer.mutateAsync>[0])
      toast.success('Cliente criado com sucesso')
      setCreating(false)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao criar cliente')
    }
  }

  async function handleUpdate(formData: CustomerFormData) {
    try {
      await updateCustomer.mutateAsync(toApiPayload(formData) as unknown as Parameters<typeof updateCustomer.mutateAsync>[0])
      toast.success('Cliente atualizado com sucesso')
      setEditing(null)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao atualizar cliente')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este cliente? Esta ação não pode ser desfeita.')) return
    try {
      await deleteCustomer.mutateAsync(id)
      toast.success('Cliente removido')
    } catch {
      toast.error('Erro ao remover cliente')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Clientes</h2>
          <p className="text-sm text-muted-foreground">Base de clientes da clínica</p>
        </div>
        <Button onClick={() => setCreating(true)}>+ Novo Cliente</Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por nome…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="py-3 pl-4 pr-2 text-left font-medium">Nome</th>
              <th className="px-2 py-3 text-left font-medium">E-mail</th>
              <th className="px-2 py-3 text-left font-medium">Telefone</th>
              <th className="px-2 py-3 text-left font-medium">CPF</th>
              <th className="px-2 py-3 text-left font-medium">Cidade</th>
              <th className="px-2 py-3 text-left font-medium">Cadastro</th>
              <th className="px-2 py-3 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">Carregando…</td></tr>
            )}
            {!isLoading && data?.items.length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">Nenhum cliente encontrado.</td></tr>
            )}
            {data?.items.map((c) => (
              <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                <td className="py-3 pl-4 pr-2 font-medium">
                  <button className="text-left hover:text-primary transition-colors" onClick={() => setViewing(c)}>
                    {c.name}
                  </button>
                </td>
                <td className="px-2 py-3 text-muted-foreground">{c.email ?? '—'}</td>
                <td className="px-2 py-3 text-muted-foreground">{c.phone ?? '—'}</td>
                <td className="px-2 py-3 text-muted-foreground">{c.document ?? '—'}</td>
                <td className="px-2 py-3 text-muted-foreground">{c.address?.city ?? '—'}</td>
                <td className="px-2 py-3 text-muted-foreground">{formatDate(c.createdAt)}</td>
                <td className="px-2 py-3">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" className="text-violet-600 hover:text-violet-700" onClick={() => setAiSummary(c)}>
                      <Bot className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setViewing(c)}>Ver ficha</Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditing(c)}>Editar</Button>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(c.id)}>Excluir</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create dialog */}
      {creating && (
        <Dialog open onClose={() => setCreating(false)}>
          <DialogTitle>Novo Cliente</DialogTitle>
          <div className="mt-4">
            <CustomerForm onSave={handleCreate} isPending={createCustomer.isPending} />
          </div>
        </Dialog>
      )}

      {/* Edit dialog */}
      {editing && (
        <Dialog open onClose={() => setEditing(null)}>
          <DialogTitle>Editar Cliente — {editing.name}</DialogTitle>
          <div className="mt-4">
            <CustomerForm
              defaultValues={fromCustomer(editing)}
              onSave={handleUpdate}
              isPending={updateCustomer.isPending}
            />
          </div>
        </Dialog>
      )}

      {/* Detail view */}
      {viewing && !editing && (
        <Dialog open onClose={() => setViewing(null)} className="max-w-2xl">
          <DialogTitle>Ficha do Cliente</DialogTitle>
          <div className="mt-4">
            <CustomerDetail
              customer={viewing}
              onEdit={() => { setEditing(viewing); setViewing(null) }}
              onClose={() => setViewing(null)}
            />
          </div>
        </Dialog>
      )}

      {/* AI Summary */}
      {aiSummary && <AiSummaryDialog customer={aiSummary} onClose={() => setAiSummary(null)} />}
    </div>
  )
}
