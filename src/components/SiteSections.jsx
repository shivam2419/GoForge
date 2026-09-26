import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight, ArrowUpRight, BarChart3, Check, Code2, LayoutDashboard, LifeBuoy,
  Mail, MapPin, Menu, MessageCircle, MessagesSquare, Phone, Search, Send, Share2,
  SlidersHorizontal, Sparkles,
  Target, WalletCards, Workflow, X, Zap,
} from 'lucide-react'
import {
  agency, benefits, capabilities, footerServices, navigation, processSteps,
  projects, serviceOptions, services,
} from '../data/site'

const serviceIcons = {
  search: Search,
  share: Share2,
  target: Target,
  layout: LayoutDashboard,
  workflow: Workflow,
  zap: Zap,
  chart: BarChart3,
  code: Code2,
}

const benefitIcons = {
  sliders: SlidersHorizontal,
  messages: MessagesSquare,
  wallet: WalletCards,
  life: LifeBuoy,
}

function Reveal({ children, className = '', delay = 0 }) {
  const elementRef = useRef(null)

  useEffect(() => {
    const element = elementRef.current
    if (!element || !('IntersectionObserver' in window)) return

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        element.classList.add('is-visible')
        observer.unobserve(element)
      }
    }, { threshold: 0.12 })

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={elementRef} className={`reveal ${className}`} style={{ '--reveal-delay': `${delay}ms` }}>
      {children}
    </div>
  )
}

function SectionHeading({ eyebrow, title, text, centered = false }) {
  return (
    <div className={`section-heading ${centered ? 'section-heading-centered' : ''}`}>
      <span className="eyebrow"><span className="eyebrow-dot" />{eyebrow}</span>
      <h2>{title}</h2>
      {text && <p>{text}</p>}
    </div>
  )
}

function Brand({ light = false, compact = false }) {
  return (
    <a className={`brand ${light ? 'brand-light' : ''} ${compact ? 'brand-compact' : ''}`} href="#home" aria-label={`${agency.name} home`}>
      <img src={compact ? '/go-forge-navbar.svg' : light ? '/go-forge-footer.svg' : '/go-forge-logo.svg'} alt="Go-Forge: Ideas, Marketing, Solutions" />
    </a>
  )
}

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <header className="site-header">
      <div className="nav-shell">
        <Brand compact />
        <nav className={`main-nav ${isOpen ? 'main-nav-open' : ''}`} aria-label="Main navigation">
          {navigation.map((item) => (
            <a key={item.href} href={item.href} onClick={() => setIsOpen(false)}>{item.label}</a>
          ))}
        </nav>
        <a className="button button-dark nav-cta" href="#contact">
          Let&apos;s talk <ArrowUpRight size={16} />
        </a>
        <button
          className="menu-toggle"
          type="button"
          aria-label={isOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isOpen}
          onClick={() => setIsOpen((open) => !open)}
        >
          {isOpen ? <X size={23} /> : <Menu size={23} />}
        </button>
      </div>
    </header>
  )
}

function GrowthVisual() {
  const bars = [32, 42, 37, 51, 47, 63, 55, 71, 66, 84, 75, 94]

  return (
    <div className="hero-visual" aria-label="Illustrative business growth dashboard">
      <div className="visual-orbit visual-orbit-one" />
      <div className="visual-orbit visual-orbit-two" />
      <div className="growth-card">
        <div className="growth-card-top">
          <span className="mini-brand"><span /> Go-Forge / overview</span>
          <span className="live-pill"><i /> Live workspace</span>
        </div>
        <div className="growth-card-title">
          <div><span className="visual-label">YOUR BUSINESS, IN FOCUS</span><h3>Room to grow.</h3></div>
          <button type="button" className="square-action" aria-label="Dashboard options"><ArrowUpRight size={17} /></button>
        </div>
        <div className="overview-grid">
          <div className="overview-tile tile-highlight">
            <span>Marketing</span><strong>Find your people</strong>
            <div className="tile-sparkline"><i /><i /><i /><i /><i /><i /><i /><i /></div>
          </div>
          <div className="overview-tile">
            <span>Operations</span><strong>Make work flow</strong>
            <div className="tile-flow"><b /><b /><b /><b /></div>
          </div>
        </div>
        <div className="chart-panel">
          <div className="chart-heading"><span>Momentum, over time</span><span className="chart-period">A clearer view <ArrowUpRight size={13} /></span></div>
          <div className="chart-grid" aria-hidden="true">
            {bars.map((height, index) => <span key={index} style={{ '--bar-height': `${height}%` }} />)}
          </div>
          <div className="chart-axis"><span>STRATEGY</span><span>IDEAS</span><span>IMPACT</span></div>
        </div>
        <div className="growth-card-footer"><span><i /> A little more clarity</span><span>Built around you <ArrowRight size={13} /></span></div>
      </div>
      <div className="float-note float-note-top"><span className="float-note-icon"><Sparkles size={17} /></span><span>More focus.<br /><strong>Less friction.</strong></span></div>
      <div className="float-note float-note-bottom"><span className="float-note-icon note-check"><Check size={17} /></span><span>One thoughtful<br /><strong>step at a time</strong></span></div>
    </div>
  )
}

export function Hero() {
  return (
    <section className="hero-section" id="home">
      <div className="hero-wrap">
        <div className="hero-copy">
          <Reveal>
            <span className="eyebrow hero-eyebrow"><span className="eyebrow-dot" /> A growth partner for what&apos;s next</span>
            <h1>Good business deserves <span>a bigger</span> digital future.</h1>
            <p className="hero-intro">We bring marketing, technology, and business thinking together to help your next chapter take shape.</p>
            <div className="hero-actions">
              <a className="button button-lime" href="#contact">Get a free consultation <ArrowUpRight size={17} /></a>
              <a className="text-link" href="#services">Explore our services <ArrowRight size={16} /></a>
            </div>
            <div className="hero-proof"><span className="proof-line" /><span>Marketing <i>·</i> Technology <i>·</i> Business solutions</span></div>
          </Reveal>
        </div>
        <Reveal className="hero-art-reveal" delay={130}><GrowthVisual /></Reveal>
      </div>
      <div className="hero-bottom-rule"><span>Thoughtful work. Tangible progress.</span><a href="#services" aria-label="Scroll to services"><ArrowRight size={17} /></a></div>
    </section>
  )
}

export function Services() {
  return (
    <section className="section services-section" id="services">
      <div className="container">
        <Reveal><SectionHeading eyebrow="What we do" title="The right pieces, working together." text="From first impression to the way your team works behind the scenes, we help your business move forward." /></Reveal>
        <div className="service-grid">
          {services.map((service, index) => {
            const Icon = serviceIcons[service.icon]
            return (
              <Reveal key={service.number} delay={index * 45} className="service-reveal">
                <article className="service-card">
                  <div className="service-card-top"><span className="service-icon"><Icon size={20} strokeWidth={1.7} /></span><span className="service-number">{service.number}</span></div>
                  <h3>{service.title}</h3>
                  <p>{service.description}</p>
                  <a className="card-link" href="#contact" aria-label={`Ask us about ${service.title}`}>Let&apos;s explore <ArrowUpRight size={15} /></a>
                </article>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function SolutionsVisual() {
  const rows = [
    { icon: '01', label: 'New enquiries', status: 'Ready to follow up', tone: 'status-lime' },
    { icon: '02', label: 'Customer details', status: 'All in one place', tone: 'status-blue' },
    { icon: '03', label: 'Team tasks', status: 'Moving smoothly', tone: 'status-coral' },
  ]

  return (
    <div className="solutions-visual" aria-label="Illustrative business operations dashboard">
      <div className="solutions-window">
        <div className="window-top"><div className="window-dots"><i /><i /><i /></div><span>YOUR WORKSPACE</span><span className="window-menu"><i /><i /><i /></span></div>
        <div className="workspace-body">
          <div className="workspace-sidebar"><span className="workspace-logo"><LayersIcon /></span><i className="side-icon active-side" /><i className="side-icon" /><i className="side-icon" /><i className="side-icon" /></div>
          <div className="workspace-content">
            <div className="workspace-heading"><div><small>MONDAY, YOUR WAY</small><strong>A calmer workday.</strong></div><span className="avatar-stack"><i /><i /><b>+</b></span></div>
            <div className="workspace-summary"><div><span>Today&apos;s focus</span><b>Keep good work moving</b></div><span className="summary-mark"><Check size={16} /></span></div>
            <div className="workspace-list-heading"><span>Across your business</span><span>Open workspace <ArrowUpRight size={12} /></span></div>
            <div className="workspace-rows">
              {rows.map((row) => <div className="workspace-row" key={row.label}><span className={`row-index ${row.tone}`}>{row.icon}</span><span className="row-label">{row.label}</span><span className="row-status">{row.status}</span><ArrowUpRight size={13} /></div>)}
            </div>
            <div className="workspace-note"><span><i /> Your team is in sync</span><span>Made for your business</span></div>
          </div>
        </div>
      </div>
      <div className="solution-bubble"><Workflow size={17} /><span>Less switching.<br /><strong>More doing.</strong></span></div>
    </div>
  )
}

function LayersIcon() {
  return <LayoutDashboard size={17} strokeWidth={1.8} />
}

export function Solutions() {
  return (
    <section className="solutions-section" id="solutions">
      <div className="container solutions-layout">
        <Reveal className="solutions-copy">
          <span className="eyebrow eyebrow-light"><span className="eyebrow-dot" /> Business systems, made human</span>
          <h2>Make the moving parts feel like <em>one business.</em></h2>
          <p>When information lives everywhere, good work gets harder. We shape practical digital tools around the way your business runs, so your people can spend less time chasing details and more time moving things forward.</p>
          <div className="capability-list">
            {capabilities.map((capability) => <span key={capability}><Check size={14} />{capability}</span>)}
          </div>
          <a className="button button-lime" href="#contact">Build a solution for my business <ArrowUpRight size={17} /></a>
        </Reveal>
        <Reveal className="solutions-art" delay={110}><SolutionsVisual /></Reveal>
      </div>
    </section>
  )
}

export function WhyChooseUs() {
  return (
    <section className="section why-section">
      <div className="container why-layout">
        <Reveal><SectionHeading eyebrow="A better kind of partner" title="Built around your business, not a template." text="Good solutions should feel like they belong to the people using them." /></Reveal>
        <div className="benefit-grid">
          {benefits.map((benefit, index) => {
            const Icon = benefitIcons[benefit.icon]
            return (
              <Reveal key={benefit.title} delay={index * 65}>
                <article className="benefit-card"><span className="benefit-icon"><Icon size={20} strokeWidth={1.7} /></span><h3>{benefit.title}</h3><p>{benefit.description}</p></article>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export function Process() {
  return (
    <section className="process-section">
      <div className="container">
        <Reveal><SectionHeading eyebrow="How we work" title="A good process makes room for good work." text="Clear steps. Open conversations. Progress you can see." centered /></Reveal>
        <div className="process-track">
          {processSteps.map((step, index) => <Reveal key={step.number} delay={index * 60} className="process-reveal"><article className="process-step"><span className="process-number">{step.number}</span><span className="process-dot" /><h3>{step.title}</h3><p>{step.description}</p></article></Reveal>)}
        </div>
      </div>
    </section>
  )
}

export function Portfolio() {
  return (
    <section className="section portfolio-section" id="work">
      <div className="container">
        <Reveal><div className="portfolio-heading"><SectionHeading eyebrow="Selected directions" title="Work that starts with a real challenge." text="A few concept directions that show how we connect business needs with thoughtful digital experiences." /><a className="text-link portfolio-cta" href="#contact">Bring us your challenge <ArrowRight size={16} /></a></div></Reveal>
        <div className="portfolio-grid">
          {projects.map((project, index) => <Reveal key={project.title} delay={(index % 2) * 80}><article className="project-card"><div className={`project-image ${project.tone}`}><img src={project.image} alt={project.alt} loading="lazy" /><span className="project-concept">Illustrative concept</span><a className="project-open" href="#contact" aria-label={`Discuss a project like ${project.title}`}><ArrowUpRight size={18} /></a></div><div className="project-info"><div><span className="project-category">{project.category}</span><h3>{project.title}</h3><p>{project.description}</p></div><a className="project-arrow" href="#contact" aria-label={`Ask about ${project.title}`}><ArrowRight size={17} /></a></div></article></Reveal>)}
        </div>
      </div>
    </section>
  )
}

export function About() {
  return (
    <section className="about-section" id="about">
      <div className="container about-layout">
        <Reveal><div className="about-stamp"><span>STRATEGY</span><i>✳</i><span>CRAFT</span><i>✳</i><span>CARE</span></div></Reveal>
        <Reveal className="about-copy" delay={80}>
          <span className="eyebrow"><span className="eyebrow-dot" /> A little about us</span>
          <h2>We combine marketing, technology <span>&amp; data.</span></h2>
          <p>Go-Forge helps businesses find customers, show up with confidence, and make their day-to-day work better with technology. We bring the right people and disciplines together around what your business actually needs.</p>
          <div className="belief-grid"><div><span>OUR MISSION</span><p>Make digital progress feel practical and within reach.</p></div><div><span>WHAT WE BELIEVE</span><p>Good work begins with listening, and gets better together.</p></div></div>
          <a className="text-link" href="#contact">Get to know us <ArrowRight size={16} /></a>
        </Reveal>
      </div>
    </section>
  )
}

export function CTA() {
  return (
    <section className="cta-section">
      <div className="container cta-inner">
        <Reveal className="cta-copy"><span className="eyebrow eyebrow-light"><span className="eyebrow-dot" /> Your next good move</span><h2>Have a business idea or a problem to solve?</h2><p>Tell us what you&apos;re trying to achieve. We&apos;ll help you find the right digital or technology solution.</p></Reveal>
        <Reveal className="cta-actions" delay={100}><a className="button button-lime" href="#contact">Get a free consultation <ArrowUpRight size={17} /></a><a className="button button-outline-light" href={agency.whatsapp} target="_blank" rel="noreferrer"><MessageCircle size={17} /> WhatsApp us</a><span>No pressure. Just a useful first conversation.</span></Reveal>
        <div className="cta-orbit cta-orbit-one" /><div className="cta-orbit cta-orbit-two" />
      </div>
    </section>
  )
}

export function Contact() {
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(event) {
    event.preventDefault()
    const form = event.currentTarget
    if (!form.reportValidity()) return

    setSubmitted(true)
    form.reset()
  }

  return (
    <section className="section contact-section" id="contact">
      <div className="container contact-layout">
        <Reveal className="contact-copy"><SectionHeading eyebrow="Start a conversation" title="Tell us what you have in mind." text="A few details are plenty. We&apos;ll get back to you to learn more and talk through a useful next step." />
          <div className="contact-details">
            <a href={`mailto:${agency.email}`}><span className="contact-detail-icon"><Mail size={17} /></span><span><small>EMAIL</small><strong>{agency.email}</strong></span><ArrowUpRight size={15} /></a>
            <a href={`tel:${agency.phoneHref}`}><span className="contact-detail-icon"><Phone size={17} /></span><span><small>PHONE</small><strong>{agency.phone}</strong></span><ArrowUpRight size={15} /></a>
            <a href={agency.whatsapp} target="_blank" rel="noreferrer"><span className="contact-detail-icon"><MessageCircle size={17} /></span><span><small>WHATSAPP</small><strong>Let&apos;s chat</strong></span><ArrowUpRight size={15} /></a>
            <div className="contact-location"><span className="contact-detail-icon"><MapPin size={17} /></span><span><small>LOCATION</small><strong>{agency.location}</strong></span></div>
          </div>
        </Reveal>
        <Reveal className="contact-form-wrap" delay={100}>
          <form className="contact-form" onSubmit={handleSubmit}>
            <div className="form-intro"><span>PROJECT ENQUIRY</span><span><i /> Usually reply within 2 business days</span></div>
            <div className="form-grid">
              <label>Name<input name="name" autoComplete="name" placeholder="Your name" required /></label>
              <label>Business name<input name="business" autoComplete="organization" placeholder="Your business" required /></label>
              <label>Email<input type="email" name="email" autoComplete="email" placeholder="you@company.com" required /></label>
              <label>Phone<input type="tel" name="phone" autoComplete="tel" placeholder="Your number" /></label>
              <label className="form-full">Service you&apos;re interested in<select name="service" defaultValue="" required><option value="" disabled>Select a service</option>{serviceOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
              <label className="form-full">A little about your project<textarea name="message" rows="4" placeholder="What are you looking to make possible?" required /></label>
            </div>
            {submitted && <p className="form-success" role="status"><Check size={16} /> This demo form isn&apos;t connected yet. Email <a href={`mailto:${agency.email}`}>{agency.email}</a> to send your enquiry.</p>}
            <div className="form-submit-row"><span>By sending this, you agree we can reply about your enquiry.</span><button className="button button-dark" type="submit">Send enquiry <Send size={15} /></button></div>
          </form>
        </Reveal>
      </div>
    </section>
  )
}

export function Footer() {
  const socialLinks = [
    { label: 'Instagram', href: 'https://www.instagram.com/', Icon: Share2 },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/', Icon: Share2 },
    { label: 'Facebook', href: 'https://www.facebook.com/', Icon: Share2 },
    { label: 'WhatsApp', href: agency.whatsapp, Icon: MessageCircle },
  ]

  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-main">
          <div className="footer-brand-col"><Brand light /><p>Good business deserves a bigger digital future. Let&apos;s make yours happen.</p><a className="footer-email" href={`mailto:${agency.email}`}>{agency.email} <ArrowUpRight size={14} /></a></div>
          <div className="footer-links-col"><span className="footer-label">EXPLORE</span>{navigation.map((item) => <a key={item.href} href={item.href}>{item.label}</a>)}</div>
          <div className="footer-links-col"><span className="footer-label">WHAT WE DO</span>{footerServices.map((item) => <a key={item.label} href={item.href}>{item.label}</a>)}</div>
          <div className="footer-social-col"><span className="footer-label">SAY HELLO</span><div className="social-links">{socialLinks.map(({ label, href, Icon }) => <a key={label} href={href} aria-label={label} target="_blank" rel="noreferrer"><Icon size={17} /></a>)}</div><a className="footer-contact-link" href="#contact">Have something in mind? <ArrowUpRight size={14} /></a></div>
        </div>
        <div className="footer-bottom"><span>© {new Date().getFullYear()} {agency.name}. All rights reserved.</span><span>Thoughtfully made for what&apos;s next.</span><a href="#home">Back to top ↑</a></div>
      </div>
    </footer>
  )
}

export function WhatsAppButton() {
  return <a className="whatsapp-float" href={agency.whatsapp} target="_blank" rel="noreferrer" aria-label="Chat with us on WhatsApp"><MessageCircle size={23} /><span>Let&apos;s talk</span></a>
}