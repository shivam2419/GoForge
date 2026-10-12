'use strict';
// Fixed copy. Service names are fixed by the brief; the one-line blurbs live in the
// settings table so they can be edited from the admin panel.
const SERVICES = [
  {
    key: 'blurb1', slug: 'software', icon: 'code',
    start: 'Usually starts with one tool or one site, scoped to a single job the business does every day.',
    name: 'Custom Software & Web Apps',
    includes: ['Business websites that load fast on a phone', 'Internal tools, dashboards and portals', 'Booking, order and enquiry flows'],
    questions: [
      'What job should this tool do every day, and who will use it?',
      'What do you use now — paper, WhatsApp, a spreadsheet, or another site?',
      'What must the first version include, and what can wait?',
      'Who needs to sign in, and what should they not be able to see?'
    ],
    handover: [
      'The working site or tool, on an account you can access',
      'A short written note on how to add, edit and publish',
      'The login details and where the work is hosted',
      'A list of what was left for a later version, if anything'
    ]
  },
  {
    key: 'blurb2', slug: 'crm-erp', icon: 'database',
    start: 'Usually starts by listing where leads and records live today, then joining the two or three places that matter most.',
    name: 'CRM, ERP & Integrations',
    includes: ['Lead and customer records in one place', 'Stock, billing and operations set up to match the business', 'Connections between the tools the team already uses'],
    questions: [
      'Where do new enquiries arrive today, and who replies?',
      'Which records must be in one list: leads, customers, stock, or fees?',
      'Which tools should stay, and which should be replaced?',
      'What does a missed follow-up cost you in a normal week?'
    ],
    handover: [
      'The system your team will actually open',
      'The fields and stages named in your words',
      'A short note on how a new enquiry becomes a record',
      'Who to call if a connection between two tools stops'
    ]
  },
  {
    key: 'blurb3', slug: 'automation', icon: 'gear',
    start: 'Usually starts with one repeat task, such as a follow-up or a form reply, automated with a person approving what goes out.',
    name: 'AI Automation & Workflows',
    includes: ['Follow-up reminders that go out on time', 'Website forms that turn into WhatsApp or email messages', 'Drafts prepared by AI, approved by a person before they go out'],
    questions: [
      'Which message or task do you repeat most often?',
      'What must a person still approve before it goes out?',
      'Where should the result land: WhatsApp, email, or a sheet?',
      'What should never be sent automatically?'
    ],
    handover: [
      'One working flow, not a pile of unused tools',
      'A note on what is automatic and what a person still checks',
      'How to pause the flow',
      'What we will not let the system send on its own'
    ]
  },
  {
    key: 'blurb4', slug: 'marketing', icon: 'megaphone',
    start: 'Usually starts with the basics: a clear profile, pages that can be found, and a small ad budget agreed with you.',
    name: 'Digital Marketing, SEO & Ads',
    includes: ['Google Business Profile and social pages set up properly', 'Search basics: page titles, speed, local listings', 'Ad campaigns with a budget agreed up front and reported plainly'],
    questions: [
      'Who should find you, and in which area?',
      'Do you already have a Google Business Profile, a site, and a page people can message?',
      'What budget are you willing to spend on ads, separate from our fee?',
      'How will you tell a useful enquiry from a useless one?'
    ],
    handover: [
      'Access to the profiles and ad account, in your name',
      'A short report of what was changed',
      'The ad budget, visible in your own account',
      'What to keep doing after the first month'
    ]
  }
];

const CONTACT_SERVICES = SERVICES.map(s => s.name).concat([
  'Free website and WhatsApp check',
  'Free demo class',
  'Not sure yet'
]);

const TRACK_DETAILS = [
  {
    slug: 'software-engineering', icon: 'code', name: 'Software Engineering',
    summary: 'Building and maintaining features in a real codebase, working from a written task.',
    covers: ['Git, branches and code review basics', 'Back-end and API basics', 'Debugging and writing simple tests', 'Breaking a task into steps and reporting progress'],
    tools: ['JavaScript or Python', 'Git and GitHub', 'A relational database and basic SQL', 'REST APIs', 'Simple automated tests'],
    project: 'A small feature in a studio project: a form that saves a record, a list with a filter, and a short note on how you tested it.',
    suits: 'Students who have written some code already and want to practise finishing a task, not only watching tutorials.'
  },
  {
    slug: 'ai-ml-engineer', icon: 'spark', name: 'AI/ML Engineer',
    summary: 'Using Python and AI models inside small, practical tools, with a person checking the output.',
    covers: ['Python for data and models', 'Calling AI APIs from a small app or workflow', 'Preparing and cleaning data', 'Checking results and noting where a model gets it wrong'],
    tools: ['Python', 'Jupyter or a plain script', 'Pandas for tables', 'An AI API used with a written prompt', 'A simple check sheet for wrong answers'],
    project: 'A small tool that drafts a reply or sorts records, plus a note of ten cases where the draft was wrong and what you changed.',
    suits: 'Students who are comfortable with Python basics and want to build practical AI applications.'
  },
  {
    slug: 'data-analyst', icon: 'chart', name: 'Data Analyst',
    summary: 'Turning raw records into clear tables, charts and short written findings.',
    covers: ['Spreadsheets and SQL', 'Cleaning and joining data', 'Simple dashboards', 'Writing findings in plain language'],
    tools: ['Excel or Google Sheets', 'SQL', 'Power BI or a similar dashboard tool', 'A spreadsheet of checks before a chart is trusted'],
    project: 'A cleaned dataset, an interactive dashboard, and a one-page insight report.',
    suits: 'Students who like tables more than pages, and enjoy turning numbers into clear stories.'
  },
  {
    slug: 'web-developer', icon: 'browser', name: 'Web Developer',
    summary: 'Building pages and forms that load quickly and work well on a phone.',
    covers: ['HTML, CSS and JavaScript', 'Responsive layouts', 'Forms and basic back-end', 'Speed and accessibility basics'],
    tools: ['HTML, CSS and JavaScript', 'Responsive layout', 'A form that validates', 'Basic accessibility checks', 'React for interactive apps'],
    project: 'A small business page with a working enquiry form, checked on a phone, with the fields saved somewhere the studio can read.',
    suits: 'Students who want to ship pages people can use. React is taught when the project needs it, not as a badge.'
  },
  {
    slug: 'digital-marketing', icon: 'megaphone', name: 'Digital Marketing',
    summary: 'Planning content, search basics and small ad campaigns with a visible budget.',
    covers: ['Search basics (SEO) and local listings', 'Planning social media content', 'Setting up ad campaigns and budgets', 'Reading campaign reports'],
    tools: ['Google Business Profile', 'Search Console basics', 'Google Ads or Meta ads with a budget you can see', 'A content calendar', 'A simple weekly report'],
    project: 'A local listing cleaned up, a four-week content plan, and one small campaign plan with the budget written down.',
    suits: 'Students who can write clearly and would rather measure a small campaign than promise viral posts.'
  }
];
const SIMILAR_ROLE = 'Similar role (describe it in your note)';
const TRACKS = TRACK_DETAILS.map(t => t.name).concat([SIMILAR_ROLE]);

const PROCESS = [
  { name: 'Listen', text: 'What the business is trying to do, and what is in the way.' },
  { name: 'Shape', text: 'A small scope and a clear price.' },
  { name: 'Build', text: 'Software, a system, or a campaign, with progress the client can see.' },
  { name: 'Hand over', text: 'Something the team can run, plus a short note on how.' }
];

const STATUSES = ['New', 'Contacted', 'Closed'];

const BRAND = {
  name: 'Goforge Digital',
  tagline: 'Digital Solutions & Growth',
  founder: 'Rohit Sharma',
  founderRole: 'Founder & Director',
  website: 'goforgedigital.com',
  address: { line1: 'D125b, 1st floor, Puri Highstreet', line2: 'Sector-8, Faridabad', locality: 'Faridabad', region: 'Haryana', country: 'IN' },
  instagram: 'https://www.instagram.com/goforgedigital/',
  linkedin: 'https://www.linkedin.com/in/rohit-sharma-bb9983258/',
  mapQuery: 'Puri Highstreet, Sector 8, Faridabad, Haryana',
  hours: [
    ['Monday to Saturday', '10:00 to 18:30'],
    ['Sunday', 'Closed']
  ],
  hoursNote: 'Call before you visit.'
};

const WHY_SMALL = [
  { title: 'You speak to the people doing the work', text: 'Rohit Sharma, Founder & Director, and the team who will build it are on the call. There is no account manager passing a brief down a corridor.' },
  { title: 'Proven and focused', text: '150+ projects delivered, with a team that gives every project dedicated attention.' },
  { title: 'Scope and price in writing', text: 'Work starts after one written scope and one price. Clear pricing from day one, shaped to your budget.' },
  { title: 'Transparent results', text: 'Every figure we share comes with a clear definition, and client work is showcased with permission.' }
];

const FAQ = [
  {
    id: 'students',
    title: 'For students',
    items: [
      {
        q: 'How does the programme work?',
        a: 'Seven steps, in this order: apply and sit a free demo class, a counselling call, enrolment (you pay the training fee and get the study material), live online training, assignments and projects, an internship offer, and finally the training certificate and internship letter. The lengths and fees on each programme page are the current ones. Batch dates are confirmed on the call.'
      },
      {
        q: 'Is the certificate accepted by colleges?',
        a: 'Yes. Goforge Digital is an MSME-registered company, and our training certificate and internship letter are accepted by colleges for internship requirements and recognised by industry. The letter is signed and carries contact details, so your college or a future employer can confirm it. If your college needs a specific format, a set number of hours, or an NOC, tell us on the counselling call and we will prepare it.'
      },
      {
        q: 'What does the letter include?',
        a: 'When you complete the internship, your letter names Goforge Digital, your name, your college and course, the role, the exact start and end dates, that the work was online, a summary of the work you delivered, and a signatory: Rohit Sharma, Founder & Director, with a phone number and email for verification. Hours can be included if your college counts credit in hours. You also receive a separate training certificate.'
      },
      {
        q: 'Who teaches the classes?',
        a: 'Our team of 10+ instructors and mentors, led by Rohit Sharma, Founder & Director. Each programme has instructors who work in that field. You can ask on the counselling call who will teach your batch.'
      },
      {
        q: 'What does the fee include, and is the training paid?',
        a: 'Yes, the training is paid. The fee covers the live classes, study material, assignments with reviews, projects, doubt sessions and the training certificate. Each programme page shows the fee, or says "Contact for fees" if it is confirmed on the call. The internship offer comes after you finish the training.'
      },
      {
        q: 'What does the 98% success rate mean?',
        a: 'It is the share of our students who completed the training and went on to successfully finish their internship project with us.'
      },
      {
        q: 'How is my project chosen?',
        a: 'We match the role you applied for. You work on real studio work or an industry-style project of the same shape, reviewed by a mentor. Your letter describes exactly what you built.'
      },
      {
        q: 'Is the demo class the same as joining?',
        a: 'The demo class is one free live session so you can experience the training first. After it, a counselling call confirms your programme, batch and fee, and you enrol when you are ready.'
      },
    ]
  },
  {
    id: 'clients',
    title: 'For clients',
    items: [
      {
        q: 'How does a project start?',
        a: 'You tell us what the business is trying to do and what is in the way. On a short call we ask where the work lives today, who will use the result, and what the first version must include. We then send one written scope and one price. Nothing is built before you accept that in writing.'
      },
      {
        q: 'How is the work priced?',
        a: 'Every project is priced to its written scope, because a website, a CRM and an ad campaign are different jobs. If you want to start smaller, we plan a focused first step that fits your budget. The price you accept is the price you pay. For ads, the money spent on the ads themselves sits in your own ad account and is separate from our fee.'
      },
      {
        q: 'What is the free website and WhatsApp check?',
        a: 'It is a short look at whether your site (if you have one) can be found and used on a phone, and whether a WhatsApp enquiry has a next step. You get a clear note of quick wins and next steps, free of charge.'
      },
      {
        q: 'Who do I deal with?',
        a: 'Rohit Sharma, Founder & Director, and the team who will build your project. We are in Faridabad and also work remotely. You work directly with the people building your project from start to finish.'
      }
    ]
  }
];

const OFFERS = {
  check: {
    name: 'Free website and WhatsApp check',
    text: 'A short look at your site and how WhatsApp enquiries are handled. You get a clear note of quick wins and next steps.'
  },
  demo: {
    name: 'Free demo class',
    text: 'One live online session in the role you are considering, so you can see the teaching before you decide. It does not reserve a seat.'
  }
};

const TECH_STACK = ['Python', 'JavaScript', 'HTML & CSS', 'Node.js', 'React', 'SQL', 'Git & GitHub', 'REST APIs', 'Pandas', 'Jupyter', 'Excel & Google Sheets', 'Power BI', 'AI APIs', 'Google Business Profile', 'Search Console', 'Google Ads', 'Meta Ads'];

module.exports = {
  TECH_STACK, SERVICES, CONTACT_SERVICES, TRACKS, TRACK_DETAILS, SIMILAR_ROLE, PROCESS, STATUSES, BRAND,
  WHY_SMALL, FAQ, OFFERS
};
