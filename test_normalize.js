// Unit test for normalizeResume — mirrors the function in Results.tsx exactly

function normalizeResume(raw) {
  return raw
    // Step 1: convert escape sequences to real characters
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")

    // Step 2: defensive split using zero-width lookbehind
    // Rule A: [^\n#] ensures we match only before the FIRST # of a heading
    .replace(/(?<=[^\n#])(?=#{1,3} )/g, "\n\n")
    // Rule B: insert \n before * bullet (not ** bold)
    .replace(/(?<=[^\n*])(?=\* )/g, "\n")

    // Step 3: normalise * bullets at start of line to -
    .replace(/^\* /gm, "- ")

    // Step 4: collapse excess blank lines
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── Test cases ─────────────────────────────────────────────────────────────
const tests = [
  {
    name: "Known-broken: headings glued to text (the 70% bug case)",
    input: "Strong backend fundamentals.## SUMMARY\nExperienced developer.## EXPERIENCE\n* Built APIs.* Designed systems.",
    mustContain: ["\n## SUMMARY", "\n## EXPERIENCE", "\n- Built APIs"],
    mustNotContain: ["fundamentals.## ", "developer.## ", "* Built"],
  },
  {
    name: "Known-broken: literal \\n escape sequences from Gemini",
    input: "John Doe\\njane@email.com\\n## SKILLS\\n* Python\\n* Django",
    mustContain: ["\n## SKILLS", "\n- Python", "\n- Django"],
    mustNotContain: ["\\n", "* Python", "* Django"],
  },
  {
    name: "Known-good: already correctly formatted (must not double-insert newlines)",
    input: "# Jane Doe\njane@email.com\n\n## EXPERIENCE\n\n### Dev | Corp | 2022\n- Built React app\n- Wrote tests",
    mustContain: ["## EXPERIENCE", "- Built React app", "- Wrote tests"],
    mustNotContain: [],
    // Also check no triple-newlines are introduced
    mustNotMatch: /\n{3,}/,
  },
  {
    name: "Edge case: bold text + heading glued",
    input: "**Skills:** React, Node.## EDUCATION\n* BSc Computer Science",
    mustContain: ["\n## EDUCATION", "\n- BSc"],
    mustNotContain: ["Node.## ", "* BSc"],
  },
  {
    name: "Edge case: multiple bullets on one line separated by periods",
    input: "## EXPERIENCE\n* Led team.* Built APIs.* Reduced latency by 30%.",
    mustContain: ["- Led team", "- Built APIs", "- Reduced latency"],
    mustNotContain: ["* Led", "* Built", "* Reduced"],
  },
  {
    name: "Edge case: heading immediately after heading (no text between)",
    input: "## SUMMARY\nExperienced engineer.## SKILLS\nPython, Django",
    mustContain: ["\n## SKILLS"],
    mustNotContain: ["engineer.## "],
  },
];

let passed = 0, failed = 0;
console.log("\n🧪  normalizeResume() Unit Tests");
console.log("═".repeat(60));

for (const t of tests) {
  const out = normalizeResume(t.input);
  const errors = [];

  for (const s of (t.mustContain ?? []))
    if (!out.includes(s)) errors.push(`  ✗ MISSING: ${JSON.stringify(s)}`);
  for (const s of (t.mustNotContain ?? []))
    if (out.includes(s)) errors.push(`  ✗ STILL PRESENT: ${JSON.stringify(s)}`);
  if (t.mustNotMatch && t.mustNotMatch.test(out))
    errors.push(`  ✗ PATTERN STILL MATCHES: ${t.mustNotMatch}`);

  if (errors.length === 0) {
    console.log(`  PASS ✅  ${t.name}`);
    passed++;
  } else {
    console.log(`  FAIL ❌  ${t.name}`);
    errors.forEach((e) => console.log(e));
    console.log(`        input:  ${JSON.stringify(t.input).slice(0, 120)}`);
    console.log(`        output: ${JSON.stringify(out).slice(0, 200)}`);
    failed++;
  }
}

console.log("═".repeat(60));
console.log(`\n  ${passed}/${passed + failed} tests passed\n`);
process.exit(failed > 0 ? 1 : 0);
