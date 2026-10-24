import { Link } from 'react-router-dom'
import HandsomeDan from '../components/HandsomeDan'

const collections = [
  { id: 'colleges', title: 'Residential colleges', text: 'Gear for Berkeley, Davenport, Grace Hopper, Pierson, Saybrook and more.' },
  { id: 'sports', title: 'Yale sports', text: 'Hoodies, crewnecks and tees for the teams you cheer for.' },
  { id: 'schools', title: 'Graduate & professional schools', text: 'Pieces for SOM, Law, Medicine, Art, Music and other schools.' },
  { id: 'family', title: 'For the family', text: 'Yale Mom, Dad, Grandpa, Aunt and more, for everyone cheering you on.' },
]

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">57 Broadway · New Haven</p>
            <h1>
              Yale gear, made <span className="accent">right across the street</span> from campus.
            </h1>
            <p className="lead">
              Campus Customs is a family-run shop on Broadway selling officially licensed Yale apparel.
              We've been stocking Yale gear there since the 1970s.
            </p>
            <div className="hero-actions">
              <Link to="/products" className="btn btn-primary">
                Shop the catalogue
              </Link>
              <Link to="/about" className="btn btn-ghost">
                Our story
              </Link>
            </div>
          </div>
          <div className="hero-art">
            <div className="hero-halo" aria-hidden="true" />
            <HandsomeDan className="hero-dan" />
            <p className="hero-caption">Sir Handsome Dan, guardian of Broadway</p>
          </div>
        </div>
        <div className="ticker" aria-hidden="true">
          <div className="ticker-track">
            {Array.from({ length: 2 }).map((_, i) => (
              <span key={i}>
                Officially licensed Yale apparel ★ Screen printing & embroidery next door ★ Residential college gear ★
                Gifts for Yale families ★ 57 Broadway, New Haven ★{' '}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="container section">
        <h2 className="section-title">Shop by what you love</h2>
        <div className="feature-grid">
          {collections.map((c) => (
            <Link to={`/products?collection=${c.id}`} key={c.id} className="feature-card">
              <h3>{c.title}</h3>
              <p>{c.text}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="container section">
        <div className="callout">
          <div>
            <h2>Need something custom?</h2>
            <p>
              Our production space next door handles screen printing, embroidery and graphic design,
              so teams, clubs and departments can get their own Yale merchandise.
            </p>
          </div>
          <Link to="/custom-order" className="btn btn-primary">
            Request a custom order
          </Link>
        </div>
      </section>
    </>
  )
}
