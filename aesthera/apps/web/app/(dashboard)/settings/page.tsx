'use client'

import { useState } from 'react'
import { ExternalLink, GripVertical, Loader2, X } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { type AnamnesisQuestion, type AnamnesisQuestionOption, DEFAULT_ANAMNESIS_QUESTIONS, useAnamnesisTemplate, useSaveAnamnesisTemplate } from '@/lib/hooks/use-settings'
import { BusinessHoursTab } from './_components/business-hours-tab'
import { ClinicTab } from './_components/clinic-tab'
import { UsersTab } from './_components/users-tab'

function AnamnesisConfigTab() {
  type QuestionType = AnamnesisQuestion['type']

  const { data: savedQuestions, isLoading } = useAnamnesisTemplate()
  const save = useSaveAnamnesisTemplate()

  const [questions, setQuestions] = useState<AnamnesisQuestion[] | null>(null)
  const [adding, setAdding] = useState(false)
  const [newQ, setNewQ] = useState<{
    text: string
    type: QuestionType
    required: boolean
    options: string[]
    selectOptions: AnamnesisQuestionOption[]
  }>({ text: '', type: 'text', required: false, options: [], selectOptions: [] })
  const [newOptionText, setNewOptionText] = useState('')
  const [newOptionWithDesc, setNewOptionWithDesc] = useState(false)
  const [saved, setSaved] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  // Initialize from server data when loaded
  const effectiveQuestions = questions ?? savedQuestions ?? DEFAULT_ANAMNESIS_QUESTIONS

  const TYPE_LABEL: Record<QuestionType, string> = {
    text: 'Texto livre',
    yesno: 'Sim / Não',
    multiple: 'Múltipla escolha',
    select: 'Escolha única',
    numeric: 'Numérico',
    date: 'Data',
  }

  function addOption() {
    if (!newOptionText.trim()) return
    if (newQ.type === 'multiple') {
      setNewQ((prev) => ({ ...prev, options: [...prev.options, newOptionText.trim()] }))
    } else if (newQ.type === 'select') {
      setNewQ((prev) => ({
        ...prev,
        selectOptions: [...prev.selectOptions, { label: newOptionText.trim(), withDescription: newOptionWithDesc }],
      }))
    }
    setNewOptionText('')
    setNewOptionWithDesc(false)
  }

  function removeOption(idx: number) {
    if (newQ.type === 'multiple') {
      setNewQ((prev) => ({ ...prev, options: prev.options.filter((_, i) => i !== idx) }))
    } else if (newQ.type === 'select') {
      setNewQ((prev) => ({ ...prev, selectOptions: prev.selectOptions.filter((_, i) => i !== idx) }))
    }
  }

  function addQuestion() {
    if (!newQ.text.trim()) return
    const q: AnamnesisQuestion = {
      id: Date.now().toString(),
      text: newQ.text,
      type: newQ.type,
      required: newQ.required,
      ...(newQ.type === 'multiple' && { options: newQ.options }),
      ...(newQ.type === 'select' && { selectOptions: newQ.selectOptions }),
    }
    setQuestions([...effectiveQuestions, q])
    setNewQ({ text: '', type: 'text', required: false, options: [], selectOptions: [] })
    setNewOptionText('')
    setNewOptionWithDesc(false)
    setAdding(false)
  }

  function removeQuestion(id: string) {
    setQuestions(effectiveQuestions.filter((q) => q.id !== id))
  }

  function toggleRequired(id: string) {
    setQuestions(effectiveQuestions.map((q) => q.id === id ? { ...q, required: !q.required } : q))
  }

  async function handleSave() {
    await save.mutateAsync(effectiveQuestions)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">Questionário de Anamnese</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Configure as perguntas exibidas ao cadastrar ou atualizar um cliente.
            </p>
          </div>
          <Button size="sm" onClick={() => void handleSave()} disabled={save.isPending}>
            {save.isPending ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />Salvando…</> : saved ? '✓ Salvo!' : 'Salvar'}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
        <div className="mt-4 space-y-2">
          {effectiveQuestions.map((q, i) => (
            <div
              key={q.id}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragEnd={() => setDragIndex(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex === null || dragIndex === i) return
                const reordered = [...effectiveQuestions]
                const [moved] = reordered.splice(dragIndex, 1)
                reordered.splice(i, 0, moved)
                setQuestions(reordered)
                setDragIndex(null)
              }}
              className={[
                'rounded-lg border bg-muted/20 px-3 py-2.5 transition-opacity',
                dragIndex === i ? 'opacity-40' : '',
              ].join(' ')}
            >
              <div className="flex items-center gap-3">
                <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground/50 active:cursor-grabbing" />
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                  {i + 1}
                </span>
                <span className="flex-1 text-sm text-foreground">{q.text}</span>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                  {TYPE_LABEL[q.type]}
                </span>
                <button
                  onClick={() => toggleRequired(q.id)}
                  className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${q.required ? 'bg-red-100 text-red-700' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                >
                  {q.required ? 'Obrigatório' : 'Opcional'}
                </button>
                <button
                  onClick={() => removeQuestion(q.id)}
                  className="text-xs text-muted-foreground hover:text-red-500 transition-colors"
                >
                  ✕
                </button>
              </div>
              {/* Show options summary for multiple / select */}
              {q.type === 'multiple' && (q.options ?? []).length > 0 && (
                <div className="mt-1.5 ml-14 flex flex-wrap gap-1">
                  {(q.options ?? []).map((opt) => (
                    <span key={opt} className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{opt}</span>
                  ))}
                </div>
              )}
              {q.type === 'select' && (q.selectOptions ?? []).length > 0 && (
                <div className="mt-1.5 ml-14 flex flex-wrap gap-1">
                  {(q.selectOptions ?? []).map((opt) => (
                    <span key={opt.label} className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      {opt.label}{opt.withDescription ? ' ✎' : ''}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        )}

        {!adding ? (
          <button
            onClick={() => setAdding(true)}
            className="mt-3 flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            + Adicionar pergunta
          </button>
        ) : (
          <div className="mt-3 space-y-3 rounded-lg border bg-muted/20 p-3">
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
                  onChange={(e) => setNewQ({ ...newQ, type: e.target.value as QuestionType, options: [], selectOptions: [] })}
                  className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                >
                  {Object.entries(TYPE_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end gap-2">
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newQ.required}
                    onChange={(e) => setNewQ({ ...newQ, required: e.target.checked })}
                    className="rounded"
                  />
                  Obrigatório
                </label>
              </div>
            </div>

            {/* Options editor for 'multiple' type */}
            {newQ.type === 'multiple' && (
              <div className="space-y-2">
                <Label className="text-xs">Alternativas</Label>
                {newQ.options.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {newQ.options.map((opt, idx) => (
                      <span key={idx} className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-foreground">
                        {opt}
                        <button type="button" onClick={() => removeOption(idx)} className="hover:text-red-500">
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
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOption() } }}
                    placeholder="Nova alternativa…"
                    className="text-sm flex-1"
                  />
                  <Button type="button" size="sm" variant="outline" onClick={addOption} disabled={!newOptionText.trim()}>
                    Adicionar
                  </Button>
                </div>
              </div>
            )}

            {/* Options editor for 'select' type */}
            {newQ.type === 'select' && (
              <div className="space-y-2">
                <Label className="text-xs">Alternativas</Label>
                <p className="text-xs text-muted-foreground">
                  Marque ✎ para que a alternativa exiba um campo de descrição ao ser selecionada.
                </p>
                {newQ.selectOptions.length > 0 && (
                  <div className="space-y-1">
                    {newQ.selectOptions.map((opt, idx) => (
                      <div key={idx} className="flex items-center gap-2 rounded bg-muted/50 px-2 py-1">
                        <span className="flex-1 text-xs">{opt.label}</span>
                        {opt.withDescription && (
                          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700">com descrição</span>
                        )}
                        <button type="button" onClick={() => removeOption(idx)} className="text-muted-foreground hover:text-red-500">
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
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOption() } }}
                    placeholder="Nova alternativa…"
                    className="text-sm flex-1"
                  />
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={newOptionWithDesc}
                      onChange={(e) => setNewOptionWithDesc(e.target.checked)}
                      className="rounded"
                    />
                    ✎ descrição
                  </label>
                  <Button type="button" size="sm" variant="outline" onClick={addOption} disabled={!newOptionText.trim()}>
                    Adicionar
                  </Button>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button size="sm" onClick={addQuestion} disabled={!newQ.text.trim()}>Adicionar</Button>
              <Button size="sm" variant="outline" onClick={() => { setAdding(false); setNewOptionText(''); setNewOptionWithDesc(false) }}>Cancelar</Button>
            </div>
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
    'Olá {nome}! 🎉\nA equipe da clínica deseja um feliz aniversário!\nComo presente, você ganhou {benefício}.\nEstamos aqui para te receber com muito carinho! 💜'
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
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">Automação de Aniversários</h3>
            <p className="mt-1 text-sm text-muted-foreground">
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
                className="rounded-lg border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground">
                O sistema enviará mensagens neste horário para todos os aniversariantes do dia.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Template da mensagem</Label>
              <p className="text-xs text-muted-foreground">
                Use <code className="rounded bg-muted px-1 py-0.5 font-mono">{'{nome}'}</code> para o nome do cliente e{' '}
                <code className="rounded bg-muted px-1 py-0.5 font-mono">{'{benefício}'}</code> para um benefício personalizado.
              </p>
              <textarea
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                rows={5}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Prévia para "Maria":
              </p>
              <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-900 whitespace-pre-wrap dark:bg-green-950/20 dark:text-green-300 dark:border-green-900/30">
                {template.replace('{nome}', 'Maria').replace('{benefício}', '10% de desconto no próximo tratamento')}
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
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h3 className="text-base font-semibold">Integração WhatsApp</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Para envios automáticos, configure uma integração com Z-API ou Evolution API.
          Defina a variável de ambiente <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs font-mono">ZAPI_TOKEN</code> no serviço de API.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Sem integração configurada, os envios funcionam como links de WhatsApp (abertura manual pelo celular).
        </p>
      </div>
    </div>
  )
}

function AiIntegrationsTab() {
  return (
    <div className="mt-6 space-y-6">
      {/* Gemini API Key */}
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h3 className="text-base font-semibold">Chave de API — Google Gemini (IA)</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Os recursos de IA (Briefing do dia, Resumo de clientes) usam o modelo Gemini do Google.
          Para ativá-los você precisa gerar uma chave gratuita e configurá-la na variável de ambiente
          <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs font-mono">GEMINI_API_KEY</code>
          do serviço de API.
        </p>

        <ol className="mt-4 space-y-3 text-sm text-foreground">
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              1
            </span>
            <span>
              Acesse{' '}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary underline underline-offset-2 hover:opacity-80"
              >
                Google AI Studio
                <ExternalLink className="h-3 w-3" />
              </a>{' '}
              e faça login com sua conta Google.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              2
            </span>
            <span>
              Clique em <strong>Create API Key</strong> e copie a chave gerada (começa com{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">AIza…</code>).
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              3
            </span>
            <span>
              No painel do Railway, abra o serviço <strong>api</strong> → aba{' '}
              <strong>Variables</strong> e adicione:
            </span>
          </li>
        </ol>

        <div className="mt-3 rounded-lg bg-muted px-4 py-3 font-mono text-xs">
          GEMINI_API_KEY=<span className="text-muted-foreground">AIzaSy…sua_chave_aqui</span>
        </div>

        <ol className="mt-3 space-y-3 text-sm text-foreground" start={4}>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              4
            </span>
            <span>
              Clique em <strong>Deploy</strong> para aplicar. Após o deploy, os recursos de IA
              estarão disponíveis automaticamente.
            </span>
          </li>
        </ol>

        <p className="mt-4 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground">
          💡 A API do Gemini tem uma cota gratuita generosa (1 500 req/dia no plano free). Não é
          necessário cadastrar cartão de crédito para começar.
        </p>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">Configurações</h2>

      <Tabs defaultValue="clinic">
        <TabsList>
          <TabsTrigger value="clinic">Clínica</TabsTrigger>
          <TabsTrigger value="hours">Horários</TabsTrigger>
          <TabsTrigger value="users">Usuários</TabsTrigger>
          <TabsTrigger value="ai">Integrações IA</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="anamnesis">Anamnese</TabsTrigger>
        </TabsList>

        <TabsContent value="clinic">
          <ClinicTab />
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
          <AnamnesisConfigTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
