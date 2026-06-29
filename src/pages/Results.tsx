import React, { useState, useEffect, useRef } from "react";
import {
  ChevronLeft, Check, Copy, Printer, FileDown,
  Edit3, Eye, CheckCircle, AlertTriangle, TrendingUp,
  Award, Target, BookOpen,
} from "lucide-react";

interface AnalysisResult {
  ats_score: number;
  matched_keywords: string[];
  missing_keywords: string[];
  section_feedback: {
    summary: string;
    experience: string;
    skills: string;
  };
  rewritten_resume: string;
  resume_filename: string;
}

interface ResultsProps {
  result: AnalysisResult | null;
  setCurrentPage: (page: any) => void;
}

/* ─── Markdown normaliser ──────────────────────────────────────────────────── */
function normalizeResume(raw: string): string {
  return raw
    // ── Step 1: convert escape sequences to real characters ──────────────────
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")

    // ── Step 2: defensive split — insert \n\n before any ## heading or \n
    //    before any * bullet that Gemini placed inline without a newline.
    //    Uses zero-width lookbehind so heading chars are NOT consumed.
    //
    //    Rule A: insert blank line before the START of a heading (#, ##, ###)
    //    Lookbehind [^\n#] ensures we match only once (before the first #)
    //    and never trigger between the # chars of ## or ###.
    .replace(/(?<=[^\n#])(?=#{1,3} )/g, "\n\n")
    //    Rule B: insert newline before '* ' bullet following non-newline non-* text
    .replace(/(?<=[^\n*])(?=\* )/g, "\n")

    // ── Step 3: normalise * bullets at start of line to - ────────────────────
    .replace(/^\* /gm, "- ")

    // ── Step 4: collapse excess blank lines ──────────────────────────────────
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}



/* ─── Markdown → HTML ──────────────────────────────────────────────────────── */
function renderMarkdown(raw: string): string {
  let md = normalizeResume(raw);

  // Escape HTML entities first
  md = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Headings (must come before bold to avoid double-processing)
  md = md.replace(/^# (.+)$/gm,
    '<h1 class="resume-h1">$1</h1>');
  md = md.replace(/^## (.+)$/gm,
    '<h2 class="resume-h2">$1</h2>');
  md = md.replace(/^### (.+)$/gm,
    '<h3 class="resume-h3">$1</h3>');

  // Bold
  md = md.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // Italic
  md = md.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Bullet lines → <li>
  md = md.replace(/^[-•]\s+(.+)$/gm,
    '<li class="resume-li">$1</li>');

  // Wrap consecutive <li> blocks in <ul>
  md = md.replace(/(<li[^>]*>.*<\/li>\n?)+/gs, (block) =>
    `<ul class="resume-ul">${block}</ul>`
  );

  // Remaining non-empty lines that aren't HTML tags → <p>
  const lines = md.split("\n");
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) { out.push(""); continue; }
    if (/^<(h[1-6]|ul|li|p|div|strong|em|br)/.test(t)) {
      out.push(t);
    } else {
      out.push(`<p class="resume-p">${t}</p>`);
    }
  }

  return out.join("\n");
}

/* ─── Score ring ────────────────────────────────────────────────────────────── */
function ScoreRing({ score }: { score: number }) {
  const [animated, setAnimated] = useState(0);
  const r = 42;
  const circ = 2 * Math.PI * r;

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(score), 100);
    return () => clearTimeout(timer);
  }, [score]);

  const offset = circ - (animated / 100) * circ;

  let color = "#ef4444";
  let label = "Needs Work";
  let labelColor = "text-rose-500";
  let bgColor = "bg-rose-50";
  let borderColor = "border-rose-200";
  if (score >= 80) { color = "#10b981"; label = "Excellent"; labelColor = "text-emerald-600"; bgColor = "bg-emerald-50"; borderColor = "border-emerald-200"; }
  else if (score >= 60) { color = "#f59e0b"; label = "Good Match"; labelColor = "text-amber-500"; bgColor = "bg-amber-50"; borderColor = "border-amber-200"; }
  else if (score >= 40) { color = "#f97316"; label = "Fair Match"; labelColor = "text-orange-500"; bgColor = "bg-orange-50"; borderColor = "border-orange-200"; }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-36 h-36">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          {/* Track */}
          <circle cx="50" cy="50" r={r} fill="none" stroke="#f1f5f9" strokeWidth="8" />
          {/* Progress */}
          <circle
            cx="50" cy="50" r={r}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.34,1.2,0.64,1)" }}
          />
        </svg>
        {/* Centre text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-4xl font-black text-slate-900">{score}</span>
          <span className="text-xs font-bold text-slate-400 -mt-0.5">/ 100</span>
        </div>
      </div>
      <span className={`inline-flex items-center rounded-full px-4 py-1 text-xs font-bold border ${bgColor} ${labelColor} ${borderColor}`}>
        {label}
      </span>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────────*/
export const Results: React.FC<ResultsProps> = ({ result, setCurrentPage }) => {
  if (!result) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500 font-medium">No active analysis found. Please run an analysis first.</p>
        <button
          onClick={() => setCurrentPage("dashboard")}
          className="mt-4 rounded-xl bg-teal-600 px-6 py-2.5 text-sm font-bold text-white"
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  const [activeTab, setActiveTab] = useState<"edit" | "preview">("preview");
  const [editedResume, setEditedResume] = useState(() => normalizeResume(result.rewritten_resume));
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(editedResume);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadMd = () => {
    const el = document.createElement("a");
    el.href = URL.createObjectURL(new Blob([editedResume], { type: "text/plain;charset=utf-8" }));
    el.download = `${result.resume_filename.split(".")[0]}_tailored.md`;
    document.body.appendChild(el); el.click(); document.body.removeChild(el);
  };

  const handlePrint = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head>
      <meta charset="utf-8">
      <title>${result.resume_filename.split(".")[0]}_tailored</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1e293b;padding:40px;max-width:800px;margin:0 auto;font-size:12px;line-height:1.6}
        h1{font-size:22px;font-weight:800;border-bottom:2px solid #0d9488;padding-bottom:6px;margin:0 0 16px}
        h2{font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin:20px 0 10px;color:#0f766e}
        h3{font-size:12px;font-weight:700;margin:12px 0 4px}
        p{margin-bottom:6px}
        ul{margin:4px 0 10px 18px}
        li{margin-bottom:3px}
        strong{font-weight:700}
        @media print{body{padding:24px}}
      </style>
    </head><body>
      ${renderMarkdown(editedResume)}
      <script>window.onload=function(){window.print()}<\/script>
    </body></html>`);
    w.document.close();
  };

  const matchPct = result.matched_keywords.length > 0
    ? Math.round((result.matched_keywords.length / (result.matched_keywords.length + result.missing_keywords.length)) * 100)
    : 0;

  return (
    <>
      {/* Inline styles for the resume preview */}
      <style>{`
        .resume-preview .resume-h1{font-size:1.375rem;font-weight:800;color:#0f172a;border-bottom:2px solid #0d9488;padding-bottom:6px;margin:0 0 14px}
        .resume-preview .resume-h2{font-size:.8rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#0f766e;border-bottom:1px solid #e2e8f0;padding-bottom:3px;margin:18px 0 8px}
        .resume-preview .resume-h3{font-size:.8125rem;font-weight:700;color:#1e293b;margin:10px 0 4px}
        .resume-preview .resume-p{font-size:.8125rem;color:#334155;line-height:1.6;margin-bottom:5px}
        .resume-preview .resume-ul{margin:4px 0 8px 16px;list-style:disc}
        .resume-preview .resume-li{font-size:.8125rem;color:#334155;line-height:1.55;margin-bottom:3px}
        .resume-preview strong{font-weight:700;color:#0f172a}
        .resume-preview em{font-style:italic;color:#475569}
      `}</style>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">

        {/* Back */}
        <button
          onClick={() => setCurrentPage("dashboard")}
          className="flex items-center space-x-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors mb-6"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Back to Dashboard</span>
        </button>

        {/* ─── 3-column grid ─── */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

          {/* ── LEFT SIDEBAR ── */}
          <div className="xl:col-span-3 space-y-5">

            {/* Score card */}
            <div className="glass-card border border-slate-200 rounded-3xl p-6 shadow-sm text-center space-y-1">
              <h3 className="font-display font-bold text-slate-800 text-sm mb-4">ATS Compatibility Score</h3>
              <ScoreRing score={result.ats_score} />

              {/* Mini stats row */}
              <div className="grid grid-cols-2 gap-3 pt-4">
                <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-3 text-center">
                  <div className="text-lg font-black text-emerald-600">{result.matched_keywords.length}</div>
                  <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-wide">Matched</div>
                </div>
                <div className="rounded-2xl bg-rose-50 border border-rose-100 p-3 text-center">
                  <div className="text-lg font-black text-rose-500">{result.missing_keywords.length}</div>
                  <div className="text-[10px] font-bold text-rose-400 uppercase tracking-wide">Missing</div>
                </div>
              </div>

              {/* Keyword coverage bar */}
              <div className="pt-2 space-y-1.5">
                <div className="flex justify-between text-xs font-semibold text-slate-400">
                  <span>Keyword Coverage</span>
                  <span>{matchPct}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-teal-400 to-emerald-500 transition-all duration-1000"
                    style={{ width: `${matchPct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Keywords card */}
            <div className="glass-card border border-slate-200 rounded-3xl p-5 shadow-sm space-y-5">
              {/* Matched */}
              <div>
                <h4 className="font-display font-bold text-slate-800 text-xs flex items-center space-x-1.5 mb-2.5">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Matched Keywords ({result.matched_keywords.length})</span>
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {result.matched_keywords.length > 0 ? (
                    result.matched_keywords.map((kw, i) => (
                      <span key={i} className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg px-2 py-0.5 font-medium">
                        {kw}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400 italic">No exact matching keywords found.</span>
                  )}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <h4 className="font-display font-bold text-slate-800 text-xs flex items-center space-x-1.5 mb-2.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  <span>Missing Keywords ({result.missing_keywords.length})</span>
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {result.missing_keywords.length > 0 ? (
                    result.missing_keywords.map((kw, i) => (
                      <span key={i} className="text-[11px] bg-rose-50 text-rose-700 border border-rose-100 rounded-lg px-2 py-0.5 font-medium">
                        {kw}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400 italic">All major keywords matched!</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── CENTRE — AI Feedback ── */}
          <div className="xl:col-span-3 space-y-4">
            <h3 className="font-display font-bold text-slate-800 text-sm px-1">AI Section Feedback</h3>

            {/* Summary */}
            <div className="glass-card border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center space-x-2 mb-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 border border-teal-100">
                  <Target className="h-3.5 w-3.5 text-teal-600" />
                </div>
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Summary</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{result.section_feedback.summary}</p>
            </div>

            {/* Experience */}
            <div className="glass-card border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center space-x-2 mb-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 border border-amber-100">
                  <TrendingUp className="h-3.5 w-3.5 text-amber-600" />
                </div>
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Experience</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{result.section_feedback.experience}</p>
            </div>

            {/* Skills */}
            <div className="glass-card border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center space-x-2 mb-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 border border-purple-100">
                  <Award className="h-3.5 w-3.5 text-purple-600" />
                </div>
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Skills & Structure</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{result.section_feedback.skills}</p>
            </div>

            {/* Tips callout */}
            <div className="rounded-2xl border border-teal-100 bg-teal-50/70 p-4">
              <div className="flex items-start space-x-2.5">
                <BookOpen className="h-4 w-4 text-teal-600 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-teal-700 leading-relaxed font-medium">
                  <strong>Pro tip:</strong> Copy the tailored resume on the right, paste into a plain-text editor, then submit to the ATS portal for best results.
                </p>
              </div>
            </div>
          </div>

          {/* ── RIGHT — Resume Editor/Preview ── */}
          <div className="xl:col-span-6">
            <div className="glass-card border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col" style={{ minHeight: "calc(100vh - 180px)" }}>

              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 px-5 py-3 gap-3 bg-white/70">
                {/* Tab toggle */}
                <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
                  <button
                    onClick={() => setActiveTab("preview")}
                    className={`flex items-center space-x-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
                      activeTab === "preview" ? "bg-white text-teal-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>Preview</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("edit")}
                    className={`flex items-center space-x-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
                      activeTab === "edit" ? "bg-white text-teal-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    <span>Edit Source</span>
                  </button>
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleCopy}
                    title="Copy to clipboard"
                    className="flex items-center space-x-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors bg-white shadow-sm"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copied ? "Copied!" : "Copy"}</span>
                  </button>

                  <button
                    onClick={handlePrint}
                    title="Print / Save as PDF"
                    className="flex items-center space-x-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors bg-white shadow-sm"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    <span>Print</span>
                  </button>

                  <button
                    onClick={downloadMd}
                    className="flex items-center space-x-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-4 py-1.5 shadow-md shadow-teal-500/10 transition-colors"
                  >
                    <FileDown className="h-3.5 w-3.5" />
                    <span>Export MD</span>
                  </button>
                </div>
              </div>

              {/* Content area */}
              <div className="flex-1 overflow-hidden">
                {activeTab === "edit" ? (
                  <textarea
                    value={editedResume}
                    onChange={(e) => setEditedResume(e.target.value)}
                    className="w-full h-full p-6 bg-slate-50 font-mono text-xs text-slate-900 border-0 focus:outline-none resize-none"
                    style={{ minHeight: "calc(100vh - 240px)" }}
                  />
                ) : (
                  <div
                    className="resume-preview w-full h-full overflow-y-auto p-8 bg-white"
                    style={{ minHeight: "calc(100vh - 240px)" }}
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(editedResume) }}
                  />
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
};
