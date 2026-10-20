// Real Google reviews of Goforge Digital, quoted verbatim (do not edit wording).
// Source: Google Business Profile. Rating/count are as shown on Google; update when they change.
// To add a student video testimonial, set videoUrl (YouTube/Drive/MP4 link) on an entry.
// NOTE: no aggregateRating/Review schema here on purpose (Google disallows self-serving review markup).
const GOOGLE = {
  rating: '4.9',
  count: 18,
  url: 'https://www.google.com/maps/place/Goforge+Digital/@28.392606,77.3403438,17z/data=!3m1!4b1!4m6!3m5!1s0x390cddc0563f801d:0xfcbb024f1f898077!8m2!3d28.392606!4d77.3403438!16s%2Fg%2F11zzp3hg4p',
};

const STUDENT_REVIEWS = [
  { name: 'Sara Khatri', rating: 4, text: 'I received training in Python/AI/MLEngineer through Goforge Digital. The sessions covered Everything about Aiml and helped me strengthen my understanding of RAG Overall, my experience was Very good', videoUrl: '' },
  { name: 'Jhalak Goyal', rating: 5, text: 'I completed training inDevelopment with Goforge Digital. The learning experience helped me understand data anaytics and I found it very useful.', videoUrl: '' },
  { name: 'Bhupesh Sharma', rating: 5, text: 'I appreciated training aspect of the guidance during my training with Goforge Digital. The support I received helped me understand Google Ads more clearly and improve my technical knowledge.', videoUrl: '' },
];

const CLIENT_REVIEWS = [
  { name: 'Lakshita Tehlan', rating: 5, text: "We worked with Goforge Digital on AI automation for our business. The team turned our manual processes into smooth automated workflows, which saved us a lot of time. Very good service, and I'd recommend them.", videoUrl: '' },
  { name: 'Nitish Adhana', rating: 5, text: 'We worked with Goforge Digital for Real Estate Project. The work involved CRM , Website, and our overall experience was good. We particularly valued every strength demonstrated during the project.', videoUrl: '' },
  { name: 'Randeep Rana', rating: 5, text: 'We approached Goforge Digital for our business website requirement The project involved actual features or deliverables, and our experience with the development process was Excellent.', videoUrl: '' },
];

const initials = name => name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();

module.exports = { GOOGLE, STUDENT_REVIEWS, CLIENT_REVIEWS, initials };
