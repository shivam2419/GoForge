'use strict';
// Fixed copy. Service names are fixed by the brief; the one-line blurbs live in the
// settings table so they can be edited from the admin panel.
const SERVICES = [
  {
    key: 'blurb1', slug: 'custom-software-development', icon: 'code',
    start: 'Usually starts with one tool or one site, scoped to a single job the business does every day.',
    name: 'Custom Software & Web Apps',
    includes: ['Business websites that load fast on a phone', 'Internal tools, dashboards and portals', 'Booking, order and enquiry flows'],
    questions: [
      'What job should this tool do every day, and who will use it?',
      'What do you use today: paper, a spreadsheet, an app or another site?',
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
    key: 'blurb2', slug: 'crm-development', icon: 'database',
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
    key: 'blurb3', slug: 'ai-automation', icon: 'gear',
    start: 'Usually starts with one repeat task, such as a follow-up or a form reply, automated with a person approving what goes out.',
    name: 'AI Automation & Workflows',
    includes: ['Follow-up reminders that go out on time', 'Instant enquiry alerts by email and SMS from your website forms', 'Drafts prepared by AI, approved by a person before they go out'],
    questions: [
      'Which message or task do you repeat most often?',
      'What must a person still approve before it goes out?',
      'Where should the result land: email, SMS, a sheet or your CRM?',
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
    key: 'blurb4', slug: 'digital-marketing', icon: 'megaphone',
    start: 'Usually starts with the basics: a clear profile, pages that can be found, and a small ad budget agreed with you.',
    name: 'Digital Marketing, SEO & Ads',
    includes: ['Google Business Profile and social pages set up properly', 'Search engine optimisation: page titles, speed and local listings', 'Targeted ad campaigns with an agreed budget and clear reports'],
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
  'Free website check',
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
    slug: 'full-stack-web-development', icon: 'browser', name: 'Full Stack Web Development',
    summary: 'Building complete web apps: React front end, Node.js and Express APIs, a database, login and deployment.',
    covers: ['Responsive front ends with HTML, CSS, JavaScript and React', 'REST APIs with Node.js and Express', 'SQL and NoSQL databases', 'Authentication, security and deployment'],
    tools: ['HTML, CSS, JavaScript and TypeScript', 'React', 'Node.js and Express', 'PostgreSQL and MongoDB', 'Git, GitHub and a cloud host'],
    project: 'A deployed full-stack web app with sign-in, a database, a REST API and a responsive React front end, with a short README on how it runs.',
    suits: 'Students who want to build and ship whole products, from the screen a user sees to the server and database behind it.'
  },
  {
    slug: 'digital-marketing', icon: 'megaphone', name: 'Digital Marketing',
    summary: 'Planning content, search basics and small ad campaigns with a visible budget.',
    covers: ['Search basics (SEO) and local listings', 'Planning social media content', 'Setting up ad campaigns and budgets', 'Reading campaign reports'],
    tools: ['Google Business Profile', 'Search Console basics', 'Google Ads or Meta ads with a budget you can see', 'A content calendar', 'A simple weekly report'],
    project: 'A local listing cleaned up, a four-week content plan, and one small campaign plan with the budget written down.',
    suits: 'Students who can write clearly and would rather measure a small campaign than promise viral posts.'
  },
  {
    slug: 'business-analyst', icon: 'briefcase', name: 'Business Analyst',
    summary: 'Turning business needs into clear requirements, process maps and reports a team can build from.',
    covers: ['Requirements gathering and documentation', 'Process mapping with BPMN and UML', 'Excel, SQL and Power BI for analysis', 'Agile delivery with Jira and user testing'],
    tools: ['Excel and Google Sheets', 'SQL', 'Power BI', 'Jira and Confluence', 'draw.io or Lucidchart', 'Figma for wireframes'],
    project: 'A business requirements document, process maps, a prioritised backlog of user stories and a KPI dashboard for a real business problem.',
    suits: 'Students who enjoy asking questions, writing clearly and connecting what a business needs with what a team builds.'
  },
  {
    slug: 'data-science', icon: 'flask', name: 'Data Science',
    summary: 'Using Python, statistics and machine learning to find patterns in data and predict what happens next.',
    covers: ['Python, statistics and exploratory analysis', 'Machine learning with scikit-learn', 'Deep learning, NLP and time series basics', 'Model evaluation, deployment and storytelling'],
    tools: ['Python and Jupyter', 'NumPy, Pandas and Matplotlib', 'SQL', 'scikit-learn', 'TensorFlow or PyTorch', 'Streamlit'],
    project: 'An end-to-end prediction project: cleaned data, a tested model, a short findings report and a small deployed demo app.',
    suits: 'Students who are curious about numbers, comfortable with some maths and want to build models that answer real questions.'
  }
];
const SIMILAR_ROLE = 'Similar role (describe it in your note)';
const TRACKS = TRACK_DETAILS.map(t => t.name).concat([SIMILAR_ROLE]);

// The two programmes a student can choose. Edit here; the /internship cards, the programme
// pages, the counselling form, the brochure, the FAQ and the Course JSON-LD all read this list.
// price is the festive launch price in rupees, all-inclusive and paid once (no instalments).
// Batch dates, the seat cap and the referral offer live in lib/batch.js.
const CAREER_TRACKS = [
  {
    slug: '3-month', name: '3-Month Programme', short: '3 Months', months: 3, iso: 'P3M', price: 1499,
    trainingMonths: 1, internshipMonths: 2,
    bestFor: 'A semester or summer internship requirement',
    who: 'Students who need a 4 to 8-week internship letter, or want a first real project alongside college.',
    includes: ['1 month of live online training', '2-month supervised internship on a project', 'Training certificate + internship letter with dates and hours']
  },
  {
    slug: '6-month', name: '6-Month Programme', short: '6 Months', months: 6, iso: 'P6M', price: 1999,
    trainingMonths: 3, internshipMonths: 3,
    bestFor: 'Final years, graduates and 6-month requirements',
    who: 'Final-year students and graduates who want deeper training, more project time and a portfolio to show employers.',
    includes: ['3 months of live online training', '3-month supervised internship on real projects', 'Capstone + training certificate + internship letter']
  }
];
const careerTrackLabel = t => t.name + ' (' + t.trainingMonths + ' month' + (t.trainingMonths > 1 ? 's' : '') + ' training + ' + t.internshipMonths + ' months internship)';
const CAREER_TRACK_OPTIONS = CAREER_TRACKS.map(careerTrackLabel).concat(['Not sure yet, help me choose']);
const TRACK_RANGE = '3 or 6 months';

const PROCESS = [
  { name: 'Discovery call', text: 'A free call to understand your business, your users and the goal.', out: 'Goals and priorities agreed' },
  { name: 'Proposal', text: 'A written scope, timeline and one clear price, shaped to your budget.', out: 'Signed scope and quote' },
  { name: 'Design', text: 'Wireframes and screens you review and approve before the build starts.', out: 'Approved designs' },
  { name: 'Build', text: 'Development in short rounds with a working demo you can click through.', out: 'Weekly progress demos' },
  { name: 'Testing', text: 'Checks on phones, browsers, speed, security and every key flow.', out: 'Tested, ready-to-launch build' },
  { name: 'Launch', text: 'Go live on your domain with hosting, analytics and search set up.', out: 'Live product + team walkthrough' },
  { name: 'Support', text: '30 days of included support, then optional care and improvements.', out: 'Ongoing care and growth' }
];

const STATUSES = ['New', 'Contacted', 'Closed'];

const BRAND = {
  name: 'Goforge Digital',
  tagline: 'Digital Solutions & Growth',
  founder: 'Rohit Sharma',
  founderRole: 'Founder & Director',
  founderEmail: 'rohit@goforgedigital.com',
  website: 'goforgedigital.com',
  address: { line1: 'D125b, 1st Floor, Puri Highstreet', line2: 'Sector 81, Faridabad', locality: 'Faridabad', region: 'Haryana', postalCode: '121001', country: 'IN' },
  googleProfile: 'https://www.google.com/search?kgmid=/g/11zzp3hg4p',
  instagram: 'https://www.instagram.com/goforgedigital/',
  linkedin: 'https://www.linkedin.com/in/rohit-sharma-bb9983258/',
  linkedinCompany: 'https://www.linkedin.com/company/143989208',
  mapQuery: 'Puri Highstreet, Sector 81, Faridabad, Haryana',
  hours: [
    ['Monday to Saturday', '10:00 to 18:30'],
    ['Sunday', 'Closed']
  ],
  hoursNote: 'Call before you visit.'
};

const WHY_SMALL = [
  { title: 'You speak to the people doing the work', text: 'Rohit Sharma, Founder & Director, and the team who will build it are on the call. There is no account manager passing a brief down a corridor.' },
  { title: 'Proven and focused', text: 'A focused team that gives every project dedicated attention, from first call to launch.' },
  { title: 'A clear plan, agreed first', text: 'A clear plan agreed before work begins, shaped to your goals and budget.' },
  { title: 'Transparent results', text: 'Every figure we share comes with a clear definition, and client work is showcased with permission.' }
];

// FAQ items with `until` (a timestamp) hide themselves after that moment; see visibleFaq().
const { KEY_DATES } = require('./batch');
const REGISTRATION_CLOSES = KEY_DATES.registrationCloses;
const DIWALI_BREAK_ENDS = Date.parse('2026-11-12T00:00:00+05:30');
const FAQ = [
  {
    id: 'students',
    title: 'For students',
    items: [
      {
        q: 'What makes Goforge Digital different from other learning platforms?',
        a: 'You learn in live online classes from working professionals, then use those skills on real studio work during a supervised internship. Every assignment is reviewed by a mentor, batches stay small, and you finish with projects you can confidently explain in an interview.'
      },
      {
        q: 'How can I register for an internship?',
        a: 'Fill in the contact form, then submit the application form for the programme you want. Our team reviews your application and schedules an interview call with you to discuss your goals, the programme and the next batch.',
        link: ['/internship#apply', 'Open the application form']
      },
      {
        q: 'What domains are available for internships?',
        a: 'Seven programmes: Software Engineering, AI/ML Engineer, Data Analyst, Full Stack Web Development, Digital Marketing, Business Analyst and Data Science. Interested in a related field? Apply with "Similar role" and name it in your note.',
        link: ['/internship#programs', 'See all programmes']
      },
      {
        q: 'Are the internship certificates verified?',
        a: 'Yes. Every training certificate and internship letter carries a unique certificate ID that colleges and employers can check with us. Goforge Digital is an MSME (Udyam) registered company.',
        link: ['/verify', 'Verify a certificate']
      },
      {
        q: 'How long are the programmes?',
        a: 'There are two: the 3-Month Programme (1 month of live online training, then a 2-month supervised internship) and the 6-Month Programme (3 months of live online training, then a 3-month supervised internship). Choose the one that matches your college requirement and your goal.',
        link: ['/internship#tracks', 'Compare the two programmes'], top: true
      },
      {
        q: 'How much does the programme cost?',
        a: 'The festive launch price is ₹1,499 for the 3-Month Programme and ₹1,999 for the 6-Month Programme. It is all-inclusive: live classes, study material, assignments, projects, the internship, the training certificate and the internship letter. It is paid once, with no instalments, and nothing is charged before you have spoken with us.', top: true
      },
      {
        q: 'What are the batch timings?',
        a: 'Both batches are live online. Weekday batch: Monday to Friday, 7:30 to 9:00 PM IST, starting Mon 2 Nov 2026; Fridays are doubt and project sessions. Weekend batch: Saturday and Sunday, 11:00 AM to 2:00 PM IST with a 15-minute break; orientation on Sun 1 Nov, classes from Sat 14 Nov 2026. Each batch is capped at 25 students. Registration closes on Wed 28 Oct 2026.', until: REGISTRATION_CLOSES, top: true
      },
      {
        q: 'Is there a Diwali break?',
        a: 'Yes. The weekday batch starts on Mon 2 Nov, breaks for Diwali from 7 to 11 Nov and resumes on Thu 12 Nov. The weekend batch has its orientation on Sun 1 Nov and starts classes on Sat 14 Nov, after the festival.', until: DIWALI_BREAK_ENDS, top: true
      },
      {
        q: 'What if I miss a class?',
        a: 'Every live class is recorded, so you can watch it later and bring your questions to the next doubt session. On the weekday batch, Fridays are kept for doubts and project work.', top: true
      },
      {
        q: 'What if my college exams fall during the programme?',
        a: 'Tell us your exam dates when you enrol. You can pause during your exams and catch up from the recordings, or switch once to the January 2027 batch at no cost.', top: true
      },
      {
        q: 'How big is a batch?',
        a: 'Each batch is capped at 25 students, so a mentor can review every assignment and project. The weekday batch and the weekend batch each have their own 25 seats.', top: true
      },
      {
        q: 'Do you offer job placement?',
        a: 'No. We do not promise jobs or placements. What you get is live training, real projects you can show in interviews, a training certificate and an internship letter that describes the work you actually did.', top: true
      },
      {
        q: 'Is the programme AICTE approved?',
        a: 'No. This is private industry training and an internship with Goforge Digital, an MSME (Udyam) registered software company. It is not an AICTE-approved course, and we do not claim it is. Your internship letter is issued by Goforge Digital. Only your college can confirm whether it accepts the internship, so please check its rules before you enrol.', top: true
      },
      {
        q: 'How does the referral offer work?',
        a: 'Your friend gets ₹200 off, and you get ₹200 by UPI once your friend completes their first week. Your friend should write your name or phone number in the "Referred by" field when booking a call or applying.', top: true
      },
      {
        q: 'How does the programme work?',
        a: 'Seven steps, in this order: apply and sit a free demo class, a counselling call, enrolment (you get the study material), live online training, assignments and projects, an internship offer, and finally the training certificate and internship letter. How long training and internship run depends on the programme you choose: 3 or 6 months.'
      },
      {
        q: 'Will my college accept this?',
        a: 'Only your college can decide that, so please check its internship rules (the number of weeks or hours, the dates, and whether it needs an NOC or its own format) before you choose a programme. What we can promise is the paperwork: your internship letter names Goforge Digital, an MSME (Udyam) registered company, your role, the exact start and end dates, the hours if your college counts them, and the work you did. It is signed by Rohit Sharma, Founder & Director, with a phone number, an email and a certificate ID that your college can verify. Tell us your requirement and deadline on the counselling call and we will suggest the programme that matches it, or tell you honestly if neither does.',
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
        q: 'What does the 98% success rate mean?',
        a: 'It is the share of our students who completed the training and went on to successfully finish their internship project with us.'
      },
      {
        q: 'How is my project chosen?',
        a: 'We match the role you applied for. You work on real studio work or an industry-style project of the same shape, reviewed by a mentor. Your letter describes exactly what you built.'
      },
      {
        q: 'Is the demo class the same as joining?',
        a: 'The demo class is one free live session so you can experience the training first. After it, a counselling call confirms your programme and batch, and you enrol when you are ready.'
      },
    ]
  },
  {
    id: 'parents',
    title: 'For parents',
    items: [
      { q: 'How much does the programme cost?', a: 'The festive launch price is ₹1,499 for the 3-Month Programme and ₹1,999 for the 6-Month Programme, all-inclusive and paid once, with no instalments. Nothing is charged before you have spoken with us and, if you like, attended a free demo class.', link: ['/counselling', 'Book a free counselling call'] },
      { q: 'What if my child needs to stop or change plans?', a: 'Our refund policy is written down and available before you enrol. It explains when a refund applies and how long it takes, so you know the terms in advance.', link: ['/refund', 'Read the refund policy'] },
      { q: 'What does the certificate prove?', a: 'The training certificate confirms that your child completed the named programme on the stated dates. The internship letter names the role, dates and the work done. Each document carries a unique ID that colleges and employers can check with us.', link: ['/verify', 'How verification works'] },
      { q: 'Is it safe, and who supervises the students?', a: 'Classes are live and online, taught and reviewed by our instructors and mentors. During the internship each student works on assigned tasks with a named supervisor and regular check-ins. We contact students only through the details they share with us.' },
      { q: 'Can we visit or speak to someone first?', a: 'Yes. Our office is at Puri Highstreet, Sector 81, Faridabad, and you are welcome to call before visiting or book a counselling call to ask any question.', link: ['/contact', 'Contact details'] }
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
        q: 'What is the free website check?',
        a: 'It is a short look at whether your site (if you have one) can be found on Google, works well on a phone, and turns visitors into enquiries. You get a clear note of quick wins and next steps, free of charge.'
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
    name: 'Free website check',
    text: 'A short review of your website, search visibility and enquiry flow. You get a clear note of quick wins and next steps.'
  },
  demo: {
    name: 'Free demo class',
    text: 'One live online session in the role you are considering, so you can see the teaching before you decide. It does not reserve a seat.'
  }
};

const TECH_STACK = ['Python', 'JavaScript', 'HTML & CSS', 'Node.js', 'React', 'SQL', 'Git & GitHub', 'REST APIs', 'Pandas', 'Jupyter', 'Excel & Google Sheets', 'Power BI', 'AI APIs', 'Google Business Profile', 'Search Console', 'Google Ads', 'Meta Ads'];

const visibleFaq = (now = Date.now()) => FAQ.map(g => ({ ...g, items: g.items.filter(i => !i.until || now <= i.until) }));

module.exports = {
  visibleFaq, TECH_STACK, SERVICES, CONTACT_SERVICES, TRACKS, TRACK_DETAILS, SIMILAR_ROLE, PROCESS, STATUSES, BRAND,
  WHY_SMALL, FAQ, OFFERS, CAREER_TRACKS, CAREER_TRACK_OPTIONS, TRACK_RANGE, careerTrackLabel
};
