'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Bot, Loader2, Package, Scissors, Search, User } from 'lucide-react'
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
  useCreateCustomer,
  useCustomerHistory,
  useCustomers,
  useDeleteCustomer,
  useUpdateCustomer,
} from '@/lib/hooks/use-resources'
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
              'flex-1 py-2 text-sm font-medium transition-colors',
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

          <div className="grid grid-cols-2 gap-3">
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

          <div className="grid grid-cols-2 gap-3">
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

          <div className="grid grid-cols-2 gap-3">
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

          <div className="grid grid-cols-2 gap-3">
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
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-2">
              <Label>Logradouro</Label>
              <Input {...register('addr_street')} placeholder="Rua das Flores" />
            </div>
            <div className="space-y-2">
              <Label>Número</Label>
              <Input {...register('addr_number')} placeholder="123" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Complemento</Label>
              <Input {...register('addr_complement')} placeholder="Apto 4B" />
            </div>
            <div className="space-y-2">
              <Label>Bairro</Label>
              <Input {...register('addr_neighborhood')} placeholder="Centro" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-2">
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

          <div className="grid grid-cols-2 gap-3">
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

type DetailTab = 'profile' | 'history'

function CustomerDetail({ customer, onEdit, onClose }: { customer: Customer; onEdit: () => void; onClose: () => void }) {
  const [detailTab, setDetailTab] = useState<DetailTab>('profile')
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
        {([['profile', 'Dados & Saúde'], ['history', 'Histórico']] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setDetailTab(id as DetailTab)}
            className={[
              'flex-1 py-2 text-sm font-medium transition-colors',
              detailTab === id ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-accent',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {detailTab === 'profile' && (
        <>
          <div className="space-y-1.5 rounded-lg border bg-muted/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Dados Básicos</p>
            <Row label="Telefone" value={customer.phone} />
            <Row label="Telefone 2" value={meta?.phone2 as string} />
            <Row label="CPF" value={customer.document} />
            <Row label="RG" value={meta?.rg as string} />
            <Row label="Gênero" value={meta?.gender as string} />
            <Row label="Nascimento" value={customer.birthDate ? new Date(customer.birthDate).toLocaleDateString('pt-BR') : null} />
            <Row label="Profissão" value={meta?.occupation as string} />
            <Row label="Como nos encontrou" value={meta?.howFound as string} />
            {customer.notes && <Row label="Observações" value={customer.notes} />}
          </div>

          {hasAddress && (
            <div className="space-y-1.5 rounded-lg border bg-muted/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Endereço</p>
              <Row label="Logradouro" value={[addr.street, addr.number].filter(Boolean).join(', ')} />
              <Row label="Complemento" value={addr.complement} />
              <Row label="Bairro" value={addr.neighborhood} />
              <Row label="Cidade/UF" value={[addr.city, addr.state].filter(Boolean).join(' - ')} />
              <Row label="CEP" value={addr.zip} />
            </div>
          )}

          {hasAna && (
            <div className="space-y-1.5 rounded-lg border bg-muted/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Saúde & Anamnese</p>
              <Row label="Tipo de pele" value={ana.skinType} />
              <Row label="Alergias" value={ana.allergies} />
              <Row label="Medicamentos" value={ana.medications} />
              <Row label="Condições" value={ana.conditions} />
              <Row label="Tratamentos anteriores" value={ana.previousTreatments} />
              <Row label="Tratamentos atuais" value={ana.currentTreatments} />
              <Row label="Observações clínicas" value={ana.observations} />
              {ana.consentSigned && (
                <p className="text-xs text-green-700 font-medium mt-1">✓ Termo de consentimento assinado</p>
              )}
            </div>
          )}
        </>
      )}

      {detailTab === 'history' && (
        <div className="space-y-4">
          {/* Services/appointments */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Scissors className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Serviços realizados</p>
            </div>
            {history.isLoading ? (
              <p className="text-xs text-muted-foreground py-2">Carregando…</p>
            ) : !history.data?.appointments.length ? (
              <p className="text-xs text-muted-foreground py-2">Nenhum serviço registrado.</p>
            ) : (
              <div className="space-y-1.5">
                {history.data.appointments.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2 text-xs">
                    <span className="text-muted-foreground min-w-[80px]">
                      {new Date(a.scheduledAt).toLocaleDateString('pt-BR')}
                    </span>
                    <span className="flex-1 font-medium">{a.service.name}</span>
                    <span className="text-muted-foreground">{a.professional.name}</span>
                    <span className={`rounded-full px-1.5 py-0.5 font-medium ${STATUS_COLOR[a.status] ?? 'bg-muted text-muted-foreground'}`}>
                      {STATUS_LABEL[a.status] ?? a.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Product sales */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Produtos comprados</p>
            </div>
            {history.isLoading ? (
              <p className="text-xs text-muted-foreground py-2">Carregando…</p>
            ) : !history.data?.sales.length ? (
              <p className="text-xs text-muted-foreground py-2">Nenhum produto comprado.</p>
            ) : (
              <div className="space-y-1.5">
                {history.data.sales.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2 text-xs">
                    <span className="text-muted-foreground min-w-[80px]">
                      {new Date(s.soldAt).toLocaleDateString('pt-BR')}
                    </span>
                    <span className="flex-1 font-medium">{s.product.name}</span>
                    <span className="text-muted-foreground">{s.quantity}x {s.product.unit}</span>
                    <span className="font-medium">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(s.totalPrice / 100)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
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
        <Dialog open onClose={() => setViewing(null)}>
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
