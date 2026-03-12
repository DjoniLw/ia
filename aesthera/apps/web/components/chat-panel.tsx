'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { MessageSquare, X, Send, Loader2, Bot, User } from 'lucide-react'
import { api } from '@/lib/api'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

function genId() {
  return Math.random().toString(36).slice(2)
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs ${
          isUser ? 'bg-primary text-primary-foreground' : 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
        }`}
      >
        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </div>
      <div
        className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'rounded-tr-sm bg-primary text-primary-foreground'
            : 'rounded-tl-sm bg-muted text-foreground'
        }`}
      >
        <p className="whitespace-pre-wrap">{msg.content}</p>
      </div>
    </div>
  )
}

export function ChatPanel() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Olá! Sou a Aes, sua assistente inteligente. Posso te ajudar com informações sobre agendamentos, clientes, cobranças e muito mais. Como posso ajudar?',
    },
  ])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [sessionId] = useState(() => genId())
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || streaming) return

    setInput('')
    setMessages((prev) => [
      ...prev,
      { id: genId(), role: 'user', content: text },
    ])

    const assistantId = genId()
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: 'assistant', content: '' },
    ])
    setStreaming(true)

    try {
      const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
      const token = typeof window !== 'undefined' ? localStorage.getItem('access-token') : null
      const slug = typeof window !== 'undefined' ? localStorage.getItem('clinic-slug') : null

      const res = await fetch(`${base}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(slug ? { 'X-Clinic-Slug': slug } : {}),
        },
        body: JSON.stringify({ message: text, sessionId }),
      })

      if (!res.ok || !res.body) {
        throw new Error('AI request failed')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (raw === '[DONE]') break

          try {
            const event = JSON.parse(raw) as { chunk?: string; error?: string }
            if (event.error) throw new Error(event.error)
            if (event.chunk) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: m.content + event.chunk } : m,
                ),
              )
            }
          } catch {
            // ignore parse errors mid-stream
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao conectar com a IA'
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: `⚠️ ${msg}. Verifique se a chave GEMINI_API_KEY está configurada.` }
            : m,
        ),
      )
    } finally {
      setStreaming(false)
    }
  }, [input, streaming, sessionId])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendMessage()
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all hover:scale-105 ${
          open ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground'
        }`}
        aria-label={open ? 'Fechar assistente' : 'Abrir assistente de IA'}
      >
        {open ? <X className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
      </button>

      {/* Panel */}
      <div
        className={`fixed bottom-24 right-6 z-50 flex w-96 max-w-[calc(100vw-24px)] flex-col rounded-2xl border bg-card shadow-2xl transition-all duration-200 ${
          open ? 'pointer-events-auto opacity-100 translate-y-0' : 'pointer-events-none opacity-0 translate-y-4'
        }`}
        style={{ height: '520px' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 rounded-t-2xl border-b bg-gradient-to-r from-violet-600 to-violet-700 px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
            <Bot className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Aes — Assistente IA</p>
            <p className="text-xs text-violet-200">Gemini 2.0 Flash</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="ml-auto rounded-lg p-1 text-white/70 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}
          {streaming && messages[messages.length - 1]?.content === '' && (
            <div className="flex gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40">
                <Bot className="h-3.5 w-3.5" />
              </div>
              <div className="rounded-2xl rounded-tl-sm bg-muted px-3.5 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t p-3">
          <div className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-primary">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pergunte algo sobre a clínica..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              disabled={streaming}
            />
            <button
              onClick={() => void sendMessage()}
              disabled={!input.trim() || streaming}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            >
              {streaming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </button>
          </div>
          <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
            Enter para enviar · Shift+Enter para nova linha
          </p>
        </div>
      </div>
    </>
  )
}
