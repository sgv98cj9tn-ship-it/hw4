import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'

const MIN_PASSWORD = 8

export default function Signup() {
  const { user, signup } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (user && !loading) return <Navigate to="/" replace />

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const mismatch = form.confirm.length > 0 && form.confirm !== form.password

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (form.password.length < MIN_PASSWORD) {
      setError(`Password needs at least ${MIN_PASSWORD} characters.`)
      return
    }
    if (form.password !== form.confirm) {
      setError('Passwords don’t match.')
      return
    }
    setLoading(true)
    try {
      await signup({
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        password: form.password,
      })
      navigate('/', { replace: true })
    } catch (err) {
      setError((err as Error).message)
      setLoading(false)
    }
  }

  return (
    <div className="container section auth">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1 className="page-title">Create account</h1>
        <p className="muted">Save your chats and get help finding the right fit.</p>

        <div className="field-row">
          <label className="field">
            <span>First name</span>
            <input type="text" autoComplete="given-name" required value={form.first_name} onChange={set('first_name')} />
          </label>
          <label className="field">
            <span>Last name</span>
            <input type="text" autoComplete="family-name" required value={form.last_name} onChange={set('last_name')} />
          </label>
        </div>
        <label className="field">
          <span>Email</span>
          <input type="email" autoComplete="email" required value={form.email} onChange={set('email')} />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD}
            required
            aria-describedby="pw-hint"
            value={form.password}
            onChange={set('password')}
          />
          <small id="pw-hint" className="field-hint">
            At least {MIN_PASSWORD} characters.
          </small>
        </label>
        <label className="field">
          <span>Confirm password</span>
          <input
            type="password"
            autoComplete="new-password"
            required
            aria-invalid={mismatch}
            aria-describedby={mismatch ? 'confirm-hint' : undefined}
            value={form.confirm}
            onChange={set('confirm')}
          />
          {mismatch && (
            <small id="confirm-hint" className="field-hint field-hint-error">
              Passwords don’t match.
            </small>
          )}
        </label>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
          {loading ? 'Creating account…' : 'Create account'}
        </button>

        <p className="muted small">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  )
}
