import React, { useState } from "react";
import { ChevronLeft, Check, Copy, Printer, FileDown, Edit3, Eye, CheckCircle, AlertTriangle } from "lucide-react";

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
  const [editedResume, setEditedResume] = useState(result.rewritten_resume);
  const [copied, setCopied] = useState(false);

  // Helper to color-code score
  const getScoreColor = (score: number) => {
    if (score >= 80) return { text: "text-emerald-600", border: "border-emerald-200", bg: "bg-emerald-50", fill: "#10b981", label: "Excellent Match" };
    if (score >= 50) return { text: "text-amber-500", border: "border-amber-200", bg: "bg-amber-50", fill: "#f59e0b", label: "Average Match" };
    return { text: "text-rose-500", border: "border-rose-200", bg: "bg-rose-50", fill: "#ef4444", label: "Needs Improvement" };
  };

  const scoreMeta = getScoreColor(result.ats_score);

  // Simple Markdown to HTML parser
  const renderMarkdown = (md: string) => {
    let html = md
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    
    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    
    // Headings
    html = html.replace(/^### (.*?)$/gm, '<h3 class="text-base font-bold text-slate-800 mt-4 mb-2">$1</h3>');
    html = html.replace(/^## (.*?)$/gm, '<h2 class="text-lg font-extrabold text-teal-800 border-b border-slate-200 pb-1 mt-6 mb-3">$1</h2>');
    html = html.replace(/^# (.*?)$/gm, '<h1 class="text-2xl font-extrabold text-slate-900 mt-8 mb-4">$1</h1>');
    
    // Bullet points
    html = html.replace(/^\s*[-*]\s+(.*?)$/gm, '<li class="ml-4 list-disc text-sm text-slate-700 leading-relaxed mb-1.5">$1</li>');

    // Paragraphs
    const lines = html.split("\n");
    const processed = lines.map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return "<br/>";
      if (
        trimmed.startsWith("<h") || 
        trimmed.startsWith("<li") || 
        trimmed.startsWith("<ul") || 
        trimmed.startsWith("<br")
      ) {
        return line;
      }
      return `<p class="text-sm text-slate-700 leading-relaxed mb-2.5">${line}</p>`;
    });

    return processed.join("\n");
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(editedResume);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadTextFile = (content: string, filename: string) => {
    const element = document.createElement("a");
    const file = new Blob([content], { type: "text/plain;charset=utf-8" });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Browser print to PDF
  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    
    const formattedHtml = renderMarkdown(editedResume);
    
    printWindow.document.write(`
      <html>
        <head>
          <title>${result.resume_filename.split('.')[0]}_tailored</title>
          <style>
            body {
              font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
              color: #1e293b;
              line-height: 1.5;
              padding: 40px;
              max-width: 800px;
              margin: 0 auto;
            }
            h1 { font-size: 24px; font-weight: bold; border-bottom: 2px solid #0d9488; padding-bottom: 5px; margin-top: 30px; }
            h2 { font-size: 18px; font-weight: bold; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; margin-top: 25px; }
            h3 { font-size: 14px; font-weight: bold; margin-top: 15px; }
            p { font-size: 12px; margin-bottom: 8px; }
            li { font-size: 12px; margin-bottom: 5px; }
            strong { font-weight: bold; }
            @media print {
              body { padding: 0; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          ${formattedHtml}
          <script>
            window.onload = function() {
              window.print();
              // window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      
      {/* Back button */}
      <button
        onClick={() => setCurrentPage("dashboard")}
        className="flex items-center space-x-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors mb-6"
      >
        <ChevronLeft className="h-4 w-4" />
        <span>Back to Dashboard</span>
      </button>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Scoring & Feedback Column (Left) */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Score Card */}
          <div className="glass-card border border-slate-200 rounded-3xl p-6 shadow-sm text-center">
            <h3 className="font-display font-bold text-slate-900 text-base mb-4">ATS Compatibility Score</h3>
            
            <div className="relative mx-auto flex items-center justify-center h-32 w-32">
              <svg className="h-full w-full transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-slate-100"
                  strokeWidth="3"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="transition-all duration-1000 ease-out"
                  strokeDasharray={`${result.ats_score}, 100`}
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  stroke={scoreMeta.fill}
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute font-display text-3xl font-black text-slate-900">
                {result.ats_score}%
              </div>
            </div>

            <div className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${scoreMeta.bg} ${scoreMeta.text} ${scoreMeta.border} border mt-4`}>
              {scoreMeta.label}
            </div>
          </div>

          {/* Keywords Card */}
          <div className="glass-card border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
            <div>
              <h4 className="font-display font-bold text-slate-900 text-sm flex items-center space-x-1.5">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                <span>Matched Keywords ({result.matched_keywords.length})</span>
              </h4>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {result.matched_keywords.length > 0 ? (
                  result.matched_keywords.map((kw, i) => (
                    <span
                      key={i}
                      className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg px-2.5 py-1 font-medium"
                    >
                      {kw}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-400 italic">No exact matching keywords found.</span>
                )}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <h4 className="font-display font-bold text-slate-900 text-sm flex items-center space-x-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span>Missing Keywords ({result.missing_keywords.length})</span>
              </h4>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {result.missing_keywords.length > 0 ? (
                  result.missing_keywords.map((kw, i) => (
                    <span
                      key={i}
                      className="text-xs bg-rose-50 text-rose-700 border border-rose-100 rounded-lg px-2.5 py-1 font-medium"
                    >
                      {kw}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-400 italic">All major keywords matched!</span>
                )}
              </div>
            </div>
          </div>

          {/* Section Feedback Card */}
          <div className="glass-card border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <h4 className="font-display font-bold text-slate-900 text-sm">Detailed AI Feedback</h4>
            
            <div className="space-y-3.5">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Summary Section</div>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{result.section_feedback.summary}</p>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Experience Bulletpoints</div>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{result.section_feedback.experience}</p>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Skills & Structure</div>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{result.section_feedback.skills}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Editor & Preview Column (Right) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col h-full min-h-[70vh]">
            
            {/* Header controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-4">
              
              {/* Tab toggles */}
              <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
                <button
                  onClick={() => setActiveTab("preview")}
                  className={`flex items-center space-x-1.5 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                    activeTab === "preview"
                      ? "bg-white text-teal-800 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Eye className="h-4 w-4" />
                  <span>Preview</span>
                </button>
                <button
                  onClick={() => setActiveTab("edit")}
                  className={`flex items-center space-x-1.5 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                    activeTab === "edit"
                      ? "bg-white text-teal-800 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Edit3 className="h-4 w-4" />
                  <span>Edit Source</span>
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2.5">
                <button
                  onClick={handleCopy}
                  title="Copy to clipboard"
                  className="flex items-center justify-center rounded-xl border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50 transition-colors bg-white shadow-sm"
                >
                  {copied ? <Check className="h-4.5 w-4.5 text-emerald-500" /> : <Copy className="h-4.5 w-4.5" />}
                </button>

                <button
                  onClick={handlePrint}
                  title="Print / Save as PDF"
                  className="flex items-center justify-center rounded-xl border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50 transition-colors bg-white shadow-sm"
                >
                  <Printer className="h-4.5 w-4.5" />
                </button>

                <button
                  onClick={() => downloadTextFile(editedResume, `${result.resume_filename.split('.')[0]}_tailored.md`)}
                  className="flex items-center space-x-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-4 py-2.5 shadow-md shadow-teal-500/10 transition-colors"
                >
                  <FileDown className="h-4 w-4" />
                  <span>Export MD</span>
                </button>
              </div>
            </div>

            {/* Content pane */}
            <div className="flex-grow pt-6 h-full flex flex-col">
              {activeTab === "edit" ? (
                <textarea
                  value={editedResume}
                  onChange={(e) => setEditedResume(e.target.value)}
                  className="w-full flex-grow p-4 bg-slate-50 font-mono text-xs text-slate-900 border border-slate-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-500 resize-none h-[50vh]"
                />
              ) : (
                <div 
                  className="w-full flex-grow p-6 bg-white border border-slate-100 rounded-2xl overflow-y-auto max-h-[60vh] text-left shadow-inner prose prose-slate"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(editedResume) }}
                />
              )}
            </div>
            
          </div>
        </div>

      </div>
    </div>
  );
};
