import {
  About, CTA, Contact, Footer, Hero, Navbar, Portfolio, Process,
  Services, Solutions, WhatsAppButton, WhyChooseUs,
} from './components/SiteSections'

function App() {
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