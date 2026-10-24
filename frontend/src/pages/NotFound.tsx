import { Link } from 'react-router-dom'
import HandsomeDan from '../components/HandsomeDan'

export default function NotFound() {
  return (
    <div className="container section narrow dan-page">
      <div className="dan-sniff">
        <HandsomeDan className="dan-sniff-art" title="Handsome Dan sniffing around for the missing page" />
        <span className="dan-question" aria-hidden="true">
          ?
        </span>
      </div>
      <p className="eyebrow">Error 404</p>
      <h1 className="page-title">Woof! Dan couldn’t sniff out this page.</h1>
      <p className="lead">
        He searched every corner of Broadway, but this page doesn’t exist. Let’s get you back to the good stuff.
      </p>
      <div className="hero-actions dan-actions">
        <Link to="/" className="btn btn-primary">
          Back to home
        </Link>
        <Link to="/products" className="btn btn-ghost">
          Browse products
        </Link>
      </div>
    </div>
  )
}
