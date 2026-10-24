import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

// Products the chat agent asked to show on the Products page. Kept in
// sessionStorage so they survive opening a product and coming back, or a refresh.

const STORAGE_KEY = 'cc_chat_results'

export interface ChatResults {
  /** The shopper's message that produced these results. */
  query: string
  /** product_ids in the order the agent returned them. */
  productIds: string[]
}

interface ChatResultsState {
  results: ChatResults | null
  show: (results: ChatResults) => void
  clear: () => void
}

const ChatResultsContext = createContext<ChatResultsState | null>(null)

function load(): ChatResults | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as ChatResults) : null
  } catch {
    return null
  }
}

export function ChatResultsProvider({ children }: { children: ReactNode }) {
  const [results, setResults] = useState<ChatResults | null>(load)

  const show = useCallback((r: ChatResults) => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(r))
    setResults(r)
  }, [])

  const clear = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY)
    setResults(null)
  }, [])

  return <ChatResultsContext.Provider value={{ results, show, clear }}>{children}</ChatResultsContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useChatResults() {
  const ctx = useContext(ChatResultsContext)
  if (!ctx) throw new Error('useChatResults must be used inside ChatResultsProvider')
  return ctx
}
