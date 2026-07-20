import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
  useInView,
  useReducedMotion,
} from 'motion/react'
import { ArrowRight, Search, Zap, Check, Plus, Mail, MessageCircle } from 'lucide-react'

/*
 * Landing page.
 *
 * Design thesis: aurora borealis over ice. Waddle's brand is arctic (iceberg
 * blue, the Dragonfly mark), so the drifting aurora reads as on-theme rather
 * than as a generic gradient-blob trend. Everything animated is transform or
 * opacity; nothing here can trigger layout.
 *
 * Motion is centrally gated on useReducedMotion() — see `useMotionPrefs`. When
 * a visitor opts out, variants collapse to plain opacity and the aurora holds a
 * static composed position, so the page still reads as designed.
 */

// ── Shared motion variants ──────────────────────────────────────────────────

const EASE = [0.22, 1, 0.36, 1]

function useMotionPrefs() {
  const reduced = useReducedMotion()

  // Collapsing y to 0 (rather than dropping the variant) keeps every consumer's
  // markup identical between the two modes.
  const rise = {
    hidden: { opacity: 0, y: reduced ? 0 : 24 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: reduced ? 0.2 : 0.7, ease: EASE },
    },
  }

  const stagger = (delayChildren = 0, staggerChildren = 0.08) => ({
    hidden: {},
    show: {
      transition: {
        delayChildren: reduced ? 0 : delayChildren,
        staggerChildren: reduced ? 0 : staggerChildren,
      },
    },
  })

  return { reduced, rise, stagger }
}

/** Fades + rises its children once, the first time they scroll into view. */
function Reveal({ children, className, delay = 0, as = 'div' }) {
  const { rise } = useMotionPrefs()
  const Tag = motion[as]

  return (
    <Tag
      className={className}
      variants={rise}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
      transition={{ delay }}
    >
      {children}
    </Tag>
  )
}

// ── Aurora background ───────────────────────────────────────────────────────

/*
 * Three blurred blobs on offset, non-harmonic durations so the loops never
 * visibly resync. Animation lives in tailwind.css (.aurora-blob) rather than in
 * Motion — CSS keyframes run off the main thread, which matters for something
 * that animates for the entire time the page is open.
 */
function Aurora() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <div
        className="aurora-blob aurora-blob--a"
        style={{
          top: '-18%',
          left: '-10%',
          width: '55vw',
          height: '55vw',
          background:
            'radial-gradient(circle, var(--aurora-1) 0%, transparent 68%)',
        }}
      />
      <div
        className="aurora-blob aurora-blob--b"
        style={{
          top: '-5%',
          right: '-15%',
          width: '50vw',
          height: '50vw',
          background:
            'radial-gradient(circle, var(--aurora-2) 0%, transparent 68%)',
        }}
      />
      <div
        className="aurora-blob aurora-blob--c"
        style={{
          top: '25%',
          left: '25%',
          width: '45vw',
          height: '45vw',
          background:
            'radial-gradient(circle, var(--aurora-3) 0%, transparent 70%)',
        }}
      />
      {/* Vignette: keeps hero text contrast safe wherever the blobs drift. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,var(--canvas)_100%)]" />
    </div>
  )
}

// ── Nav ─────────────────────────────────────────────────────────────────────

function Nav({ user, onSignIn, goToApp }) {
  const { scrollY } = useScroll()
  const { reduced } = useMotionPrefs()

  // Nav compresses over the first 120px of scroll.
  const padY = useTransform(scrollY, [0, 120], reduced ? [16, 16] : [18, 10])
  const blur = useTransform(scrollY, [0, 120], [0, 14])
  const backdropFilter = useTransform(blur, (v) => `blur(${v}px)`)
  const borderOpacity = useTransform(scrollY, [0, 120], [0, 0.1])
  const borderColor = useTransform(
    borderOpacity,
    (v) => `oklch(1 0 0 / ${v})`,
  )
  const bg = useTransform(
    useTransform(scrollY, [0, 120], [0, 0.72]),
    (v) => `oklch(0.145 0.035 264 / ${v})`,
  )

  return (
    <motion.header
      style={{
        paddingTop: padY,
        paddingBottom: padY,
        backdropFilter,
        backgroundColor: bg,
        borderBottomColor: borderColor,
      }}
      className="sticky top-0 z-50 flex items-center justify-between border-b border-b-transparent px-6 md:px-10"
    >
      <div className="flex items-center gap-2.5">
        <img
          src="/logo.jpg"
          alt="Waddle AI procurement tool"
          className="h-8 w-8 rounded-lg object-contain"
        />
        <span className="text-[1.05rem] font-bold tracking-tight text-foreground">
          Waddle
        </span>
      </div>

      <div className="flex items-center gap-3">
        {user ? (
          <>
            {user.avatar && (
              <img
                src={user.avatar}
                alt={user.name}
                referrerPolicy="no-referrer"
                className="h-8 w-8 rounded-full border border-border"
              />
            )}
            <GhostButton onClick={goToApp}>Go to App</GhostButton>
          </>
        ) : (
          <GhostButton onClick={onSignIn}>
            <GoogleIcon /> Sign in
          </GhostButton>
        )}
      </div>
    </motion.header>
  )
}

// ── Buttons ─────────────────────────────────────────────────────────────────

function PrimaryButton({ children, onClick, className = '', size = 'md' }) {
  const { reduced } = useMotionPrefs()

  return (
    <motion.button
      onClick={onClick}
      whileHover={reduced ? undefined : { scale: 1.03, y: -1 }}
      whileTap={reduced ? undefined : { scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 22 }}
      className={[
        'group relative inline-flex items-center justify-center gap-2 rounded-lg font-semibold',
        'bg-primary text-primary-foreground',
        'shadow-[0_0_0_0_oklch(0.86_0.05_230/0.4)] hover:shadow-[0_8px_30px_-6px_oklch(0.86_0.05_230/0.45)]',
        'transition-shadow duration-300',
        size === 'lg' ? 'px-7 py-3.5 text-[15px]' : 'px-5 py-2.5 text-[14px]',
        className,
      ].join(' ')}
    >
      {children}
    </motion.button>
  )
}

function GhostButton({ children, onClick, className = '' }) {
  const { reduced } = useMotionPrefs()

  return (
    <motion.button
      onClick={onClick}
      whileHover={reduced ? undefined : { scale: 1.03, y: -1 }}
      whileTap={reduced ? undefined : { scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 22 }}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-lg border border-border',
        'bg-[oklch(1_0_0/0.04)] px-5 py-2.5 text-[14px] font-medium text-foreground',
        'backdrop-blur-sm transition-colors hover:bg-[oklch(1_0_0/0.09)]',
        className,
      ].join(' ')}
    >
      {children}
    </motion.button>
  )
}

// ── Hero ────────────────────────────────────────────────────────────────────

function Hero({ goToApp, goToWaddleForMe }) {
  const { reduced, rise, stagger } = useMotionPrefs()

  // Word-level stagger on the headline. Split here rather than in markup so the
  // sentence stays one readable string in source.
  const line1 = 'Your AI procurement agent,'.split(' ')
  const line2 = 'working while you grow.'.split(' ')

  const word = {
    hidden: { opacity: 0, y: reduced ? 0 : '0.6em' },
    show: { opacity: 1, y: 0, transition: { duration: 0.65, ease: EASE } },
  }

  return (
    <section className="relative overflow-hidden px-6 pb-24 pt-20 md:pt-28">
      <Aurora />

      <motion.div
        className="relative mx-auto max-w-4xl text-center"
        variants={stagger(0.1, 0.06)}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={rise} className="mb-6 flex justify-center">
          <span className="rounded-full border border-border bg-[oklch(1_0_0/0.05)] px-4 py-1.5 text-[12px] font-medium text-muted-foreground backdrop-blur-sm">
            Agentic AI Procurement Platform for Malaysian and Singaporean SMEs
          </span>
        </motion.div>

        <h1 className="text-[2.6rem] font-bold leading-[1.08] tracking-[-0.03em] text-foreground md:text-[4rem]">
          <motion.span
            className="block"
            variants={stagger(0.15, 0.05)}
          >
            {line1.map((w, i) => (
              <motion.span key={i} variants={word} className="inline-block">
                {w}&nbsp;
              </motion.span>
            ))}
          </motion.span>
          <motion.span className="block" variants={stagger(0.3, 0.05)}>
            {line2.map((w, i) => (
              <motion.span
                key={i}
                variants={word}
                className="inline-block bg-gradient-to-r from-[var(--aurora-1)] via-primary to-[var(--aurora-2)] bg-clip-text text-transparent"
              >
                {w}&nbsp;
              </motion.span>
            ))}
          </motion.span>
        </h1>

        <motion.p
          variants={rise}
          className="mx-auto mt-7 max-w-xl text-[1.05rem] leading-relaxed text-muted-foreground"
        >
          Waddle's agentic AI autonomously contacts suppliers, negotiates prices,
          and closes deals via WhatsApp or email. Spend more time improving your
          business and leave procurement to us.
        </motion.p>

        <motion.div
          variants={rise}
          className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <PrimaryButton onClick={goToWaddleForMe} size="lg">
            Let Waddle negotiate
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </PrimaryButton>
          <GhostButton onClick={goToApp} className="px-7 py-3.5 text-[15px]">
            Search suppliers first
          </GhostButton>
        </motion.div>

        <motion.div
          variants={rise}
          className="mt-8 flex items-center justify-center gap-3 text-[13px] text-muted-foreground"
        >
          <span>🇲🇾 Malaysia</span>
          <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
          <span>🇸🇬 Singapore</span>
        </motion.div>
      </motion.div>
    </section>
  )
}

// ── Credibility ─────────────────────────────────────────────────────────────

/*
 * Real attribution only. No invented customer logos, testimonials, or volume
 * metrics — Fovea and Lua AI are the genuine credibility signals we have.
 */
function Credibility() {
  return (
    <section className="border-y border-border/60 px-6 py-8">
      <Reveal className="mx-auto flex max-w-4xl flex-col items-center gap-4 text-center sm:flex-row sm:justify-center sm:gap-10">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
          Built and backed by
        </span>
        <div className="flex items-center gap-8">
          <a
            href="https://www.fovea.space/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[15px] font-semibold text-foreground/80 transition-colors hover:text-foreground"
          >
            Fovea
          </a>
          <span className="h-4 w-px bg-border" />
          <a
            href="https://heylua.ai/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-[15px] font-semibold text-foreground/80 transition-colors hover:text-foreground"
          >
            Lua AI
            <span className="rounded border border-[var(--aurora-3)]/40 px-1.5 py-0.5 text-[10px] font-medium text-[var(--aurora-3)]">
              YC-backed
            </span>
          </a>
        </div>
      </Reveal>
    </section>
  )
}

// ── Live negotiation mock ───────────────────────────────────────────────────

const whatsappThread = [
  { from: 'agent', text: 'Hi! Enquiring about 500 units of industrial safety gloves. What is your best price per unit?' },
  { from: 'them', text: 'Hello! For 500 units we can do RM 12.50 each.' },
  { from: 'agent', text: 'Thanks. We have a quote at RM 10.80. Can you match it for a repeat order?' },
  { from: 'them', text: 'We can go to RM 11.00 including delivery.' },
  { from: 'agent', text: 'RM 10.90 with delivery and we confirm today.' },
  { from: 'them', text: 'Agreed. Sending the invoice now.' },
]

const emailThread = [
  { from: 'agent', text: 'Subject: RFQ — 500 units, industrial safety gloves\n\nCould you share pricing and lead time for a 500-unit order?' },
  { from: 'them', text: 'Re: RFQ\n\nSGD 4.10 per unit, 10 working days lead time.' },
  { from: 'agent', text: 'Re: RFQ\n\nIf we commit to quarterly volume, can you improve to SGD 3.70?' },
  { from: 'them', text: 'Re: RFQ\n\nSGD 3.75 on a quarterly commitment. Lead time down to 7 days.' },
]

/**
 * Replays a scripted thread once it scrolls into view. Purely illustrative —
 * these are not real transcripts, and the labelling below says so.
 */
function Thread({ channel, messages, accent }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })
  const reduced = useReducedMotion()
  const [visible, setVisible] = useState(0)

  useEffect(() => {
    if (!inView) return

    // Opted-out visitors get the finished thread immediately rather than a
    // sequence they did not ask to watch.
    if (reduced) {
      setVisible(messages.length)
      return
    }

    const timers = messages.map((_, i) =>
      setTimeout(() => setVisible(i + 1), 700 + i * 1100),
    )
    return () => timers.forEach(clearTimeout)
  }, [inView, reduced, messages.length])

  const Icon = channel === 'whatsapp' ? MessageCircle : Mail
  const done = visible >= messages.length

  return (
    <div
      ref={ref}
      className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface/80 backdrop-blur-sm"
    >
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
        <Icon className="h-4 w-4" style={{ color: accent }} />
        <span className="text-[13px] font-semibold text-foreground">
          {channel === 'whatsapp' ? 'WhatsApp' : 'Email'}
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: done ? 'var(--success)' : accent }}
          />
          {done ? 'Deal closed' : 'Negotiating'}
        </span>
      </div>

      <div className="flex min-h-[300px] flex-col gap-2.5 p-4">
        <AnimatePresence initial={false}>
          {messages.slice(0, visible).map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: reduced ? 0 : 10, scale: reduced ? 1 : 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.35, ease: EASE }}
              className={`max-w-[85%] whitespace-pre-line rounded-lg px-3 py-2 text-[12.5px] leading-relaxed ${
                m.from === 'agent'
                  ? 'self-end rounded-br-sm text-primary-foreground'
                  : 'self-start rounded-bl-sm bg-[oklch(1_0_0/0.07)] text-foreground'
              }`}
              style={
                m.from === 'agent' ? { background: accent } : undefined
              }
            >
              {m.text}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator, shown only while more messages are still queued. */}
        {inView && !reduced && !done && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-1 self-start rounded-lg bg-[oklch(1_0_0/0.07)] px-3 py-2.5"
          >
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-muted-foreground"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.18 }}
              />
            ))}
          </motion.div>
        )}
      </div>
    </div>
  )
}

function NegotiationDemo() {
  return (
    <section className="relative px-6 py-24">
      <div className="mx-auto max-w-4xl">
        <Reveal className="mb-3 text-center">
          <h2 className="text-[2rem] font-bold tracking-[-0.02em] text-foreground md:text-[2.4rem]">
            Watch it negotiate
          </h2>
        </Reveal>
        <Reveal delay={0.08} className="mb-12 text-center">
          <p className="mx-auto max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            Waddle works in whichever channel your supplier already uses. Same
            agent, same persistence, no chasing from you.
          </p>
        </Reveal>

        <Reveal delay={0.14}>
          <div className="grid gap-5 md:grid-cols-2">
            <Thread
              channel="whatsapp"
              messages={whatsappThread}
              accent="var(--aurora-3)"
            />
            <Thread
              channel="email"
              messages={emailThread}
              accent="var(--aurora-2)"
            />
          </div>
          <p className="mt-5 text-center text-[11.5px] text-muted-foreground/60">
            Illustrative example. Not a real transcript — figures and suppliers
            shown are for demonstration only.
          </p>
        </Reveal>
      </div>
    </section>
  )
}

// ── Two paths ───────────────────────────────────────────────────────────────

/**
 * Card with a cursor-tracked spotlight on its border. Pointer position is
 * written to CSS custom properties so the highlight repaints without React
 * re-rendering on every mousemove.
 */
function PathCard({ highlight, badge, icon: Icon, iconTint, title, desc, features, cta, onCta, note }) {
  const ref = useRef(null)
  const { reduced } = useMotionPrefs()

  function handleMouseMove(e) {
    if (!ref.current) return
    const r = ref.current.getBoundingClientRect()
    ref.current.style.setProperty('--spot-x', `${e.clientX - r.left}px`)
    ref.current.style.setProperty('--spot-y', `${e.clientY - r.top}px`)
  }

  const { rise, stagger } = useMotionPrefs()

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      whileHover={reduced ? undefined : { y: -6 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      variants={rise}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border p-7 backdrop-blur-sm ${
        highlight
          ? 'border-primary/30 bg-surface/90'
          : 'border-border bg-surface/60'
      }`}
    >
      {/* Spotlight follows the cursor; fades in on hover only. */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            'radial-gradient(400px circle at var(--spot-x, 50%) var(--spot-y, 50%), oklch(1 0 0 / 0.06), transparent 70%)',
        }}
        aria-hidden="true"
      />

      {badge && (
        <span className="absolute right-5 top-5 rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
          {badge}
        </span>
      )}

      <div
        className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl"
        style={{ background: `color-mix(in oklch, ${iconTint} 16%, transparent)`, color: iconTint }}
      >
        <Icon className="h-5 w-5" />
      </div>

      <h2 className="mb-3 text-[1.4rem] font-bold tracking-[-0.02em] text-foreground">
        {title}
      </h2>
      <p className="mb-6 text-[14px] leading-relaxed text-muted-foreground">
        {desc}
      </p>

      <motion.ul
        className="mb-7 flex flex-col gap-2.5"
        variants={stagger(0.1, 0.06)}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-60px' }}
      >
        {features.map((f) => (
          <motion.li
            key={f}
            variants={rise}
            className="flex items-start gap-2.5 text-[13.5px] text-foreground/85"
          >
            <Check
              className="mt-0.5 h-3.5 w-3.5 shrink-0"
              style={{ color: iconTint }}
              strokeWidth={3}
            />
            {f}
          </motion.li>
        ))}
      </motion.ul>

      <div className="mt-auto">
        <PrimaryButton onClick={onCta} className="w-full">
          {cta}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </PrimaryButton>
        {note && (
          <p className="mt-3 text-center text-[11.5px] text-muted-foreground/70">
            {note}
          </p>
        )}
      </div>
    </motion.div>
  )
}

function Paths({ user, goToApp, goToWaddleForMe }) {
  const { stagger } = useMotionPrefs()

  return (
    <section className="px-6 py-24" aria-label="How to use Waddle">
      <motion.div
        className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2"
        variants={stagger(0, 0.12)}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-80px' }}
      >
        <PathCard
          icon={Search}
          iconTint="var(--aurora-1)"
          title="Search and Compare"
          desc="Not sure who to contact yet? Tell Waddle what you need and get ranked supplier recommendations with prices and contacts in minutes. Then hand it off to Waddle for Me to negotiate for you."
          features={[
            'AI-powered supplier search',
            'Price and contact comparison',
            '4 ranked recommendations',
            'Export to Excel',
            'Follow-up Q&A with Waddle',
          ]}
          cta="Search suppliers"
          onCta={goToApp}
          note={!user ? 'Requires sign-in' : undefined}
        />
        <PathCard
          highlight
          badge="New"
          icon={Zap}
          iconTint="var(--aurora-3)"
          title="Waddle for Me"
          desc="Our agentic AI autonomously contacts your supplier via WhatsApp or email, negotiates the best price on your behalf, and delivers a full report. You focus on your business. We handle procurement."
          features={[
            'Agentic AI negotiates autonomously',
            'Works via WhatsApp or email',
            'Tailored to your communication channel',
            '6 to 8 hour turnaround',
            'Full negotiation report delivered',
          ]}
          cta="Let Waddle handle it"
          onCta={goToWaddleForMe}
          note={!user ? 'Requires sign-in' : undefined}
        />
      </motion.div>
    </section>
  )
}

// ── How it works ────────────────────────────────────────────────────────────

const timeline = [
  {
    track: 'Search and Compare',
    tint: 'var(--aurora-1)',
    steps: [
      ['Describe what you need', 'Product, quantity, budget, and timeline. Waddle asks the right questions.'],
      ['Waddle searches for you', 'We scan curated supplier directories across Malaysia and Singapore.'],
      ['Compare and decide', 'Get 4 ranked suppliers with prices and contacts. Reach out with one click.'],
    ],
  },
  {
    track: 'Waddle for Me',
    tint: 'var(--aurora-3)',
    steps: [
      ["Give us the supplier's contact", 'WhatsApp number or email, what you need, and your target price. That is all we need.'],
      ['Our agentic AI takes over', 'Waddle autonomously reaches out via your chosen channel, negotiates pricing, and handles all follow-ups.'],
      ['Get your report. Get back to work.', 'Within 6 to 8 hours, receive a full negotiation report with what was agreed. Zero effort from you.'],
    ],
  },
]

function HowItWorks() {
  const ref = useRef(null)
  const { reduced } = useMotionPrefs()

  // The vertical rail fills as the section passes through the viewport.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 75%', 'end 60%'],
  })
  const scaleY = useTransform(scrollYProgress, [0, 1], [0, 1])

  return (
    <section ref={ref} className="px-6 py-24" aria-label="How Waddle works">
      <div className="mx-auto max-w-4xl">
        <Reveal className="mb-14 text-center">
          <h2 className="text-[2rem] font-bold tracking-[-0.02em] text-foreground md:text-[2.4rem]">
            How it works
          </h2>
        </Reveal>

        <div className="flex flex-col gap-16">
          {timeline.map(({ track, tint, steps }) => (
            <div key={track}>
              <Reveal className="mb-7">
                <h3
                  className="text-[13px] font-bold uppercase tracking-[0.14em]"
                  style={{ color: tint }}
                >
                  {track}
                </h3>
              </Reveal>

              <div className="relative pl-12">
                {/* Rail track + scroll-driven fill. */}
                <div className="absolute bottom-2 left-[15px] top-2 w-px bg-border" />
                <motion.div
                  className="absolute bottom-2 left-[15px] top-2 w-px origin-top"
                  style={{
                    background: tint,
                    scaleY: reduced ? 1 : scaleY,
                  }}
                  aria-hidden="true"
                />

                <div className="flex flex-col gap-9">
                  {steps.map(([heading, body], i) => (
                    <Reveal key={heading} delay={i * 0.06}>
                      <div className="relative">
                        <span
                          className="absolute -left-12 flex h-8 w-8 items-center justify-center rounded-full border text-[12px] font-bold"
                          style={{
                            borderColor: tint,
                            color: tint,
                            background: 'var(--canvas)',
                          }}
                        >
                          {i + 1}
                        </span>
                        <strong className="block text-[15px] font-semibold text-foreground">
                          {heading}
                        </strong>
                        <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
                          {body}
                        </p>
                      </div>
                    </Reveal>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── FAQ ─────────────────────────────────────────────────────────────────────

/*
 * Single source of truth: this array renders the accordion AND generates the
 * FAQPage JSON-LD below, so the two can never drift apart. Answers are
 * unchanged from the previous design — they carry the page's search keywords.
 */
const faqs = [
  {
    q: 'What is Waddle?',
    a: 'Waddle is an agentic AI procurement platform built for SMEs in Malaysia and Singapore. It autonomously contacts suppliers, negotiates prices, and closes deals via WhatsApp or email on your behalf, so you can spend more time growing your business and less time chasing quotes.',
  },
  {
    q: 'How does Waddle find suppliers?',
    a: 'Waddle uses AI to search curated supplier directories across Malaysia and Singapore. Describe what you need and it returns up to 4 ranked supplier recommendations with prices and contact details within minutes.',
  },
  {
    q: 'What is the Waddle for Me service?',
    a: "Waddle for Me uses agentic AI to autonomously contact and negotiate prices with suppliers on behalf of SMEs. You provide the supplier's WhatsApp number or email, your procurement requirements, and your target price. Waddle's AI agent reaches out through your preferred channel, conducts the full negotiation autonomously, and delivers a detailed report within 6 to 8 hours. This lets you spend more time improving your business while we handle procurement.",
  },
  {
    q: 'Who built Waddle?',
    a: 'Waddle is built by Fovea, a company focused on AI tools for Southeast Asian SMEs. The AI is powered by Lua AI, a Y Combinator-backed company.',
    // Links live separately so the JSON-LD answer stays plain text.
    links: [
      { label: 'Fovea', href: 'https://www.fovea.space/' },
      { label: 'Lua AI', href: 'https://heylua.ai/' },
    ],
  },
  {
    q: 'Which countries does Waddle support?',
    a: 'Waddle currently serves SMEs in Malaysia and Singapore, with supplier directories covering both markets.',
  },
]

function FaqItem({ faq, isOpen, onToggle }) {
  return (
    <div className="border-b border-border">
      <button
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-4 py-5 text-left"
      >
        <span className="text-[15px] font-semibold text-foreground">
          {faq.q}
        </span>
        <motion.span
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ duration: 0.25, ease: EASE }}
          className="shrink-0 text-muted-foreground"
        >
          <Plus className="h-4 w-4" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="overflow-hidden"
          >
            <p className="pb-5 pr-8 text-[14px] leading-relaxed text-muted-foreground">
              {faq.links ? (
                <>
                  Waddle is built by{' '}
                  <a href={faq.links[0].href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
                    Fovea
                  </a>
                  , a company focused on AI tools for Southeast Asian SMEs. The AI
                  is powered by{' '}
                  <a href={faq.links[1].href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
                    Lua AI
                  </a>
                  , a Y Combinator-backed company.
                </>
              ) : (
                faq.a
              )}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Faq() {
  const [open, setOpen] = useState(0)

  return (
    <section
      className="px-6 py-24"
      aria-label="Frequently asked questions about Waddle"
    >
      <div className="mx-auto max-w-2xl">
        <Reveal className="mb-10 text-center">
          <h2 className="text-[2rem] font-bold tracking-[-0.02em] text-foreground md:text-[2.4rem]">
            Frequently asked questions
          </h2>
        </Reveal>

        <Reveal delay={0.08}>
          {faqs.map((faq, i) => (
            <FaqItem
              key={faq.q}
              faq={faq}
              isOpen={open === i}
              onToggle={() => setOpen(open === i ? -1 : i)}
            />
          ))}
        </Reveal>
      </div>
    </section>
  )
}

// ── Final CTA ───────────────────────────────────────────────────────────────

function FinalCta({ user, onSignIn, goToApp }) {
  return (
    <section
      className="relative overflow-hidden px-6 py-28"
      aria-label="Get started with Waddle"
    >
      <Aurora />

      <div className="relative mx-auto max-w-2xl text-center">
        <Reveal as="h2" className="text-[2.1rem] font-bold leading-tight tracking-[-0.02em] text-foreground md:text-[2.8rem]">
          Focus on your business.
          <br />
          Leave procurement to us.
        </Reveal>
        <Reveal delay={0.1} className="mx-auto mt-5 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
          Join SMEs in Malaysia and Singapore using agentic AI to negotiate
          better deals, faster, via WhatsApp and email.
        </Reveal>
        <Reveal delay={0.18} className="mt-9 flex justify-center">
          {user ? (
            <PrimaryButton onClick={goToApp} size="lg">
              Go to App <ArrowRight className="h-4 w-4" />
            </PrimaryButton>
          ) : (
            <PrimaryButton onClick={onSignIn} size="lg">
              <GoogleIcon /> Sign in with Google
            </PrimaryButton>
          )}
        </Reveal>
      </div>
    </section>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────

export function LandingPage({ user, onSignIn }) {
  const navigate = useNavigate()

  // Both product paths are gated: signed-out visitors get bounced to Google
  // auth and land on the route afterwards.
  function goToApp() {
    if (!user) {
      onSignIn()
      return
    }
    navigate('/rfqs')
  }

  function goToWaddleForMe() {
    if (!user) {
      onSignIn()
      return
    }
    navigate('/waddle-for-me')
  }

  return (
    <div className="min-h-screen bg-canvas font-sans text-foreground antialiased">
      {/* Rich-results eligibility for the FAQ block, generated from `faqs`. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqs.map(({ q, a }) => ({
              '@type': 'Question',
              name: q,
              acceptedAnswer: { '@type': 'Answer', text: a },
            })),
          }),
        }}
      />

      <Nav user={user} onSignIn={onSignIn} goToApp={goToApp} />
      <Hero goToApp={goToApp} goToWaddleForMe={goToWaddleForMe} />
      <Credibility />
      <NegotiationDemo />
      <Paths user={user} goToApp={goToApp} goToWaddleForMe={goToWaddleForMe} />
      <HowItWorks />
      <Faq />
      <FinalCta user={user} onSignIn={onSignIn} goToApp={goToApp} />

      <footer className="flex flex-col items-center justify-between gap-3 border-t border-border px-6 py-8 text-[13px] text-muted-foreground sm:flex-row md:px-10">
        <span>
          Built by{' '}
          <a href="https://www.fovea.space/" target="_blank" rel="noopener noreferrer" className="text-foreground/80 hover:text-foreground">
            Fovea
          </a>{' '}
          &middot; Powered by{' '}
          <a href="https://heylua.ai/" target="_blank" rel="noopener noreferrer" className="text-foreground/80 hover:text-foreground">
            Lua AI
          </a>{' '}
          (YC-backed)
        </span>
        <span>Malaysia &amp; Singapore</span>
      </footer>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}
