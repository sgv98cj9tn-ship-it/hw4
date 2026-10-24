import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { useCart } from '../cart'

const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/products', label: 'Products' },
  { to: '/about', label: 'About Us' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const { user, logout } = useAuth()
  const { count } = useCart()
  const navigate = useNavigate()
  const close = () => setOpen(false)

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="brand" onClick={close} aria-label="Campus Customs, Yale Bulldog Blue, home">
          <span className="brand-mark" aria-hidden="true">CC</span>
          <span className="wordmark" aria-hidden="true">
            <span className="wordmark-main">Campus Customs</span>
            <span className="wordmark-sub">Yale Bulldog Blue</span>
          </span>
        </Link>

        <Link to="/cart" className="cart-link" aria-label={`Cart, ${count} ${count === 1 ? 'item' : 'items'}`} onClick={close}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path
              fill="currentColor"
              d="M7 18a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm10 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM5.2 4l.4 2H21l-2 8H7.3l-.3-1.5L5 4H2V2h4.6l.6 2H5.2Z"
            />
          </svg>
          {count > 0 && <span className="cart-count">{count > 99 ? '99+' : count}</span>}
        </Link>

        <button
          type="button"
          className="nav-toggle"
          aria-expanded={open}
          aria-controls="primary-nav"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((o) => !o)}
        >
          <span />
          <span />
          <span />
        </button>

        <nav id="primary-nav" className={`nav-links ${open ? 'is-open' : ''}`} aria-label="Main">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} onClick={close}>
              {l.label}
            </NavLink>
          ))}
          <div className="nav-auth">
            {user ? (
              <>
                <span className="nav-user">Hi, {user.first_name}</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    logout()
                    close()
                    navigate('/')
                  }}
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login" onClick={close}>
                  Log in
                </NavLink>
                <NavLink to="/signup" className="btn btn-primary btn-sm" onClick={close}>
                  Create account
                </NavLink>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  )
}
