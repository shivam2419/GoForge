import {
  About, CTA, Contact, Footer, Hero, Navbar, Portfolio, Process,
  Services, Solutions, WhatsAppButton, WhyChooseUs,
} from './components/SiteSections'
import AdminPortal from './components/AdminPortal'

function App() {
  if (window.location.pathname.replace(/\/+$/, '') === '/admin') {
    return <AdminPortal />
  }

  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Services />
        <Solutions />
        <WhyChooseUs />
        <Process />
        <Portfolio />
        <About />
        <CTA />
        <Contact />
      </main>
      <Footer />
      <WhatsAppButton />
    </>
  )
}

export default App