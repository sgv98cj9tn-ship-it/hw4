import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { CUSTOM_CATEGORIES, submitCustomRequest, type CustomRequestConfirmation } from '../api'
import { useAuth } from '../auth'

const EMPTY = {
  first_name: '',
  last_name: '',
  email: '',
  garment_category: '',
  quantity: '',
  needed_by: '',
  customization: '',
}

/** Tomorrow as YYYY-MM-DD in the shopper's time zone: the earliest date they can pick. */
function tomorrow(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function CustomOrder() {
  const { user, token } = useAuth()
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirmation, setConfirmation] = useState<CustomRequestConfirmation | null>(null)

  // Logged in: fill in what we already know (they can still edit it).
  useEffect(() => {
    if (user) {
      setForm((f) => ({
        ...f,
        first_name: f.first_name || user.first_name,
        last_name: f.last_name || user.last_name,
        email: f.email || user.email,
      }))
    }
  }, [user])

  const set =
    (key: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const quantity = Number(form.quantity)
    if (!Number.isInteger(quantity) || quantity < 1) {
      setError('Quantity must be at least 1.')
      return
    }
    if (form.needed_by < tomorrow()) {
      setError('Choose a date after today.')
      return
    }
    setLoading(true)
    try {
      const result = await submitCustomRequest({ ...form, quantity }, token)
      setConfirmation(result)
      window.scrollTo(0, 0)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  if (confirmation) {
    const needed = new Date(`${confirmation.needed_by}T12:00:00`).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
    return (
      <div className="container section narrow">
        <div className="confirm-icon" aria-hidden="true">
          ✓
        </div>
        <p className="eyebrow">Request received</p>
        <h1 className="page-title">Thanks, {confirmation.first_name}!</h1>
        <p className="lead">
          Your custom order request number is <strong>{confirmation.request_number}</strong>.
        </p>
        <ul className="summary-items confirm-items">
          <li>
            <span className="muted">Clothing</span>
            <span>{confirmation.garment_category}</span>
          </li>
          <li>
            <span className="muted">Quantity</span>
            <span>{confirmation.quantity}</span>
          </li>
          <li>
            <span className="muted">Needed by</span>
            <span>{needed}</span>
          </li>
        </ul>
        <p className="muted">Keep your request number handy if you follow up with the store.</p>
        <div className="hero-actions">
          <Link to="/products" className="btn btn-primary">
            Keep shopping
          </Link>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setConfirmation(null)
              setForm({ ...EMPTY, first_name: form.first_name, last_name: form.last_name, email: form.email })
            }}
          >
            Submit another request
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="container section">
      <div className="custom-layout">
        <div className="custom-intro">
          <p className="eyebrow">Custom orders</p>
          <h1 className="page-title">Request a custom order</h1>
          <p className="lead">
            Our production space next door handles screen printing, embroidery and graphic design. Tell us what you
            have in mind for your team, club or department.
          </p>
          {user ? (
            <p className="muted small">We’ve filled in your name and email from your account.</p>
          ) : (
            <p className="muted small">
              <Link to="/login" state={{ from: '/custom-order' }}>
                Log in
              </Link>{' '}
              to fill in your name and email automatically.
            </p>
          )}
        </div>

        <form className="auth-card custom-form" onSubmit={handleSubmit}>
          <div className="field-row">
            <label className="field">
              <span>First name</span>
              <input autoComplete="given-name" required maxLength={50} value={form.first_name} onChange={set('first_name')} />
            </label>
            <label className="field">
              <span>Last name</span>
              <input autoComplete="family-name" required maxLength={50} value={form.last_name} onChange={set('last_name')} />
            </label>
          </div>
          <label className="field">
            <span>Email</span>
            <input type="email" autoComplete="email" required value={form.email} onChange={set('email')} />
          </label>

          <div className="field-row">
            <label className="field">
              <span>Clothing type</span>
              <select required value={form.garment_category} onChange={set('garment_category')}>
                <option value="" disabled>
                  Choose one…
                </option>
                {CUSTOM_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Quantity</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={10000}
                step={1}
                required
                value={form.quantity}
                onChange={set('quantity')}
              />
            </label>
          </div>

          <label className="field">
            <span>Date needed</span>
            <input type="date" required min={tomorrow()} value={form.needed_by} onChange={set('needed_by')} />
          </label>

          <label className="field">
            <span>How do you want it customized?</span>
            <textarea
              required
              minLength={5}
              maxLength={2000}
              rows={5}
              placeholder="Colors, logo or text, placement (e.g. left chest), screen print or embroidery…"
              value={form.customization}
              onChange={set('customization')}
            />
          </label>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Sending…' : 'Submit request'}
          </button>
        </form>
      </div>
    </div>
  )
}
