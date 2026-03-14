'use client'

import { ExternalLink } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BusinessHoursTab } from './_components/business-hours-tab'
import { ClinicTab } from './_components/clinic-tab'
import { UsersTab } from './_components/users-tab'

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
      </Tabs>
    </div>
  )
}
