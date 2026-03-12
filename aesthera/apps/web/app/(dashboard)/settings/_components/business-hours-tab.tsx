'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useBusinessHours, useSetBusinessHours } from '@/lib/hooks/use-settings'

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

interface HourRow {
  dayOfWeek: number
  openTime: string
  closeTime: string
  isOpen: boolean
}

const DEFAULT_HOURS: HourRow[] = Array.from({ length: 7 }, (_, i) => ({
  dayOfWeek: i,
  openTime: '08:00',
  closeTime: '18:00',
  isOpen: i >= 1 && i <= 5, // Mon–Fri open by default
}))

export function BusinessHoursTab() {
  const { data: saved, isLoading } = useBusinessHours()
  const { mutateAsync: setHours, isPending } = useSetBusinessHours()
  const [rows, setRows] = useState<HourRow[]>(DEFAULT_HOURS)

  useEffect(() => {
    if (saved && saved.length > 0) {
      // Merge saved data into the 7-day grid
      setRows(
        DEFAULT_HOURS.map((def) => {
          const found = saved.find((s) => s.dayOfWeek === def.dayOfWeek)
          return found
            ? {
                dayOfWeek: found.dayOfWeek,
                openTime: found.openTime,
                closeTime: found.closeTime,
                isOpen: found.isOpen,
              }
            : def
        }),
      )
    }
  }, [saved])

  function updateRow(dayOfWeek: number, field: keyof HourRow, value: string | boolean) {
    setRows((prev) =>
      prev.map((r) => (r.dayOfWeek === dayOfWeek ? { ...r, [field]: value } : r)),
    )
  }

  async function handleSave() {
    try {
      await setHours(rows)
      toast.success('Horários salvos')
    } catch {
      toast.error('Erro ao salvar horários')
    }
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>

  return (
    <Card>
      <CardHeader>
        <CardTitle>Horários de funcionamento</CardTitle>
        <CardDescription>Define os horários disponíveis para agendamento</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-[80px_60px_1fr_16px_1fr] items-center gap-3 mb-2 text-xs text-muted-foreground font-medium">
          <span>Dia</span>
          <span>Aberto</span>
          <span>Abertura</span>
          <span />
          <span>Fechamento</span>
        </div>

        {rows.map((row) => (
          <div
            key={row.dayOfWeek}
            className="grid grid-cols-[80px_60px_1fr_16px_1fr] items-center gap-3"
          >
            <span className="text-sm font-medium">{DAY_LABELS[row.dayOfWeek]}</span>

            <input
              type="checkbox"
              checked={row.isOpen}
              onChange={(e) => updateRow(row.dayOfWeek, 'isOpen', e.target.checked)}
              className="h-4 w-4 accent-primary"
            />

            <Input
              type="time"
              value={row.openTime}
              disabled={!row.isOpen}
              onChange={(e) => updateRow(row.dayOfWeek, 'openTime', e.target.value)}
              className="disabled:opacity-40"
            />

            <span className="text-center text-muted-foreground text-xs">–</span>

            <Input
              type="time"
              value={row.closeTime}
              disabled={!row.isOpen}
              onChange={(e) => updateRow(row.dayOfWeek, 'closeTime', e.target.value)}
              className="disabled:opacity-40"
            />
          </div>
        ))}

        <Button onClick={handleSave} disabled={isPending} className="mt-4">
          {isPending ? 'Salvando...' : 'Salvar horários'}
        </Button>
      </CardContent>
    </Card>
  )
}
