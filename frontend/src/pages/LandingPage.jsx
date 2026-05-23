import { useNavigate } from 'react-router-dom'
import './LandingPage.css'

export function LandingPage({ user, onSignIn }) {
  const navigate = useNavigate()

  function goToApp() { navigate('/app') }
  function goToWaddleForMe() {
    if (!user) { onSignIn(); return }
    navigate('/waddle-for-me')
  }

  return (
    <div className="landing">

      {/* ── Navbar ── */}
      <header className="landing-nav">
        <div className="landing-nav__logo">
          <img src="/logo.jpg" alt="Waddle" className="landing-nav__logo-img" />
          <span className="landing-nav__logo-name">Waddle</span>
        </div>
        <div className="landing-nav__right">
          {user ? (
            <div className="landing-nav__user">
              {user.avatar && (
                <img src={user.avatar} alt={user.name} className="landing-nav__avatar" referrerPolicy="no-referrer" />
              )}
              <button className="landing-nav__btn landing-nav__btn--outline" onClick={goToApp}>
                Go to App
              </button>
            </div>
          ) : (
            <button className="landing-nav__btn landing-nav__btn--outline" onClick={onSignIn}>
              <GoogleIcon /> Sign in
            </button>
          )}
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="landing-hero">
        <div className="landing-hero__eyebrow">Procurement AI for SMEs</div>
        <h1 className="landing-hero__headline">
          Procurement,<br />
          <span className="landing-hero__accent">without the hassle.</span>
        </h1>
        <p className="landing-hero__sub">
          Find suppliers, compare prices, and negotiate the best deal —
          in minutes or while you sleep.
        </p>
        <div className="landing-hero__ctas">
          <button className="landing-btn landing-btn--primary" onClick={goToApp}>
            Start searching <ArrowIcon />
          </button>
          <button className="landing-btn landing-btn--ghost" onClick={goToWaddleForMe}>
            Let Waddle handle it
          </button>
        </div>
        <div className="landing-hero__markets">
          <span>🇲🇾 Malaysia</span>
          <span className="landing-hero__dot" />
          <span>🇸🇬 Singapore</span>
        </div>
      </section>

      {/* ── Two paths ── */}
      <section className="landing-paths">
        <div className="landing-paths__grid">

          {/* Self-serve */}
          <div className="landing-card">
            <div className="landing-card__icon landing-card__icon--blue">
              <SearchIcon />
            </div>
            <h2 className="landing-card__title">Search &amp; Compare</h2>
            <p className="landing-card__desc">
              Tell Waddle what you need. Get ranked supplier recommendations
              with prices and contacts — instantly.
            </p>
            <ul className="landing-card__features">
              <li><CheckIcon /> AI-powered supplier search</li>
              <li><CheckIcon /> Price &amp; contact comparison</li>
              <li><CheckIcon /> 4 ranked recommendations</li>
              <li><CheckIcon /> Export to Excel</li>
              <li><CheckIcon /> Follow-up Q&amp;A with Waddle</li>
            </ul>
            <button className="landing-btn landing-btn--primary landing-btn--full" onClick={goToApp}>
              Start searching <ArrowIcon />
            </button>
          </div>

          {/* Done-for-you */}
          <div className="landing-card landing-card--highlight">
            <div className="landing-card__badge">New</div>
            <div className="landing-card__icon landing-card__icon--teal">
              <BoltIcon />
            </div>
            <h2 className="landing-card__title">Waddle for Me</h2>
            <p className="landing-card__desc">
              Already know who to contact? Give us the supplier's number or email
              and walk away. We'll negotiate the best deal and report back.
            </p>
            <ul className="landing-card__features">
              <li><CheckIcon /> WhatsApp &amp; email negotiation</li>
              <li><CheckIcon /> Autonomous AI agent</li>
              <li><CheckIcon /> 6–8 hour turnaround</li>
              <li><CheckIcon /> Full negotiation report</li>
              <li><CheckIcon /> Zero effort required</li>
            </ul>
            <button className="landing-btn landing-btn--teal landing-btn--full" onClick={goToWaddleForMe}>
              Let Waddle handle it <ArrowIcon />
            </button>
            {!user && (
              <p className="landing-card__auth-note">Requires sign-in</p>
            )}
          </div>

        </div>
      </section>

      {/* ── How it works ── */}
      <section className="landing-how">
        <h2 className="landing-how__heading">How it works</h2>
        <div className="landing-how__grid">

          <div className="landing-how__col">
            <h3 className="landing-how__col-title">Search &amp; Compare</h3>
            <div className="landing-steps">
              <div className="landing-step">
                <span className="landing-step__num">1</span>
                <div>
                  <strong>Describe what you need</strong>
                  <p>Product, quantity, budget, and timeline — Waddle asks the right questions.</p>
                </div>
              </div>
              <div className="landing-step">
                <span className="landing-step__num">2</span>
                <div>
                  <strong>Waddle searches for you</strong>
                  <p>We scan curated supplier directories across Malaysia and Singapore.</p>
                </div>
              </div>
              <div className="landing-step">
                <span className="landing-step__num">3</span>
                <div>
                  <strong>Compare and decide</strong>
                  <p>Get 4 ranked suppliers with prices and contacts. Reach out with one click.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="landing-how__divider" />

          <div className="landing-how__col">
            <h3 className="landing-how__col-title">Waddle for Me</h3>
            <div className="landing-steps">
              <div className="landing-step">
                <span className="landing-step__num landing-step__num--teal">1</span>
                <div>
                  <strong>Enter the supplier's contact</strong>
                  <p>Phone number or email, plus what you want to procure and your target price.</p>
                </div>
              </div>
              <div className="landing-step">
                <span className="landing-step__num landing-step__num--teal">2</span>
                <div>
                  <strong>Connect WhatsApp or email</strong>
                  <p>Waddle uses your connected channel to reach the supplier on your behalf.</p>
                </div>
              </div>
              <div className="landing-step">
                <span className="landing-step__num landing-step__num--teal">3</span>
                <div>
                  <strong>Check back in 6–8 hours</strong>
                  <p>We negotiate, follow up, and deliver a full report on what was agreed.</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="landing-cta">
        <h2 className="landing-cta__heading">
          Stop wasting time on procurement.
        </h2>
        <p className="landing-cta__sub">
          Join SMEs in Malaysia and Singapore who let Waddle do the heavy lifting.
        </p>
        <div className="landing-cta__btns">
          {user ? (
            <button className="landing-btn landing-btn--primary landing-btn--lg" onClick={goToApp}>
              Go to App <ArrowIcon />
            </button>
          ) : (
            <button className="landing-btn landing-btn--primary landing-btn--lg" onClick={onSignIn}>
              <GoogleIcon /> Sign in with Google
            </button>
          )}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <span>© 2025 Fovea · Waddle</span>
        <span>Malaysia &amp; Singapore</span>
      </footer>

    </div>
  )
}

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 10h12M10 4l6 6-6 6" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  )
}

function BoltIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}
