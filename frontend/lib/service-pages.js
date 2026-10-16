'use strict';
// Long-form service pages (/services/:slug). Plain, honest copy: Goforge Digital is an early-stage,
// MSME-registered studio in Faridabad. No fee figures, no invented stats, clients or certifications.
// `contact` must be one of CONTACT_SERVICES so the enquiry form accepts it.

const PAGES = [
  {
    slug: 'custom-software-development', icon: 'code', contact: 'Custom Software & Web Apps',
    name: 'Custom Software Development',
    nav: 'Custom software',
    seoTitle: 'Custom Software Development Services in Faridabad | Goforge Digital',
    desc: 'Custom software development in Faridabad: web apps, portals, dashboards and internal tools built around how your business works. Scoped on a free call, with source code handed over.',
    h1: 'Custom Software Development in Faridabad',
    lede: 'Web applications, portals, dashboards and internal tools designed around the way your team already works, built by a small MSME-registered studio in Sector 81, Faridabad.',
    intro: [
      'Most growing businesses reach a point where spreadsheets, paper registers and three different apps stop keeping up. Orders get missed, the same data is typed twice, and only one person knows how the process really runs. Custom software development fixes that by giving your team one tool that does the exact job you need, in your words, with the screens and permissions your people actually use.',
      'Goforge Digital is an early-stage software company in Faridabad. We keep projects focused: one clear first version, delivered in visible milestones, then improved once your team has used it. You work directly with the people building it, and you own the code, the data and the accounts at the end.'
    ],
    problems: [
      ['Work lives in spreadsheets', 'Records are copied between sheets, versions clash, and nobody is sure which file is current. We turn the sheet into a proper app with one source of truth.'],
      ['Off-the-shelf tools almost fit', 'Ready-made software forces your process into its shape. Custom software follows your steps, your approval rules and your terminology instead.'],
      ['Customers cannot self-serve', 'Clients call to check a status, book a slot or download a document. A simple portal lets them do it themselves at any hour.'],
      ['Managers lack a clear picture', 'Reports are built by hand at month end. A live dashboard shows sales, work in progress and pending tasks whenever you need them.'],
      ['Too many manual steps', 'Repeated copying, calculations and reminders slow the team down and introduce mistakes. Software handles the routine parts reliably.'],
      ['Knowledge sits with one person', 'When the process lives in someone’s head, leave and turnover hurt. A documented system keeps the business running smoothly.']
    ],
    modules: [
      ['Web applications', 'Browser-based apps that work on laptops and phones, with no installation needed for your staff or customers.'],
      ['Customer and partner portals', 'Secure sign-in areas where customers track orders, upload documents, pay invoices or raise requests.'],
      ['Admin panels and dashboards', 'Clear screens for managers to approve, filter, search and export, with charts that update as work happens.'],
      ['Booking and order flows', 'Enquiry, booking, quotation and order journeys that save every step and notify the right person.'],
      ['Roles and permissions', 'Each user sees only what they should. Owners, managers, staff and customers get separate access levels.'],
      ['Integrations and APIs', 'Connections to payment gateways, accounting tools, email, SMS and your existing systems so data flows on its own.'],
      ['Reports and exports', 'Downloadable reports in Excel or PDF, scheduled summaries, and filters that answer everyday questions quickly.'],
      ['Maintenance and improvements', 'Bug fixes, small feature additions and hosting care after launch, agreed in writing so you know what is covered.']
    ],
    process: [
      ['Discovery call', 'A free conversation about the job the software must do, who uses it and what you use today.'],
      ['Written scope', 'A plain document listing screens, features, what is in the first version and what can wait.'],
      ['Design and clickable preview', 'Simple layouts you can review before code is written, so changes are cheap and early.'],
      ['Build in milestones', 'Working software shown at regular check-ins. You test real screens, not slide decks.'],
      ['Testing and launch', 'We test with your sample data, fix what you find, move the app live and train your team.'],
      ['Handover and support', 'Source code, logins, hosting details and a short user guide, plus an agreed support window.']
    ],
    tech: ['JavaScript and TypeScript', 'Node.js and Express', 'React', 'Python', 'PostgreSQL, MySQL and SQLite', 'REST APIs', 'Cloud hosting such as Vercel, AWS or Google Cloud', 'Git and GitHub'],
    techNote: 'We choose proven, widely used technology so your software is easy to host, easy to hire for and not tied to one agency. Where a simple, well-supported tool solves the problem, we use it instead of building from scratch.',
    industries: [
      ['Real estate', 'Property listings, lead tracking, site visit scheduling and broker dashboards.'],
      ['Schools and colleges', 'Admission enquiries, fee records, attendance and parent communication.'],
      ['Manufacturing and trading', 'Order tracking, stock movement, dispatch records and supplier lists.'],
      ['Clinics and services', 'Appointment booking, patient or client records, reminders and invoices.'],
      ['Startups', 'A first version of a product idea, built to test with real users quickly.']
    ],
    priceFactors: ['Number of screens and user roles', 'Integrations with payment, accounting or other systems', 'Data migration from sheets or older software', 'Design depth, from clean standard layouts to fully custom branding', 'Hosting, security and backup requirements', 'Length of the support window after launch'],
    faqs: [
      ['How much does custom software development cost?', 'The cost depends on scope: how many screens, roles and integrations the first version needs. After a free discovery call we send a written scope with one clear price, shared on a call, and we can plan a smaller first step to match your budget.'],
      ['How long does a custom software project take?', 'A focused first version usually takes a few weeks, depending on features and how quickly feedback comes back. The written scope includes milestone dates so you can plan around them.'],
      ['Will I own the source code?', 'Yes. At handover you receive the source code, the hosting and domain access, and the logins, all in your name. You are free to keep working with us or take the code elsewhere.'],
      ['Can you improve software we already have?', 'Often, yes. We first review what exists, tell you plainly what is worth keeping, and then fix, extend or connect it rather than rebuilding everything.'],
      ['Do you build mobile-friendly software?', 'Every web app we build works on phones, tablets and laptops. For many businesses this removes the need for a separate mobile app at the start.'],
      ['Why choose a small Faridabad studio?', 'You talk directly with the people who build your software, you can visit our office in Sector 81, and we keep scope tight so projects actually finish.']
    ],
    related: ['crm-development', 'erp-development', 'website-development', 'ai-automation']
  },
  {
    slug: 'crm-development', icon: 'database', contact: 'CRM, ERP & Integrations',
    name: 'CRM Development',
    nav: 'CRM development',
    seoTitle: 'CRM Development Company in Faridabad | Custom CRM | Goforge Digital',
    desc: 'Custom CRM development in Faridabad for sales teams, real estate firms and schools: lead capture, follow-ups, pipelines and reports in one system your team will actually open.',
    h1: 'Custom CRM Development Company in Faridabad',
    lede: 'A customer relationship management system shaped around your sales stages, so every enquiry is captured, followed up and measured in one place.',
    intro: [
      'Leads arrive from your website, phone calls, social media and walk-ins. When they are scattered across notebooks, inboxes and personal phones, follow-ups slip and good enquiries go cold. A custom CRM brings every lead into one list, assigns it to the right person and reminds them when to call back.',
      'Unlike a generic CRM with hundreds of unused settings, a custom CRM uses your stages, your fields and your reports. Goforge Digital builds CRM systems for small and growing businesses in Faridabad and Delhi NCR, and can also connect or tidy up a CRM you already pay for.'
    ],
    problems: [
      ['Leads get lost', 'Enquiries from forms, calls and ads land in different places. The CRM collects them automatically into one pipeline.'],
      ['Follow-ups are forgotten', 'Busy teams miss callbacks. Scheduled reminders and task lists make sure every lead gets a timely reply.'],
      ['No view of the pipeline', 'Owners cannot see how many deals are in each stage. Pipeline boards and reports show it at a glance.'],
      ['Customer history is scattered', 'Past calls, quotes and notes sit with individuals. The CRM keeps the full history on each customer record.'],
      ['Generic CRMs feel heavy', 'Teams stop using tools that are confusing. A custom CRM shows only the fields and buttons your people need.'],
      ['Hard to measure sources', 'You cannot tell which ad or channel brings real buyers. Source tracking ties every lead to where it came from.']
    ],
    modules: [
      ['Lead capture', 'Website forms, landing pages and imports feed new leads straight into the CRM with source and time recorded.'],
      ['Pipeline and stages', 'Drag-and-drop boards with stages named the way your team talks, from new enquiry to won or lost.'],
      ['Assignment rules', 'Leads routed to the right salesperson by area, product or turn, with managers able to reassign.'],
      ['Tasks and reminders', 'Callbacks, meetings and follow-ups scheduled on each lead, with email or SMS alerts to the owner.'],
      ['Contact and account records', 'One page per customer showing details, notes, documents, quotes and every past interaction.'],
      ['Quotes and documents', 'Generate quotations or brochures from templates and keep a copy against the customer record.'],
      ['Reports and dashboards', 'Leads by source, conversion by stage, response times and team performance, with exports.'],
      ['Integrations', 'Connections to your website, ad platforms, email, telephony, accounting or ERP so data is entered once.']
    ],
    process: [
      ['Map your sales journey', 'We list where leads come from, who replies and the stages a deal moves through.'],
      ['Define fields and stages', 'Agree the exact fields, stage names and rules in your own words before building.'],
      ['Build the core CRM', 'Lead capture, pipeline, tasks and records first, shown to you as working screens.'],
      ['Import existing data', 'Clean and move your current leads and customers from sheets or old tools.'],
      ['Team training', 'Short, practical sessions so every user knows how to log calls and update stages.'],
      ['Review and refine', 'After real use, adjust reports, automations and fields based on what the team needs.']
    ],
    tech: ['Node.js and Express', 'React dashboards', 'PostgreSQL or MySQL', 'REST APIs and webhooks', 'Email and SMS gateways', 'Google Sheets and form integrations', 'Secure cloud hosting'],
    techNote: 'Where a hosted CRM such as Zoho or HubSpot already suits you, we can configure and integrate it instead of building from zero. We recommend whichever option keeps your running costs and complexity sensible.',
    industries: [
      ['Real estate', 'Project-wise leads, site visits, broker channels and booking follow-ups.'],
      ['Education', 'Admission enquiries, counselling calls and fee follow-ups for schools and colleges.'],
      ['Professional services', 'Client onboarding, proposals and renewals for agencies and consultants.'],
      ['Retail and distribution', 'Dealer and distributor relationships, repeat orders and collections.'],
      ['Healthcare and clinics', 'Patient enquiries, appointment follow-ups and treatment packages.']
    ],
    priceFactors: ['Number of pipelines, stages and user roles', 'Lead sources to connect, such as website forms and ad platforms', 'Volume and cleanliness of existing data to import', 'Custom reports and dashboards required', 'Email, SMS or telephony integrations', 'Whether we build custom or configure an existing CRM'],
    faqs: [
      ['Should I build a custom CRM or use Zoho or HubSpot?', 'If a standard CRM fits your process with light setup, that is often the faster choice and we can configure it. A custom CRM makes sense when your stages, fields or integrations are unusual or when per-user licence costs grow large.'],
      ['What does CRM development cost?', 'It depends on the number of pipelines, users, integrations and reports. We share a clear written price on a call after understanding your sales process.'],
      ['Can the CRM capture leads from my website automatically?', 'Yes. Website forms, landing pages and many ad platforms can send leads directly into the CRM, tagged with their source.'],
      ['Can you move our data from Excel?', 'Yes. We clean duplicates, match columns to the new fields and import your existing leads and customers before launch.'],
      ['Will my team find it easy to use?', 'We design screens around the few actions your team repeats daily, and train them in short practical sessions. Simple tools get used.'],
      ['Can the CRM connect to our accounting or ERP?', 'In most cases, yes, through APIs or scheduled imports, so customer and invoice data does not need to be typed twice.']
    ],
    related: ['real-estate-crm', 'erp-development', 'ai-automation', 'custom-software-development']
  },
  {
    slug: 'erp-development', short: 'ERP Development', icon: 'database', contact: 'CRM, ERP & Integrations',
    name: 'ERP Development',
    nav: 'ERP development',
    seoTitle: 'ERP Software Development in Faridabad | Custom ERP | Goforge Digital',
    desc: 'Custom ERP software development in Faridabad for MSMEs: inventory, purchase, sales, billing, production and reports connected in one system, built in phases around your operations.',
    h1: 'Custom ERP Software Development in Faridabad',
    lede: 'Inventory, purchase, sales, billing and operations connected in one system, built in sensible phases for small and mid-sized businesses.',
    intro: [
      'Faridabad is home to thousands of MSMEs in manufacturing, trading and services. Many of them run operations on a mix of accounting software, Excel sheets and paper slips. As orders grow, that mix makes it hard to know stock levels, pending dispatches or the real margin on a job. An ERP, or enterprise resource planning system, connects these departments so information flows from one to the next automatically.',
      'Large ERP suites can be expensive and slow to roll out. Goforge Digital builds custom ERP software in phases, starting with the module that hurts most today, such as inventory or order management, then adding purchase, production or reporting once the first part is working well for your team.'
    ],
    problems: [
      ['Stock numbers never match', 'Physical stock and records drift apart. Real-time inventory updates with every inward, outward and transfer.'],
      ['Orders slip between departments', 'Sales, stores and dispatch work from different lists. One order record follows the job through every stage.'],
      ['Purchase is reactive', 'Materials are ordered only when they run out. Reorder levels and purchase requests keep supply ahead of demand.'],
      ['Billing is slow and error-prone', 'Invoices are prepared by hand from several sources. The ERP generates them from confirmed orders and dispatches.'],
      ['No reliable reports', 'Owners wait for month-end numbers. Live reports show sales, stock value, receivables and pending work.'],
      ['Big ERPs feel out of reach', 'Enterprise suites demand long projects and heavy licences. A phased custom ERP fits MSME scale and pace.']
    ],
    modules: [
      ['Inventory and warehouse', 'Item masters, batches, locations, stock movements, reorder levels and stock valuation.'],
      ['Sales and orders', 'Quotations, sales orders, delivery challans and order status visible to the whole team.'],
      ['Purchase and vendors', 'Purchase requests, purchase orders, goods receipt and vendor records with history.'],
      ['Production and job work', 'Bills of materials, work orders, job cards and material consumption for manufacturers.'],
      ['Billing and GST-ready invoices', 'Invoices generated from orders with tax fields, plus export to your accounting software.'],
      ['HR and attendance', 'Employee records, attendance and simple payroll inputs where needed.'],
      ['Approvals and audit trail', 'Approval steps for purchases, discounts and returns, with a record of who changed what.'],
      ['Dashboards and reports', 'Sales, stock, receivables, payables and production summaries for owners and managers.']
    ],
    process: [
      ['Operations walkthrough', 'We visit or call to understand how material, orders and money move through your business.'],
      ['Phase plan', 'A written roadmap naming the first module, the later phases and what each will include.'],
      ['Masters and setup', 'Items, customers, vendors and locations prepared and imported from your current records.'],
      ['Build and test phase one', 'The first module delivered, tested with real transactions and refined with your staff.'],
      ['Go live and train', 'Switch over on an agreed date, with training for each department that uses the system.'],
      ['Next phases', 'Add further modules on the same foundation once the first is stable and trusted.']
    ],
    tech: ['Node.js or Python back ends', 'React interfaces', 'PostgreSQL or MySQL', 'REST APIs', 'Exports to Tally and accounting tools', 'Barcode and label printing', 'Role-based access and backups'],
    techNote: 'We design the database carefully from the start so later modules plug in cleanly. Accounting can stay in the software your accountant already uses, with the ERP sending clean data across.',
    industries: [
      ['Manufacturing', 'Raw material, work in progress, finished goods and job work tracking.'],
      ['Trading and distribution', 'Multi-location stock, dealer orders, dispatch and collections.'],
      ['Construction and real estate', 'Material requests, site-wise consumption and contractor billing.'],
      ['Education', 'Fees, inventory of books and uniforms, transport and staff records.'],
      ['Service businesses', 'Job scheduling, spare parts, service contracts and invoicing.']
    ],
    priceFactors: ['Number of modules in each phase', 'Locations, warehouses and users', 'Complexity of production or approval rules', 'Data migration from existing software', 'Integration with accounting, barcode or other systems', 'Training and support needs across departments'],
    faqs: [
      ['What is ERP software and do I need it?', 'ERP software connects departments such as sales, inventory, purchase and billing in one system. If your team re-enters the same data in several places or cannot see stock and orders in real time, an ERP is worth considering.'],
      ['What does custom ERP development cost?', 'It depends on the modules, users and integrations in each phase. We prefer to start with one module, and the price for that phase is shared on a call after we understand your operations.'],
      ['Can it work with Tally or our accounting software?', 'Yes. Many clients keep accounts in their existing software while the ERP handles operations and exports or syncs invoices and ledgers.'],
      ['Can we start small?', 'Yes, and we recommend it. Starting with the module that causes the most pain gives value quickly and makes the next phases easier.'],
      ['Is our data safe?', 'Access is controlled by role, changes are logged, and backups are scheduled. Hosting and data stay in accounts you own.'],
      ['How long before we can go live?', 'A first module can usually go live within weeks rather than months, depending on scope and how ready your master data is.']
    ],
    related: ['crm-development', 'custom-software-development', 'ai-automation', 'school-management-software']
  },
  {
    slug: 'ai-automation', icon: 'gear', contact: 'AI Automation & Workflows',
    name: 'AI Automation',
    nav: 'AI automation',
    seoTitle: 'AI Automation Services in Faridabad | Workflow Automation | Goforge Digital',
    desc: 'AI and workflow automation in Faridabad: instant enquiry alerts, automatic follow-ups, AI-drafted replies and document processing, with a person approving what goes out.',
    h1: 'AI Automation and Workflow Services in Faridabad',
    lede: 'Practical automation for repeated tasks, from instant enquiry alerts to AI-drafted replies, always with a person in control of what goes out.',
    intro: [
      'A large part of every working day goes on small, repeated tasks: copying form entries into a sheet, sending the same reply, reminding a customer, renaming files or preparing a weekly summary. Workflow automation handles these steps reliably, and modern AI tools can now read, sort and draft text well enough to take on work that once needed a person for every message.',
      'Goforge Digital builds focused automations for small businesses. We start with one workflow that saves real time, measure it, and keep a human approval step wherever a mistake would matter. The goal is fewer manual steps and faster responses, not a pile of tools nobody maintains.'
    ],
    problems: [
      ['Slow response to enquiries', 'Leads wait hours for a reply. Instant alerts and acknowledgements reach the customer and your team within seconds.'],
      ['Repetitive data entry', 'Staff copy details between forms, sheets and systems. Automations move the data across without retyping.'],
      ['Missed follow-ups', 'Reminders depend on memory. Scheduled sequences send follow-ups on time and stop when the customer responds.'],
      ['Documents pile up', 'Invoices, forms and resumes are read and sorted by hand. AI can extract key fields and file them correctly.'],
      ['Same questions every day', 'Teams answer identical queries repeatedly. AI drafts replies from your own approved information for quick review.'],
      ['Reports take hours', 'Weekly summaries are assembled manually. Automated reports arrive in your inbox on schedule.']
    ],
    modules: [
      ['Enquiry alerts', 'New website form entries trigger email and SMS alerts to the right person, with details neatly formatted.'],
      ['Follow-up sequences', 'Timed reminders and messages to leads or customers, paused automatically when they reply or convert.'],
      ['AI-drafted replies', 'Draft answers to common questions prepared by AI from your content, approved by a person before sending.'],
      ['Document extraction', 'Key fields pulled from PDFs, invoices or forms into a sheet or system, with low-confidence items flagged.'],
      ['Data sync between tools', 'Forms, sheets, CRM, email and accounting kept in step without manual copying.'],
      ['Scheduled reports', 'Daily or weekly summaries of leads, sales or tasks delivered automatically to managers.'],
      ['Approval workflows', 'Requests routed for approval with clear status, reminders and a record of decisions.'],
      ['Monitoring and controls', 'Logs of every automated action, error alerts, and a simple way to pause a flow.']
    ],
    process: [
      ['Find the repeat task', 'We look for the task your team repeats most and estimate the time it takes each week.'],
      ['Agree the rules', 'Decide what runs automatically, what needs approval and what must never be sent alone.'],
      ['Build one flow', 'Create and test a single working automation with your real data and tools.'],
      ['Run side by side', 'The flow runs alongside the manual process briefly so results can be checked.'],
      ['Switch on and monitor', 'Go live with logs and alerts, so any failure is noticed and fixed quickly.'],
      ['Extend carefully', 'Add the next automation only once the first is reliable and genuinely useful.']
    ],
    tech: ['AI language model APIs', 'Python and Node.js scripts', 'Webhooks and REST APIs', 'Google Workspace and Microsoft 365', 'Email and SMS gateways', 'n8n, Make or Zapier where suitable', 'Secure logging and error alerts'],
    techNote: 'We pick the simplest reliable approach for each job. Sometimes that is a no-code tool, sometimes a small custom script. AI is used where it clearly helps, and every AI output that reaches a customer can be reviewed first.',
    industries: [
      ['Real estate', 'Instant lead alerts, site visit reminders and brochure follow-ups.'],
      ['Education', 'Enquiry acknowledgements, admission reminders and fee notices.'],
      ['E-commerce and retail', 'Order updates, stock alerts and review requests.'],
      ['Recruitment and HR', 'Resume sorting, interview scheduling and candidate updates.'],
      ['Finance and accounts', 'Invoice extraction, payment reminders and reconciliation summaries.']
    ],
    priceFactors: ['Number of workflows and steps in each', 'Tools and systems that must be connected', 'Whether AI processing is required, and its usage volume', 'Approval steps and human review screens', 'Monitoring, logging and error handling needs', 'Ongoing running costs of third-party services'],
    faqs: [
      ['What can be automated in a small business?', 'Common starting points are enquiry alerts, follow-up reminders, moving form data into sheets or a CRM, invoice data extraction and weekly reports. We help you pick the one with the biggest time saving.'],
      ['Is AI automation safe to use with customers?', 'We keep a person in the loop for anything customer-facing that could go wrong. AI prepares drafts, and a team member approves them before they are sent.'],
      ['What does automation cost?', 'It depends on the number of workflows, connected tools and AI usage. We share a clear price on a call, and we also explain any monthly running costs of third-party services.'],
      ['Do I need to change my current software?', 'Usually not. Most automations connect the tools you already use through their APIs or integrations.'],
      ['What happens if an automation fails?', 'Every flow has logs and error alerts, and can be paused easily. We note who to contact and how it is fixed.'],
      ['Can you add AI to our existing CRM or website?', 'Often, yes. AI features such as reply drafting, lead summaries or document reading can be added to existing systems through APIs.']
    ],
    related: ['crm-development', 'custom-software-development', 'erp-development', 'digital-marketing']
  },
  {
    slug: 'website-development', short: 'Web Development', icon: 'browser', contact: 'Custom Software & Web Apps',
    name: 'Website Development',
    nav: 'Website development',
    seoTitle: 'Website Development Company in Faridabad | Business Websites | Goforge Digital',
    desc: 'Website design and development in Faridabad: fast, mobile-friendly, SEO-ready business websites with enquiry forms and an easy admin panel. Built by an MSME-registered studio.',
    h1: 'Website Design and Development Company in Faridabad',
    lede: 'Fast, mobile-friendly business websites that explain what you do clearly, appear in search and turn visitors into enquiries.',
    intro: [
      'Your website is often the first place a customer checks before calling you. If it loads slowly, looks broken on a phone or does not explain your services clearly, people move on to a competitor. A well-built website does three jobs: it builds trust, it helps Google understand your business, and it makes contacting you effortless.',
      'Goforge Digital designs and develops business websites in Faridabad for companies, schools, clinics and professionals. Every site is built for speed, written in plain language, set up with search basics from day one and handed over with an admin panel so you can update content yourself.'
    ],
    problems: [
      ['The site looks outdated', 'An old design makes a good business look small. A clean, modern layout builds trust in seconds.'],
      ['Slow on mobile', 'Most visitors arrive on phones. We build lightweight pages that load quickly on mobile networks.'],
      ['Not found on Google', 'Missing titles, structure and local signals keep sites invisible. Search basics are included in every build.'],
      ['Few enquiries', 'Visitors leave without contacting you. Clear calls to action and short forms make it easy to get in touch.'],
      ['Hard to update', 'Small edits need a developer. An admin panel lets your team change text, images and listings.'],
      ['Enquiries go nowhere', 'Form messages get lost in an inbox. Every enquiry is saved and alerts the right person immediately.']
    ],
    modules: [
      ['Business and company websites', 'Home, about, services, work and contact pages written around what your customers search for.'],
      ['Landing pages', 'Focused pages for a campaign, product or service, built to convert ad and search traffic.'],
      ['Admin panel', 'Simple editing for text, images, team, listings and announcements without touching code.'],
      ['Enquiry and booking forms', 'Short forms that save every submission and notify your team by email or SMS.'],
      ['SEO foundations', 'Page titles, meta descriptions, headings, structured data, sitemap and fast loading built in.'],
      ['Local search setup', 'Address, map, opening hours and consistent business details that support local rankings.'],
      ['Analytics', 'Visitor and enquiry tracking so you can see which pages and sources bring results.'],
      ['Hosting, security and care', 'HTTPS, backups, updates and monitoring, with hosting in an account you own.']
    ],
    process: [
      ['Goals and content plan', 'We agree who the site is for, the pages needed and the main action visitors should take.'],
      ['Structure and wireframes', 'A page map and simple layouts so the flow is right before design details.'],
      ['Design', 'A visual design in your brand colours and fonts, reviewed on desktop and mobile.'],
      ['Development', 'Fast, accessible pages built and connected to forms, admin panel and analytics.'],
      ['Content and SEO checks', 'Copy, images, titles and structured data checked, and the sitemap submitted to Google.'],
      ['Launch and handover', 'Go live on your domain, then a short guide on how to update the site yourself.']
    ],
    tech: ['HTML, CSS and JavaScript', 'Node.js and server-rendered pages', 'React and Next.js where needed', 'WordPress when it is the better fit', 'Structured data (schema.org)', 'Google Analytics and Search Console', 'Vercel and cloud hosting'],
    techNote: 'We build with technology that keeps pages fast and secure. For content-heavy sites where your team prefers WordPress, we can use it; for custom features and performance, we build lean code with our own admin panel.',
    industries: [
      ['Real estate', 'Project pages, enquiry forms and listing management.'],
      ['Schools and colleges', 'Admissions information, notices, galleries and enquiry capture.'],
      ['Clinics and professionals', 'Service pages, appointment requests and local search visibility.'],
      ['Manufacturers and exporters', 'Product catalogues, capability pages and enquiry routing.'],
      ['Startups', 'A sharp first website or landing page to explain a new product.']
    ],
    priceFactors: ['Number of pages and page types', 'Custom design versus a refined standard layout', 'Admin panel features and content types', 'Forms, booking, payments or other integrations', 'Copywriting and image preparation', 'Hosting and ongoing care plan'],
    faqs: [
      ['How much does a business website cost in Faridabad?', 'It depends on the number of pages, design depth and features such as an admin panel or booking. We share a clear written price on a call after understanding what the site needs to do.'],
      ['Will my website be mobile-friendly and fast?', 'Yes. Every site is designed for phones first and tested for speed, because most visitors and Google both judge sites on mobile.'],
      ['Do you include SEO?', 'Every build includes SEO foundations: proper titles, descriptions, headings, structured data, a sitemap and Search Console setup. Ongoing SEO work is available through our digital marketing service.'],
      ['Can I update the website myself?', 'Yes. We include an admin panel or a CMS so you can edit text, images and listings without a developer.'],
      ['Can you redesign my existing website?', 'Yes. We review the current site, keep what works, protect existing search rankings with redirects and rebuild the rest.'],
      ['Who owns the domain and hosting?', 'You do. The domain, hosting and logins are set up in your name and handed over at launch.']
    ],
    related: ['digital-marketing', 'custom-software-development', 'crm-development', 'school-management-software']
  },
  {
    slug: 'digital-marketing', icon: 'megaphone', contact: 'Digital Marketing, SEO & Ads',
    name: 'Digital Marketing',
    nav: 'Digital marketing',
    seoTitle: 'Digital Marketing Agency in Faridabad | SEO, Social & Ads | Goforge Digital',
    desc: 'Digital marketing in Faridabad: local SEO, Google Business Profile, social media and performance ads with budgets you control and plain monthly reports.',
    h1: 'Digital Marketing, SEO and Ads in Faridabad',
    lede: 'Local SEO, Google Business Profile, social media and performance ads planned around real enquiries, with your ad budget visible in your own account.',
    intro: [
      'Customers in Faridabad and Delhi NCR search on Google and Maps, scroll social media and click ads before they pick a business. Digital marketing puts you in front of them at the right moment. Done well, it is measurable: you can see where enquiries come from and what each one costs.',
      'Goforge Digital offers straightforward digital marketing for small and growing businesses. We start with the foundations, a complete Business Profile, a website Google can understand and consistent listings, then add social content and paid campaigns with budgets you approve. Reports are short and plain, focused on enquiries rather than vanity numbers.'
    ],
    problems: [
      ['Invisible on Google Maps', 'Incomplete or unverified profiles rarely show. We complete and optimise your Business Profile for local searches.'],
      ['Website gets little traffic', 'Pages lack the words customers use. On-page SEO aligns content with real local search terms.'],
      ['Ads spend without results', 'Broad targeting wastes budget. Focused campaigns target the right areas, searches and audiences.'],
      ['Social pages are inactive', 'Irregular posting makes a business look closed. A simple content calendar keeps pages active and on-brand.'],
      ['No idea what works', 'Without tracking, marketing is guesswork. Conversion tracking ties enquiries to their source.'],
      ['Few reviews', 'Reviews strongly influence local choices. We set up an easy process to ask happy customers for reviews.']
    ],
    modules: [
      ['Google Business Profile', 'Categories, services, photos, hours, posts and review requests set up and kept current.'],
      ['Local SEO', 'Location pages, consistent business listings and citations on trusted Indian directories.'],
      ['On-page and technical SEO', 'Titles, descriptions, headings, internal links, speed and structured data improvements.'],
      ['Content marketing', 'Helpful articles and service content that answer what your customers are searching for.'],
      ['Social media management', 'Content planning, design and posting on Instagram, Facebook and LinkedIn.'],
      ['Google Ads', 'Search and local campaigns with keyword research, ad copy and negative keywords.'],
      ['Meta ads', 'Facebook and Instagram lead campaigns with clear audiences and tested creatives.'],
      ['Tracking and reporting', 'Analytics, conversion tracking and a plain monthly report of enquiries and spend.']
    ],
    process: [
      ['Audit', 'Review your website, profile, listings, competitors and any past campaigns.'],
      ['Plan and budget', 'Agree target areas, services to promote, channels and a monthly ad budget you control.'],
      ['Fix the foundations', 'Complete the Business Profile, on-page SEO and tracking before spending on ads.'],
      ['Launch campaigns', 'Start content and ads at a measured budget, with clear goals for enquiries.'],
      ['Optimise', 'Adjust keywords, audiences and creatives weekly based on real results.'],
      ['Report monthly', 'A short report of what changed, what it produced and what comes next.']
    ],
    tech: ['Google Business Profile', 'Google Search Console', 'Google Analytics 4', 'Google Ads', 'Meta Business Suite and Ads Manager', 'Canva and Figma for creatives', 'Schema.org structured data'],
    techNote: 'Ad accounts, analytics and profiles are created in your name, so you keep full access and history. The media budget is paid to Google or Meta from your account and stays separate from our fee.',
    industries: [
      ['Real estate', 'Project lead campaigns and local search for property enquiries.'],
      ['Education and coaching', 'Admission season campaigns and local visibility for schools and institutes.'],
      ['Clinics and healthcare', 'Local SEO and appointment-focused campaigns.'],
      ['Local services', 'Map visibility and call-focused ads for service businesses.'],
      ['B2B and manufacturing', 'LinkedIn presence, search visibility and enquiry generation.']
    ],
    priceFactors: ['Channels included: SEO, social, Google Ads, Meta ads', 'Number of services and locations to promote', 'Content and creative volume each month', 'Starting condition of the website and profiles', 'Reporting frequency and depth', 'Your separate ad budget, paid directly to the platforms'],
    faqs: [
      ['How long does SEO take to show results?', 'Local profile and on-page improvements can help within weeks, while competitive search rankings usually take a few months of steady work. We report progress honestly each month.'],
      ['What does digital marketing cost?', 'Our fee depends on the channels and volume of work, and is shared on a call. Your ad budget is separate, set by you and paid directly to Google or Meta.'],
      ['Do I own the ad accounts and pages?', 'Yes. Accounts are created or kept in your name, and we work with access you can remove at any time.'],
      ['Can you help with Google reviews?', 'We set up a simple review request process for genuine customers. We never post fake reviews, which also protects your profile from penalties.'],
      ['Which is better, Google Ads or social media ads?', 'Google Ads catches people already searching for your service; social ads build awareness and leads among a chosen audience. Many local businesses start with Google and add social later.'],
      ['Do you guarantee first position on Google?', 'No honest agency can guarantee rankings. We focus on the work that reliably improves visibility and enquiries, and show you the results.']
    ],
    related: ['website-development', 'crm-development', 'ai-automation', 'real-estate-crm']
  },
  {
    slug: 'real-estate-crm', short: 'Real Estate CRM', icon: 'briefcase', contact: 'CRM, ERP & Integrations',
    name: 'Real Estate CRM Software',
    nav: 'Real estate CRM',
    seoTitle: 'Real Estate CRM Software in Faridabad & Delhi NCR | Goforge Digital',
    desc: 'Real estate CRM software for builders, brokers and channel partners in Faridabad and Delhi NCR: project-wise leads, site visits, follow-ups, inventory and booking tracking.',
    h1: 'Real Estate CRM Software for Builders and Brokers',
    lede: 'A CRM made for property sales: project-wise leads, site visit scheduling, unit inventory and booking follow-ups in one system for your sales team.',
    intro: [
      'Property sales in Faridabad and Delhi NCR depend on speed. A buyer who enquires about a project today may visit three other sites this weekend. Builders and brokers receive leads from portals, ads, hoardings, channel partners and walk-ins, and the team that responds first and follows up best usually wins the booking.',
      'Goforge Digital builds real estate CRM software that follows the real sales cycle: enquiry, call, site visit, negotiation, booking and payment follow-up. It can be a fully custom system or a configured CRM connected to your lead sources, depending on your size and budget.'
    ],
    problems: [
      ['Portal leads are scattered', 'Leads from property portals, ads and calls arrive in different inboxes. The CRM collects them into one project-wise list.'],
      ['Slow first response', 'Hot leads cool within hours. Instant assignment and alerts help the team call back quickly.'],
      ['Site visits are hard to track', 'Visits are noted on paper or phones. Scheduling, reminders and visit feedback live on each lead.'],
      ['Unit availability is unclear', 'Sales staff quote units that are already blocked. A live inventory view shows available, held and booked units.'],
      ['Channel partners are unmanaged', 'Broker leads and commissions are tracked in sheets. Partner records and lead tagging keep it fair and clear.'],
      ['Payment follow-ups slip', 'Demand letters and instalment reminders are missed. Booking records include payment schedules and reminders.']
    ],
    modules: [
      ['Multi-source lead capture', 'Website, landing pages, portal exports and ad leads gathered with project and source tags.'],
      ['Project-wise pipelines', 'Separate pipelines for each project with stages from new enquiry to booking.'],
      ['Site visit management', 'Visit scheduling, reminders to buyer and sales executive, and post-visit feedback.'],
      ['Unit inventory', 'Tower, floor and unit status with price lists, holds and booking history.'],
      ['Channel partner module', 'Partner registration, lead attribution and simple commission tracking.'],
      ['Booking and payment tracking', 'Booking details, payment plans, receipts and instalment reminders.'],
      ['Sales team dashboards', 'Calls, visits, bookings and conversion by executive, project and source.'],
      ['Brochures and documents', 'Brochures, price sheets and agreements stored and shared from the lead record.']
    ],
    process: [
      ['Understand your sales flow', 'We map lead sources, team structure, projects and the stages a buyer moves through.'],
      ['Configure projects and inventory', 'Set up projects, towers, units and price lists in the system.'],
      ['Connect lead sources', 'Link website forms, landing pages and ad platforms, and set up portal imports.'],
      ['Train the sales team', 'Practical sessions on logging calls, scheduling visits and updating stages.'],
      ['Go live on one project', 'Start with one project to refine the flow before rolling out to all.'],
      ['Review reports', 'Use early results to improve assignment rules, follow-up timing and dashboards.']
    ],
    tech: ['Custom web CRM (Node.js, React, PostgreSQL)', 'Configured CRMs such as Zoho where suitable', 'Ad platform lead integrations', 'Email and SMS alerts', 'Mobile-friendly screens for field staff', 'Role-based access for teams and partners'],
    techNote: 'Sales executives often work from site offices and on the move, so every screen is designed to work well on a phone. Managers get fuller dashboards on desktop.',
    industries: [
      ['Builders and developers', 'Multiple projects, unit inventory and booking follow-ups.'],
      ['Real estate brokers', 'Buyer and seller leads, listings and deal tracking.'],
      ['Channel partners', 'Lead registration and commission visibility with developers.'],
      ['Property management', 'Tenant enquiries, leases and maintenance requests.'],
      ['Co-working and commercial', 'Space enquiries, tours and contract renewals.']
    ],
    priceFactors: ['Number of projects and units', 'Users across sales, management and partners', 'Lead sources and portal integrations', 'Inventory and booking modules required', 'Custom build versus configured CRM', 'Training and rollout across teams'],
    faqs: [
      ['What is a real estate CRM?', 'It is a CRM designed around property sales, with project-wise leads, site visits, unit inventory and booking follow-ups, rather than a generic sales pipeline.'],
      ['What does a real estate CRM cost?', 'It depends on projects, users and integrations, and whether we build custom or configure an existing CRM. The price is shared on a call after we understand your sales process.'],
      ['Can it import leads from property portals?', 'Many portals provide exports or integrations, and ad platforms can send leads directly. We set up the best available route for each source.'],
      ['Can channel partners use it?', 'Yes. Partners can be given limited access to register leads and see status, without seeing your other data.'],
      ['Will it work on mobile for site staff?', 'Yes. Screens are built to work on phones so executives can update visits and calls from site.'],
      ['Can we start with one project?', 'Yes. Starting with one project lets the team learn the system and lets us refine it before wider rollout.']
    ],
    related: ['crm-development', 'digital-marketing', 'ai-automation', 'website-development']
  },
  {
    slug: 'school-management-software', short: 'School ERP', icon: 'flask', contact: 'CRM, ERP & Integrations',
    name: 'School Management Software',
    nav: 'School software',
    seoTitle: 'School Management Software & ERP in Faridabad | Goforge Digital',
    desc: 'School management software and school ERP in Faridabad: admission enquiries, student records, fees, attendance and parent updates, set up around how your school runs.',
    h1: 'School Management Software and School ERP',
    lede: 'Admission enquiries, student records, fees, attendance and parent communication brought together in one system your office staff can use with ease.',
    intro: [
      'School offices handle a heavy load of administration: admission enquiries during the season, student records, fee collection and receipts, attendance, timetables, notices and a steady flow of parent questions. When this runs on registers and separate spreadsheets, staff spend long hours on paperwork and parents wait for answers.',
      'Goforge Digital builds and sets up school management software for schools in Faridabad and Delhi NCR. We start with the area that matters most to your school, often admission enquiries or fees, and add further modules as your staff grow comfortable. The system is shaped around your classes, fee structure and processes. For student skill programmes, see our separate page for schools.'
    ],
    problems: [
      ['Admission enquiries get lost', 'Calls and walk-ins during admission season are noted on paper. An enquiry system tracks each family from first call to admission.'],
      ['Fee tracking takes hours', 'Dues, receipts and concessions are calculated by hand. The fee module shows dues and generates receipts.'],
      ['Records are scattered', 'Student details sit in files and sheets. One digital record holds each student’s details and history.'],
      ['Attendance is slow to compile', 'Registers are totalled at month end. Digital attendance gives instant class and student summaries.'],
      ['Parents keep calling', 'Parents ask the office about fees, notices and events. Parent updates by SMS and email reduce repeated calls.'],
      ['Reports are hard to prepare', 'Management asks for numbers that take days. Dashboards show admissions, collections and attendance live.']
    ],
    modules: [
      ['Admission enquiry management', 'Capture enquiries from the website and front desk, schedule visits and follow up until admission.'],
      ['Student information system', 'Student profiles, documents, class and section, guardian details and history.'],
      ['Fee management', 'Fee structures, concessions, dues, receipts and collection reports.'],
      ['Attendance', 'Daily class attendance with monthly summaries and absence alerts to parents.'],
      ['Timetable and classes', 'Class, section, subject and teacher allocation with timetables.'],
      ['Exams and report cards', 'Marks entry, grade calculation and printable report cards.'],
      ['Parent communication', 'Notices, circulars, fee reminders and event updates by SMS and email.'],
      ['School website integration', 'Admission forms and notices on your website linked directly to the system.']
    ],
    process: [
      ['School visit or call', 'We understand your classes, fee structure, office workflow and priorities.'],
      ['Choose the first module', 'Agree which module to start with, often admissions or fees.'],
      ['Set up masters', 'Classes, sections, fee heads and student data prepared and imported.'],
      ['Staff training', 'Hands-on training for office staff, accountants and teachers.'],
      ['Go live', 'Switch on at a convenient time in the school calendar, with support close by.'],
      ['Add modules', 'Expand to attendance, exams or parent updates once the first module is settled.']
    ],
    tech: ['Web-based system usable on any device', 'Node.js and React', 'PostgreSQL or MySQL', 'SMS and email gateways', 'Printable receipts and report cards', 'Role-based access for office, teachers and management', 'Secure cloud hosting with backups'],
    techNote: 'Student data is sensitive, so access is restricted by role, actions are logged and backups are scheduled. Data stays in accounts owned by the school.',
    industries: [
      ['CBSE and state board schools', 'Admissions, fees, attendance and parent updates.'],
      ['Play schools and pre-schools', 'Enquiries, admissions and daily updates to parents.'],
      ['Coaching institutes', 'Batch management, fees and student progress.'],
      ['Colleges', 'Admission enquiries, student records and fee tracking.'],
      ['Training centres', 'Enrolments, attendance and certificates.']
    ],
    priceFactors: ['Number of students and branches', 'Modules included in the first phase', 'Data migration from existing records', 'SMS and communication volume', 'Customisation of fee structures and report cards', 'Training and support during the academic year'],
    faqs: [
      ['What is school management software?', 'It is a system that handles a school’s administration, such as admissions, student records, fees, attendance, exams and parent communication, in one place.'],
      ['What does school ERP software cost?', 'It depends on student numbers, branches and modules. We share a clear price on a call after understanding your school’s needs and priorities.'],
      ['Can we start with only admissions or fees?', 'Yes. Starting with one module is often the smoothest way to introduce new software to school staff.'],
      ['Is student data secure?', 'Access is limited by role, changes are logged and backups run regularly. The school owns the data and the hosting account.'],
      ['Will teachers and office staff find it easy?', 'Screens are kept simple and training is hands-on. Most daily tasks take only a few clicks.'],
      ['Do you also offer programmes for students?', 'Yes. Our skills programmes for Classes 5 to 12 are described on our page for schools.']
    ],
    related: ['erp-development', 'crm-development', 'website-development', 'custom-software-development']
  }
];

// Old service URLs keep their search value via 301 redirects.
const REDIRECTS = { software: 'custom-software-development', 'crm-erp': 'crm-development', automation: 'ai-automation', marketing: 'digital-marketing' };

module.exports = { SERVICE_PAGES: PAGES, SERVICE_REDIRECTS: REDIRECTS };
