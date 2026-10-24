import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { fetchMe, login as apiLogin, signup as apiSignup, type SignupInput, type User } from './api'

const TOKEN_KEY = 'cc_token'

interface AuthState {
  user: User | null
  token: string | null
  ready: boolean
  login: (email: string, password: string) => Promise<User>
  signup: (input: SignupInput) => Promise<User>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)

  // On page load, check that a saved token is still valid.
  useEffect(() => {
    if (!token) {
      setReady(true)
      return
    }
    fetchMe(token)
      .then((u) => {
        if (u) setUser(u)
        else {
          localStorage.removeItem(TOKEN_KEY)
          setToken(null)
        }
      })
      .catch(() => {
        /* keep the token; the backend may just be down */
      })
      .finally(() => setReady(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const save = useCallback((t: string, u: User) => {
    localStorage.setItem(TOKEN_KEY, t)
    setToken(t)
    setUser(u)
    return u
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await apiLogin(email, password)
      return save(res.token, res.user)
    },
    [save],
  )

  const signup = useCallback(
    async (input: SignupInput) => {
      const res = await apiSignup(input)
      return save(res.token, res.user)
    },
    [save],
  )

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, ready, login, signup, logout }}>{children}</AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
