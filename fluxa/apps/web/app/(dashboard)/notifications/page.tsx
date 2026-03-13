'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import { Bell } from 'lucide-react'

interface NotificationLog {
  id: string
  type: 'email' | 'webhook'
  event: string
  status: 'sent' | 'failed' | 'pending'
  recipient: string
  createdAt: string
}

const statusLabel: Record<NotificationLog['status'], string> = {
  sent: 'Enviado',
  failed: 'Falhou',
  pending: 'Pendente',
}

const statusColor: Record<NotificationLog['status'], string> = {
  sent: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  pending: 'bg-yellow-100 text-yellow-800',
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(date),
  )
}

export default function NotificationsPage() {
  const { data: logs = [], isLoading } = useQuery<NotificationLog[]>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data } = await api.get('/notifications')
      return data.data ?? data
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Notificações</h2>
        <p className="text-muted-foreground">Log de emails e webhooks enviados</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de envios</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-sm text-muted-foreground py-8">Carregando...</p>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium">Nenhuma notificação enviada</p>
              <p className="text-sm text-muted-foreground">
                Os logs aparecerão aqui conforme as notificações forem disparadas
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {logs.map((log) => (
                <div key={log.id} className="flex items-center justify-between py-3">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{log.event}</p>
                    <p className="text-xs text-muted-foreground">
                      {log.type === 'email' ? '📧' : '🔗'} {log.recipient} ·{' '}
                      {formatDate(log.createdAt)}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[log.status]}`}
                  >
                    {statusLabel[log.status]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
