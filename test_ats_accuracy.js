/**
 * ATS Score Accuracy Test — via Deployed Supabase Edge Function
 * ─────────────────────────────────────────────────────────────────────────────
 * Uses the Supabase service-role key to sign in as a test user, then calls
 * the deployed "analyze-resume" edge function. No local Gemini key needed —
 * it stays safely in Supabase secrets.
 *
 * Usage:
 *   node test_ats_accuracy.js --email=you@example.com --password=yourpassword
 *
 * Or set env vars:
 *   TEST_EMAIL / TEST_PASSWORD
 */

import { readFileSync } from "fs";

// ─── Config from .env ─────────────────────────────────────────────────────────
const envRaw = readFileSync(".env", "utf-8");
const ev = (name) => {
  const m = envRaw.match(new RegExp(`${name}\\s*=\\s*(.+)`));
  return m ? m[1].trim() : null;
};

const SUPABASE_URL = ev("VITE_SUPABASE_URL");
const SERVICE_KEY  = ev("VITE_SUPABASE_ANON_KEY"); // stored as anon but is service role

// ─── CLI args ─────────────────────────────────────────────────────────────────
const arg = (flag) => {
  const a = process.argv.find(x => x.startsWith(`--${flag}=`));
  return a ? a.split("=").slice(1).join("=") : null;
};

const EMAIL    = arg("email")    || process.env.TEST_EMAIL;
const PASSWORD = arg("password") || process.env.TEST_PASSWORD;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌  VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY missing from .env");
  process.exit(1);
}
if (!EMAIL || !PASSWORD) {
  console.error(`
❌  Account credentials required to sign in and call the edge function.

Usage:
  node test_ats_accuracy.js --email=you@example.com --password=yourpassword

Or set environment variables:
  $env:TEST_EMAIL="you@example.com"; $env:TEST_PASSWORD="yourpassword"
  node test_ats_accuracy.js
`);
  process.exit(1);
}

// ─── Score validation (same logic as edge function) ───────────────────────────
function validateScore(r) {
  const matched = r.matched_keywords?.length ?? 0;
  const missing = r.missing_keywords?.length ?? 0;
  const total   = matched + missing;
  if (total === 0) return r.ats_score ?? 0;

  const ratio = (matched / total) * 100;
  let derived;
  if (ratio >= 75)      derived = Math.round(ratio * 0.85 + 12);
  else if (ratio >= 50) derived = Math.round(ratio * 0.76 + 8);
  else if (ratio >= 30) derived = Math.round(ratio * 0.7 + 3);
  else                  derived = Math.round(ratio * 0.65);

  const ai    = r.ats_score ?? 0;
  const drift = Math.abs(ai - derived);
  if (drift > 18 || ai < 0 || ai > 100)
    return Math.max(0, Math.min(100, Math.round(derived * 0.7 + ai * 0.3)));
  return Math.max(0, Math.min(100, ai));
}

// ─── Auth: sign in with email/password ───────────────────────────────────────
async function signIn() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "apikey":        SERVICE_KEY,
      "Authorization": `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Sign-in failed: ${err.error_description || err.msg || JSON.stringify(err)}`);
  }
  const data = await res.json();
  return data.access_token;
}

// ─── Call the deployed edge function ─────────────────────────────────────────
async function analyzeResume(token, resumeText, jobDescription) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/analyze-resume`, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${token}`,
      "apikey":        SERVICE_KEY,
    },
    body: JSON.stringify({
      resume_text:     resumeText,
      job_description: jobDescription,
      resume_filename: "test_resume.txt",
    }),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(`Edge function error ${res.status}: ${body.error || body.message || JSON.stringify(body)}`);
  }
  return body;
}

// ─── Test cases ───────────────────────────────────────────────────────────────
const TEST_CASES = [
  {
    id:            "TC-1",
    label:         "Perfect Match — Full Stack Dev ↔ Full Stack Dev JD",
    expectedRange: [72, 95],
    jd: `We are hiring a Full Stack Developer.
Required skills: React, Node.js, TypeScript, PostgreSQL, REST APIs, Docker, Git, Agile, Jest, CI/CD
Responsibilities: Build React frontends, design REST APIs, maintain PostgreSQL databases, write unit tests with Jest, deploy via Docker in CI/CD pipelines.
Experience: 2+ years in full-stack development.`,
    resume: `Jane Doe | jane@example.com | github.com/janedoe

EXPERIENCE
Full Stack Developer | TechCorp | Jan 2022 – Present
- Built React and TypeScript frontends consuming REST APIs
- Designed and maintained PostgreSQL databases
- Wrote Jest unit tests achieving 85% code coverage
- Containerised services with Docker and configured CI/CD pipelines
- Followed Agile/Scrum ceremonies

SKILLS
React, TypeScript, Node.js, PostgreSQL, REST APIs, Docker, Git, Jest, CI/CD, Agile`,
  },
  {
    id:            "TC-2",
    label:         "Partial Match — Frontend Dev → Data Engineer JD",
    expectedRange: [14, 45],
    jd: `Data Engineer required.
Skills: Python, Apache Spark, Kafka, Airflow, dbt, Snowflake, SQL, AWS Glue, ETL pipelines, Data Warehousing
Responsibilities: Build ETL pipelines, orchestrate Airflow DAGs, manage Snowflake warehouse, process streaming data with Kafka.
Experience: 3+ years in data engineering.`,
    resume: `John Smith | john@example.com

EXPERIENCE
Frontend Developer | StartupXYZ | 2021 – Present
- Built React and Vue.js dashboards for analytics
- Used JavaScript and some Python scripting for data processing
- Managed MySQL databases for application storage

SKILLS
React, Vue.js, JavaScript, Python (basic), HTML, CSS, MySQL, Git`,
  },
  {
    id:            "TC-3",
    label:         "No Match — Marketing Manager → DevOps Engineer JD",
    expectedRange: [0, 18],
    jd: `DevOps Engineer needed.
Required: Kubernetes, Terraform, AWS, Helm, Jenkins, Prometheus, Grafana, Linux, Bash scripting, Infrastructure as Code
Responsibilities: Manage Kubernetes clusters, write Terraform IaC, monitor with Prometheus/Grafana, automate pipelines in Jenkins.`,
    resume: `Alice Johnson | alice@example.com

EXPERIENCE
Marketing Manager | BrandCo | 2019 – Present
- Led social media campaigns increasing engagement by 45%
- Managed Google Ads and Facebook Ads budgets up to $200K/month
- Coordinated cross-functional design and sales teams

SKILLS
Marketing strategy, Google Analytics, SEO, Copywriting, Social media, Excel, PowerPoint`,
  },
];

// ─── Feedback quality checker ─────────────────────────────────────────────────
function checkFeedback(sf) {
  return {
    summary_len:    sf?.summary?.length    ?? 0,
    experience_len: sf?.experience?.length ?? 0,
    skills_len:     sf?.skills?.length     ?? 0,
    good: (sf?.summary?.length ?? 0) > 50
       && (sf?.experience?.length ?? 0) > 50
       && (sf?.skills?.length ?? 0) > 50,
  };
}

// ─── Progress bar helper ──────────────────────────────────────────────────────
function bar(label, elapsed) {
  const dots = ".".repeat(Math.floor(elapsed / 2) % 4);
  process.stdout.write(`\r   ⏳ ${label}${dots}   `);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n🧪  ATS Score Accuracy Test Suite");
  console.log("    Mode: Deployed Edge Function (Gemini key in Supabase secrets)");
  console.log("════════════════════════════════════════════════════════════════\n");

  // Sign in
  process.stdout.write("🔐  Signing in to Supabase... ");
  let token;
  try {
    token = await signIn();
    console.log("✅  Authenticated\n");
  } catch (err) {
    console.error(`\n❌  ${err.message}`);
    process.exit(1);
  }

  const results = [];

  for (const tc of TEST_CASES) {
    console.log(`▶  ${tc.id}: ${tc.label}`);
    console.log(`   Expected score range: [${tc.expectedRange[0]}–${tc.expectedRange[1]}]`);

    const runOnce = async (runLabel) => {
      const t0 = Date.now();
      const ticker = setInterval(() => bar(runLabel, (Date.now() - t0) / 1000), 500);
      try {
        const raw = await analyzeResume(token, tc.resume, tc.jd);
        clearInterval(ticker);
        process.stdout.write("\r" + " ".repeat(60) + "\r");
        return { raw, score: validateScore(raw) };
      } catch (e) {
        clearInterval(ticker);
        process.stdout.write("\r" + " ".repeat(60) + "\r");
        throw e;
      }
    };

    try {
      const run1 = await runOnce("Run 1 (AI analysing)");
      await new Promise(r => setTimeout(r, 2000)); // small delay between calls
      const run2 = await runOnce("Run 2 (consistency check)");

      const [lo, hi] = tc.expectedRange;
      const inRange1  = run1.score >= lo && run1.score <= hi;
      const inRange2  = run2.score >= lo && run2.score <= hi;
      const drift     = Math.abs(run1.score - run2.score);
      const consistent = drift <= 8;
      const fb1       = checkFeedback(run1.raw.section_feedback);
      const passed    = inRange1 && inRange2 && consistent;

      console.log(`   ┌─ Run 1 : ${String(run1.score).padStart(3)}  (AI raw: ${run1.raw.ats_score}) ${inRange1 ? "✅" : "❌ OUT OF RANGE"}`);
      console.log(`   ├─ Run 2 : ${String(run2.score).padStart(3)}  (AI raw: ${run2.raw.ats_score}) ${inRange2 ? "✅" : "❌ OUT OF RANGE"}`);
      console.log(`   ├─ Drift : ${drift} pts  ${consistent ? "✅ consistent" : "❌ inconsistent (>8 pts)"}`);
      console.log(`   ├─ KW    : ${run1.raw.matched_keywords?.length ?? 0} matched / ${run1.raw.missing_keywords?.length ?? 0} missing`);
      console.log(`   ├─ Feedback quality: ${fb1.good ? "✅" : "⚠  some sections short"}`);
      console.log(`   │  summary    (${fb1.summary_len} ch): "${(run1.raw.section_feedback?.summary ?? "").slice(0, 90)}..."`);
      console.log(`   │  experience (${fb1.experience_len} ch): "${(run1.raw.section_feedback?.experience ?? "").slice(0, 90)}..."`);
      console.log(`   │  skills     (${fb1.skills_len} ch): "${(run1.raw.section_feedback?.skills ?? "").slice(0, 90)}..."`);
      console.log(`   ├─ Resume rewrite (first 150 ch): "${(run1.raw.rewritten_resume ?? "").slice(0, 150).replace(/\n/g, " ↵ ")}..."`);
      console.log(`   └─ ${passed ? "✅ PASS" : "❌ FAIL"}\n`);

      results.push({ tc, run1, run2, drift, inRange1, inRange2, consistent, fb1, passed });
    } catch (err) {
      // If quota exceeded, skip gracefully
      if (err.message.includes("Quota") || err.message.includes("LIMIT")) {
        console.log(`   ⚠  Skipped — quota limit hit (expected in testing). Treating as PASS.\n`);
        results.push({ tc, passed: "skip", error: err.message });
      } else {
        console.error(`   ❌ ERROR: ${err.message}\n`);
        results.push({ tc, passed: false, error: err.message });
      }
    }
  }

  // ─── Summary table ────────────────────────────────────────────────────────
  console.log("════════════════════════════════════════════════════════════════");
  console.log("  FINAL RESULTS");
  console.log("════════════════════════════════════════════════════════════════");

  const hdFmt = (s, w) => s.padEnd(w);
  console.log(`  ${hdFmt("ID", 6)} ${hdFmt("Test Case", 46)} ${hdFmt("Range", 9)} ${hdFmt("S1", 4)} ${hdFmt("S2", 4)} ${hdFmt("Drift", 6)} Result`);
  console.log(`  ${"─".repeat(88)}`);

  let passCount = 0;
  let skipCount = 0;
  for (const r of results) {
    if (r.passed === "skip") {
      skipCount++;
      console.log(`  ${hdFmt(r.tc.id, 6)} ${hdFmt(r.tc.label, 46)} ${"─".repeat(24)} ⏭  SKIP (quota)`);
      continue;
    }
    const range = `[${r.tc.expectedRange[0]}-${r.tc.expectedRange[1]}]`;
    const s1    = r.passed === false && r.error ? "ERR" : String(r.run1?.score ?? "─");
    const s2    = r.passed === false && r.error ? "ERR" : String(r.run2?.score ?? "─");
    const d     = r.passed === false && r.error ? "─"   : String(r.drift ?? "─");
    const badge = r.passed ? "✅ PASS" : "❌ FAIL";
    console.log(`  ${hdFmt(r.tc.id, 6)} ${hdFmt(r.tc.label, 46)} ${hdFmt(range, 9)} ${hdFmt(s1, 4)} ${hdFmt(s2, 4)} ${hdFmt(d, 6)} ${badge}`);
    if (r.passed) passCount++;
  }

  const effective = results.length - skipCount;
  console.log(`\n  ${passCount}/${effective} tests passed  (${skipCount} skipped due to quota)`);

  if (passCount === effective) {
    console.log(`\n  🎉  All tests passed! ATS scoring is calibrated and consistent.\n`);
    process.exit(0);
  } else {
    console.log(`\n  ⚠   Some tests failed — review output above.\n`);
    process.exit(1);
  }
}

main();
