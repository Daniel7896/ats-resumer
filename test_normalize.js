function normalizeMarkdown(md) {
  if (!md) return "";
  let normalized = md;

  // Fix headings (e.g. text## Heading or text ## Heading -> text\n\n## Heading)
  normalized = normalized.replace(/([^\n])\s*(#{1,3}\s+)/g, "$1\n\n$2");

  // Fix bullet points (e.g. text* bullet or text * bullet -> text\n* bullet)
  normalized = normalized.replace(/([^\n*])\s*([*-]\s+)/g, "$1\n$2");

  return normalized;
}

const rawRow2 = "# DANIEL THARMARAJ Full-Stack Developer CONTACT +91 6379631574 danieltharmaraj55@gmail.com Tirunelveli, Tamil Nadu linkedin.com/in/daniel-tharmaraj github.com/Daniel7896 ## PROFESSIONAL SUMMARY Highly motivated Final-year Computer Science undergraduate (graduating May 2026) with robust full-stack development experience, specializing in React and Node.js. Proven ability to develop and deploy scalable web applications, including a MERN stack ticketing system and a Django-based multilingual chatbot. Published researcher with a passion for building efficient, user-focused solutions and eager to contribute to innovative software engineering projects. ## TECHNICAL SKILLS * Programming Languages: JavaScript, Java * Frontend: React.js, HTML, CSS * Backend: Node.js, Express.js, Django, REST APIs * Databases: MySQL, MongoDB * Tools & Platforms: Git, GitHub * Concepts: OOP, Exception Handling, MERN Stack ## PROJECTS ### Multilingual Chatbot-Based Ticketing System | May 2025 * Developed and deployed a";

console.log("================ NORMALIZED ================");
console.log(normalizeMarkdown(rawRow2));
console.log("============================================");
