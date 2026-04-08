'use client'

import { useRef, useState } from 'react'
import { Loader2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface SignatureCanvasProps {
  onConfirm: (base64: string) => void
  onCancel: () => void
  isPending?: boolean
  confirmLabel?: string
}

export function SignatureCanvas({
  onConfirm,
  onCancel,
  isPending = false,
  confirmLabel = 'Confirmar assinatura',
}: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const [isEmpty, setIsEmpty] = useState(true)

  function getPos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      }
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  function start(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    isDrawing.current = true
    const { x, y } = getPos(e)
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    if (!isDrawing.current) return
    const { x, y } = getPos(e)
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.lineTo(x, y)
    ctx.strokeStyle = '#111'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.stroke()
    setIsEmpty(false)
  }

  function stop(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    isDrawing.current = false
  }

  function clear() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setIsEmpty(true)
  }

  function confirm() {
    const canvas = canvasRef.current
    if (!canvas || isEmpty) return
    onConfirm(canvas.toDataURL('image/png'))
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border-2 border-dashed border-gray-200 bg-white overflow-hidden touch-none">
        <canvas
          ref={canvasRef}
          width={600}
          height={256}
          className="w-full h-48 cursor-crosshair"
          onMouseDown={start}
          onMouseMove={draw}
          onMouseUp={stop}
          onMouseLeave={stop}
          onTouchStart={start}
          onTouchMove={draw}
          onTouchEnd={stop}
        />
      </div>
      <p className="text-xs text-center text-muted-foreground">Desenhe sua assinatura acima</p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={clear}
          className="text-xs"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Limpar
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          className="text-xs"
        >
          Cancelar
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={confirm}
          disabled={isEmpty || isPending}
          className="ml-auto text-xs"
        >
          {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {confirmLabel}
        </Button>
      </div>
    </div>
  )
}
