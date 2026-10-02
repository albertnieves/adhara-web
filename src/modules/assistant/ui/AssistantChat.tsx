'use client';

import { useEffect, useRef, useState } from 'react';

type Message = { role: 'user' | 'assistant'; content: string };
type Event =
  | { t: 'tool'; label: string }
  | { t: 'text'; d: string }
  | { t: 'done' }
  | { t: 'error'; m: string };

const SUGGESTIONS = [
  '¿Qué está agotado o a punto de agotarse?',
  '¿Qué debería pedir esta semana?',
  '¿Qué se vendió más en los últimos 7 días?',
  '¿Qué perfumes publicados no tienen foto?',
];

/** Chat con el asistente de inventario (solo lectura, respuesta en streaming). */
export function AssistantChat({
  configured,
  endpoint = '/admin/asistente/consulta',
}: {
  configured: boolean;
  endpoint?: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'nearest' });
  }, [messages, status]);
  useEffect(() => () => controller.current?.abort(), []);

  async function ask(question: string) {
    const text = question.trim();
    if (!text || busy) return;
    const history: Message[] = [...messages, { role: 'user', content: text }];
    setMessages([...history, { role: 'assistant', content: '' }]);
    setDraft('');
    setError(null);
    setStatus('Pensando…');
    setBusy(true);
    controller.current = new AbortController();
    let answer = '';
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.slice(-20) }),
        signal: controller.current.signal,
      });
      if (!response.ok || !response.body)
        throw new Error(
          response.status === 403 || response.status === 404
            ? 'No tienes acceso al asistente.'
            : 'El asistente no está disponible ahora mismo.',
        );
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as Event;
          if (event.t === 'tool') setStatus(`${event.label}…`);
          else if (event.t === 'text') {
            answer += event.d;
            setStatus(null);
            setMessages([...history, { role: 'assistant', content: answer }]);
          } else if (event.t === 'error') setError(event.m);
        }
      }
    } catch (caught) {
      if ((caught as Error).name !== 'AbortError')
        setError(
          caught instanceof Error && caught.message
            ? caught.message
            : 'Se cortó la conexión con el asistente.',
        );
    } finally {
      // Sin respuesta, la pregunta vuelve al campo para reintentar.
      if (!answer) {
        setMessages(messages);
        setDraft(text);
      }
      setStatus(null);
      setBusy(false);
    }
  }

  if (!configured) {
    return (
      <div className="panel-card text-sm leading-relaxed">
        <p className="font-semibold">El asistente aún no está activado.</p>
        <p className="text-smoke mt-2">
          Hace falta la clave de la API de Claude (ANTHROPIC_API_KEY) en las
          variables del servidor. Mientras tanto, el informe diario funciona
          igual, sin resumen redactado.
        </p>
      </div>
    );
  }

  return (
    <div className="panel-card flex min-h-[28rem] flex-col !p-0">
      <div
        className="flex-1 space-y-5 overflow-y-auto px-5 py-5"
        aria-live="polite"
        aria-busy={busy}
      >
        {messages.length === 0 && (
          <div>
            <p className="text-smoke text-sm">
              Pregunta por el stock, las ventas en unidades, la reposición o lo
              pendiente del catálogo. El asistente solo consulta: los cambios
              los haces tú en el panel.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => ask(suggestion)}
                  className="border-line hover:border-ink min-h-10 border px-3 text-left text-sm transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((message, index) =>
          message.role === 'user' ? (
            <p
              key={index}
              className="bg-sand ml-auto max-w-[85%] px-4 py-3 text-sm"
            >
              {message.content}
            </p>
          ) : message.content ? (
            <div
              key={index}
              className="max-w-[95%] text-sm leading-relaxed whitespace-pre-line"
            >
              {message.content}
            </div>
          ) : null,
        )}
        {status && (
          <p className="text-smoke flex items-center gap-3 text-sm">
            <span
              aria-hidden="true"
              className="border-ink/40 size-4 animate-spin rounded-full border border-t-transparent"
            />
            {status}
          </p>
        )}
        {error && (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        )}
        <div ref={bottom} />
      </div>
      <form
        className="border-line flex items-end gap-2 border-t p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void ask(draft);
        }}
      >
        <label className="sr-only" htmlFor="pregunta-asistente">
          Pregunta al asistente
        </label>
        <textarea
          id="pregunta-asistente"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void ask(draft);
            }
          }}
          rows={2}
          maxLength={4000}
          placeholder="Escribe tu pregunta…"
          className="input min-h-11 flex-1 resize-none"
        />
        {busy ? (
          <button
            type="button"
            onClick={() => controller.current?.abort()}
            className="panel-btn"
          >
            Parar
          </button>
        ) : (
          <button
            type="submit"
            disabled={!draft.trim()}
            className="panel-btn panel-btn-primary disabled:opacity-40"
          >
            Preguntar
          </button>
        )}
      </form>
      {messages.length > 0 && !busy && (
        <button
          type="button"
          onClick={() => {
            setMessages([]);
            setError(null);
          }}
          className="text-smoke hover:text-ink min-h-10 self-start px-5 pb-3 text-xs tracking-[0.14em] uppercase"
        >
          Nueva conversación
        </button>
      )}
    </div>
  );
}
