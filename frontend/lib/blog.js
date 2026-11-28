'use strict';
// Short, practical articles for students and colleges. Plain data: add an object to POSTS to publish another.
// Block types: { h: 'Heading' }, { p: 'Paragraph' }, { ul: ['Point', ...] }, { code: 'git status' }.
// Keep every claim true and avoid dates, fees or seat numbers here; the programme pages carry those and stay current.
const POSTS = [
  {
    slug: 'three-git-commands-to-learn-first',
    title: 'Three Git commands to learn first: clone, commit, push',
    summary: 'Git looks bigger than it is. These three commands, plus two helpers, cover most of a first project.',
    topic: 'Skills', read: 3,
    body: [
      { p: 'Git keeps the history of your project, and GitHub keeps a shared copy online. You can use both from day one with just a handful of commands.' },
      { h: '1. git clone: get a project onto your computer' },
      { code: 'git clone https://github.com/your-name/your-project.git' },
      { p: 'This copies a repository, with its full history, into a new folder. You do it once per project.' },
      { h: '2. git commit: save a snapshot' },
      { code: 'git add .\ngit commit -m "Add contact form validation"' },
      { p: 'git add chooses what goes into the snapshot, and git commit saves it with a short message. Write the message for your future self: what changed, in plain words.' },
      { h: '3. git push: send your commits to GitHub' },
      { code: 'git push' },
      { p: 'Your work is now online, backed up, and ready to show a mentor or a recruiter.' },
      { h: 'Two helpers worth knowing' },
      { ul: ['git status shows what changed and what is ready to commit.', 'git pull brings in updates that were pushed from somewhere else.'] },
      { h: 'A 15-minute practice run' },
      { ul: ['Create a new repository on GitHub with a README.', 'Clone it, edit the README, and run git status.', 'Add, commit with a clear message, and push.', 'Refresh the GitHub page and find your change.'] },
      { p: 'Small commits with clear messages make a project easy to review. Git and GitHub are part of the project work in our Software Engineering and Full Stack Web Development programmes.' }
    ]
  },
  {
    slug: 'what-a-verifiable-internship-letter-includes',
    title: 'What a verifiable internship letter should include',
    summary: 'A checklist any student can use to read an internship letter, from any provider, before sending it to college.',
    topic: 'Internships', read: 4,
    body: [
      { p: 'Colleges, parents and recruiters want to know that an internship was real and that someone can confirm it. A good letter makes that easy.' },
      { h: 'The checklist' },
      { ul: [
        'Your name, college and course.',
        'The role you worked in.',
        'Exact start and end dates, and the hours or weeks.',
        'Whether the work was online or on site.',
        'Two or three lines on the work you actually did.',
        'The company name and registration details.',
        'A named signatory with a designation, a phone number and an email, so the letter can be checked.',
        'An ID on the letter, with a place to verify it.'
      ] },
      { h: 'How to check one' },
      { ul: ['Call or email the signatory and ask them to confirm the dates and role.', 'Look up the ID on the issuer\u2019s verification page.', 'Compare the dates and hours with what your college asks for.'] },
      { h: 'Your college decides' },
      { p: 'Only your college can say whether it accepts an external internship, and in which format. Read its circular first, then ask the provider for a letter that matches it.' },
      { h: 'What GoForge Digital includes' },
      { p: 'Our internship letter names the student, college and course, role, exact dates, that the work was online, and two or three lines on the work. It is signed by Rohit Sharma, Founder & Director, with a phone and email for checks, and carries an ID you can verify at goforgedigital.com/verify. Colleges that need their own format or an NOC can ask us to prepare it.' }
    ]
  },
  {
    slug: '3-month-or-6-month-programme-how-to-choose',
    title: '3-Month or 6-Month programme: how to choose',
    summary: 'Start from your college rule, then pick the length that matches. Here is how the two programmes differ.',
    topic: 'Programmes', read: 3,
    body: [
      { p: 'Both programmes have live online training, mentor reviews, a supervised internship and a verifiable letter. The difference is time and depth.' },
      { h: 'The two programmes' },
      { ul: ['3-Month Programme: 1 month of training, then a 2-month internship. A good fit for a semester or summer internship requirement.', '6-Month Programme: 3 months of training, then a 3-month internship. A good fit for final years, graduates and 6-month requirements.'] },
      { h: 'Step 1: read your college circular' },
      { p: 'Note the weeks or hours your college asks for, the deadline, and whether it needs an NOC or its own letter format. This tells you the length you need.' },
      { h: 'Step 2: think about your goal' },
      { ul: ['Need a letter for a requirement and a first real project? The 3-Month Programme is built for that.', 'Want more training time, a capstone and a portfolio to show employers? The 6-Month Programme gives you that.'] },
      { h: 'Step 3: talk it through' },
      { p: 'Bring the circular to a free counselling call and we will help you match it to a programme. Fees and batch dates are always on the internship page.' }
    ]
  },
  {
    slug: 'choosing-a-track-full-stack-data-science-business-analyst',
    title: 'Choosing a track: Full Stack, Data Science or Business Analyst',
    summary: 'Three popular tracks, who each one suits, and a simple way to decide.',
    topic: 'Programmes', read: 4,
    body: [
      { p: 'The right track is the one you will enjoy practising. Here is how three of our seven tracks differ.' },
      { h: 'Full Stack Web Development' },
      { p: 'Build whole products, from the screen a user sees to the server and database behind it. You work with React, Node.js and Express, a database, login and deployment. It suits students who want to build and ship.' },
      { h: 'Data Science' },
      { p: 'Use Python, statistics and machine learning to find patterns in data. You work with tools like Pandas, scikit-learn and Streamlit. It suits students who are curious about numbers and comfortable with some maths.' },
      { h: 'Business Analyst' },
      { p: 'Turn business needs into clear requirements, process maps and reports a team can build from, using tools such as Excel, SQL, Power BI and Jira. It suits students who enjoy asking questions and writing clearly.' },
      { h: 'A simple way to decide' },
      { ul: ['Spend an hour on a small task in each area and notice which one you keep going with.', 'Look at the typical project for each track and ask which one you would be proud to explain.', 'Book a free counselling call and talk it through.'] },
      { p: 'Also available: Software Engineering, AI/ML Engineer, Data Analyst and Digital Marketing. You can read each track\u2019s curriculum on its programme page.' }
    ]
  }
];

module.exports = { POSTS, bySlug: slug => POSTS.find(p => p.slug === slug) };
