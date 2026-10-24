import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, matchPath, useLocation, useNavigate } from 'react-router-dom'
import { fetchChatHistory, sendChatMessage, type ChatTurn, type User } from '../api'
import { useAuth } from '../auth'
import { useChatResults } from '../chatResults'
import HandsomeDan from './HandsomeDan'

interface Message {
  role: 'user' | 'assistant'
  content: string
  /** Number of products this reply put on the Products page. */
  shownOnPage?: number
}

const GUEST_HISTORY_LIMIT = 20 // recent turns a guest's browser sends for context

// Some saved replies use Markdown bold (**$68**). Show it as real bold text
// instead of literal asterisks; everything else stays plain text.
function MessageText({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/gs)
  return (
    <>
      {parts.map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part.replace(/\*\*/g, '')))}
    </>
  )
}

function greeting(user: User | null): Message {
  return {
    role: 'assistant',
    content: user
      ? `Woof, hi ${user.first_name}! I’m Handsome Dan. Come on in. Ask me about Yale gear, prices or the store.`
      : 'Woof, hi! I’m Handsome Dan, and this is my house. Ask me about Yale gear, prices or the store.',
  }
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const { user, token, ready } = useAuth()
  const location = useLocation()
  const [messages, setMessages] = useState<Message[]>(() => [greeting(null)])
  const [historyCount, setHistoryCount] = useState(0)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const chatResults = useChatResults()

  // Logged in: load the saved conversation. Logged out (or guest): start fresh,
  // which also clears the window when someone logs out.
  const userId = user?.id ?? null
  useEffect(() => {
    if (!ready) return
    setError(null)
    if (!user || !token) {
      setMessages([greeting(null)])
      setHistoryCount(0)
      return
    }
    let cancelled = false
    setMessages([greeting(user)])
    fetchChatHistory(token)
      .then((saved) => {
        if (cancelled) return
        setHistoryCount(saved.length)
        setMessages([greeting(user), ...saved.map((m) => ({ role: m.role, content: m.content }))])
      })
      .catch(() => !cancelled && setError('Couldn’t load your earlier chats.'))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, userId, token])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages, loading])

  useEffect(() => {
    if (open) inputRef.current?.focus()
    // Lets the page make room for the open panel on wide screens (see .chat-open in index.css).
    document.body.classList.toggle('chat-open', open)
  }, [open])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || loading) return
    // Recent turns for guests (logged-in history is loaded on the server). Skip the greeting.
    const history: ChatTurn[] = messages
      .slice(1)
      .slice(-GUEST_HISTORY_LIMIT)
      .map((m) => ({ role: m.role, content: m.content }))
    // Page context: which page the shopper is on, and the product if one is open.
    const productMatch = matchPath('/products/:productId', location.pathname)
    const page = { path: location.pathname, product_id: productMatch?.params.productId ?? null }

    setMessages((m) => [...m, { role: 'user', content: text }])
    setInput('')
    setError(null)
    setLoading(true)
    try {
      const { reply, products, show_on_page } = await sendChatMessage(text, { token, page, history })
      const onPage = show_on_page && products.length > 0
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: reply, shownOnPage: onPage ? products.length : undefined },
      ])
      if (onPage) {
        // Put the matches on the Products page; the chat stays open beside them.
        chatResults.show({ query: text, productIds: products.map((p) => p.product_id) })
        navigate('/products?chat=1')
        // On phones the chat covers the whole screen, so step aside to reveal the results.
        if (window.matchMedia('(max-width: 600px)').matches) setOpen(false)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="chat">
      {open && (
        <section className="chat-panel" aria-label="Chat with Handsome Dan">
          {/* Handsome Dan's doghouse: a pitched roof with a name sign, and Dan in the doorway */}
          <header className="doghouse">
            {/* Dan's real doghouse: a white Gothic box with navy Y finials on bone posts along the roof,
                Gothic pinnacles at the corners, and a navy "YALE" ramp up the side. */}
            <svg className="doghouse-roof castle-top" viewBox="0 0 380 60" preserveAspectRatio="none" aria-hidden="true">
              <g stroke="#c7cfdb" strokeWidth="1.5">
                {/* Roof edge */}
                <rect x="2" y="44" width="376" height="16" fill="#ffffff" />
                {/* Corner pinnacles */}
                <path d="M2 60 V30 l9 -12 l9 12 V60 Z M358 60 V30 l9 -12 l9 12 V60 Z" fill="#ffffff" />
              </g>
              {/* Y finials on white bone posts */}
              {[44, 82, 120, 158, 222, 260, 298, 336].map((x) => (
                <g key={x}>
                  <path d={`M${x} 44 V30 M${x - 5} 36 h10`} stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" />
                  <text x={x} y="28" textAnchor="middle" fontFamily="Playfair Display, serif" fontWeight="800" fontSize="17" fill="#00356b" stroke="#ffffff" strokeWidth="3.5" paintOrder="stroke">
                    Y
                  </text>
                </g>
              ))}
            </svg>
            <svg className="doghouse-ramp" viewBox="0 0 120 70" aria-hidden="true">
              <path d="M0 70 L120 0 V70 Z" fill="#00356b" stroke="#ffffff" strokeWidth="2" />
              <text x="78" y="62" textAnchor="middle" fontFamily="Playfair Display, serif" fontWeight="800" fontSize="20" fill="#ffffff" transform="rotate(-30 78 56)">
                YALE
              </text>
            </svg>
            <button type="button" className="chat-close" aria-label="Close chat" onClick={() => setOpen(false)}>
              ×
            </button>
            <div className="doghouse-front">
              <div className="doghouse-door">
                <HandsomeDan
                  variant="head"
                  className={`doghouse-dan ${loading ? 'is-thinking' : ''}`}
                  title={loading ? 'Handsome Dan is thinking' : 'Handsome Dan'}
                />
              </div>
              <div className="doghouse-text">
                <p className="chat-title">Handsome Dan</p>
                <p className="chat-sub">Yale’s bulldog · Campus Customs helper</p>
                {user && <p className="chat-sub">Signed in as {user.first_name} · chats are saved</p>}
              </div>
              {/* Crest above the arch, like the shield on the real doghouse */}
              <svg className="doghouse-crest" viewBox="0 0 40 48" aria-hidden="true">
                <path d="M2 2 H38 V26 Q38 42 20 46 Q2 42 2 26 Z" fill="#ffffff" stroke="#00356b" strokeWidth="2.5" />
                <path d="M2 2 H38 V12 H2 Z" fill="#00356b" />
                <path d="M14 7 h12" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M8 16 L32 40 M32 16 L8 40" stroke="#c8102e" strokeWidth="5" />
              </svg>
            </div>
            {/* Window band: pointed navy windows with white bones, round windows with paw prints */}
            <div className="doghouse-windows" aria-hidden="true">
              {Array.from({ length: 6 }).map((_, i) => (
                <span key={i} className={i % 2 ? 'win-round' : 'win-arch'}>
                  {i % 2 ? (
                    <svg viewBox="0 0 20 20">
                      <ellipse cx="10" cy="13" rx="5" ry="4" fill="#ffffff" />
                      <circle cx="4.5" cy="8" r="2" fill="#ffffff" />
                      <circle cx="8" cy="4.5" r="2" fill="#ffffff" />
                      <circle cx="12" cy="4.5" r="2" fill="#ffffff" />
                      <circle cx="15.5" cy="8" r="2" fill="#ffffff" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 10 24">
                      <path d="M5 4 V20" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
                      <path d="M3 4 a2 2 0 1 1 4 0 M3 20 a2 2 0 1 0 4 0" stroke="#ffffff" strokeWidth="2" fill="none" />
                    </svg>
                  )}
                </span>
              ))}
            </div>
          </header>

          <div className="chat-messages" ref={listRef} aria-live="polite">
            {messages.map((m, i) => (
              <div key={i} className="chat-msg-wrap">
                {historyCount > 0 && i === 1 && <p className="chat-divider">Earlier conversation</p>}
                {historyCount > 0 && i === historyCount + 1 && <p className="chat-divider">Now</p>}
                <div className={`chat-row chat-row-${m.role}`}>
                {m.role === 'assistant' && <HandsomeDan variant="head" className="chat-avatar" title="" />}
                <div className={`chat-msg chat-msg-${m.role}`}>
                <MessageText text={m.content} />
                {m.shownOnPage !== undefined && (
                  <Link to="/products?chat=1" className="chat-results-link">
                    {m.shownOnPage} {m.shownOnPage === 1 ? 'item' : 'items'} on the Products page →
                  </Link>
                )}
                </div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="chat-row chat-row-assistant">
                <HandsomeDan variant="head" className="chat-avatar is-thinking" title="" />
                <div className="chat-msg chat-msg-assistant chat-typing" aria-label="Handsome Dan is typing">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}
            {error && (
              <p className="chat-error" role="alert">
                {error}
              </p>
            )}
          </div>

          <form className="chat-form" onSubmit={handleSubmit}>
            <label htmlFor="chat-input" className="sr-only">
              Message
            </label>
            <input
              id="chat-input"
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message…"
              autoComplete="off"
            />
            <button type="submit" className="btn btn-primary btn-sm" disabled={!input.trim() || loading}>
              Send
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        className="chat-launcher"
        aria-expanded={open}
        aria-label={open ? 'Close chat' : 'Chat with Handsome Dan'}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? (
          <span aria-hidden="true">×</span>
        ) : (
          <>
            <HandsomeDan variant="head" className="launcher-dan" title="" />
            <span className="launcher-tip" aria-hidden="true">
              Ask Dan
            </span>
          </>
        )}
      </button>
    </div>
  )
}
