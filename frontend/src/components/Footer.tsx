import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div>
          <div className="footer-brands">
            <span className="wordmark">
              <span className="wordmark-main">Campus Customs</span>
              <span className="wordmark-sub">Yale Bulldog Blue</span>
            </span>
            <span className="license-badge">
              <span className="license-seal" aria-hidden="true">
                Y
              </span>
              <span>
                <strong>Officially Licensed Yale Merchandise</strong>
                The real Campus Customs store’s badge. This demo site isn’t licensed.
              </span>
            </span>
          </div>
          <p className="muted">57 Broadway, New Haven, CT 06511</p>
          <p className="footer-credit">
            Campus Customs, Yale Bulldog Blue, and Yale names and marks belong to Campus Customs and Yale
            University. Used here for a class project (MGT 409), not an official site.
          </p>
        </div>
        <nav className="footer-links" aria-label="Footer">
          <Link to="/products">Shop</Link>
          <Link to="/custom-order">Custom orders</Link>
          <Link to="/about">About Us</Link>
          <Link to="/login">Log in</Link>
        </nav>
      </div>
    </footer>
  )
}
