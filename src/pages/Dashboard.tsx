import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { extractText } from "../utils/fileParser";
import { Upload, FileText, ChevronRight, AlertCircle, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "../supabaseClient";

interface DashboardProps {
  setCurrentPage: (page: any) => void;
  setAnalysisResult: (result: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ setCurrentPage, setAnalysisResult }) => {
  const { session, usage, profile, fetchUsage } = useAuth();
  
  const [file, setFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [dragActive, setDragActive] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const [tipAnimClass, setTipAnimClass] = useState("tip-enter");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadStartRef = useRef<number>(0);

  const ATS_TIPS = [
    { icon: "🎯", title: "Keyword Matching Matters", body: "ATS scanners rank resumes by how well they match exact keywords from the job description. Tailor every resume to each role." },
    { icon: "📐", title: "Formatting Counts", body: "Fancy tables, graphics, and text boxes confuse most ATS parsers. Plain sections with clear headings score highest." },
    { icon: "📊", title: "Quantify Achievements", body: "Recruiters spend ~7 seconds on a resume. Numbers like \"Increased revenue by 35%\" grab attention and rank higher." },
    { icon: "🔑", title: "Use the Exact Job Title", body: "Mirror the exact job title from the posting in your resume headline. It's one of the first fields ATS systems index." },
    { icon: "📝", title: "File Format Matters", body: "ATS systems read plain-text PDFs and DOCX files best. Avoid image-based PDFs created from scans or screenshots." },
    { icon: "💼", title: "Skills Section is Critical", body: "Add a dedicated Skills section. Many ATS systems specifically parse this section to pull technical competencies." },
    { icon: "🚀", title: "Soft Skills Need Context", body: "Don't just list \"leadership\" — back it with a quantified example. ATS and human reviewers both reward specific evidence." },
    { icon: "🔄", title: "Tailor for Each Application", body: "Generic resumes score 40–60% lower in ATS rankings. Customising your resume per job can double your callback rate." },
  ];

  const TOTAL_DURATION_S = 70; // estimated max wait in seconds

  useEffect(() => {
    if (!loading) return;
    loadStartRef.current = Date.now();
    setLoadProgress(0);
    setTipIndex(0);
    setTipAnimClass("tip-enter");

    let lastTipSlot = 0;
    const progressInterval = setInterval(() => {
      const elapsed = (Date.now() - loadStartRef.current) / 1000;
      const raw = elapsed / TOTAL_DURATION_S;
      // ease-out so bar slows as it approaches 95%
      const eased = 1 - Math.pow(1 - Math.min(raw, 1), 2.5);
      setLoadProgress(Math.min(eased * 95, 95));

      // advance tip card every 5 seconds
      const currentSlot = Math.floor(elapsed / 5);
      if (currentSlot > lastTipSlot) {
        lastTipSlot = currentSlot;
        // start exit animation, then swap card after 420ms
        setTipAnimClass("tip-exit");
        setTimeout(() => {
          setTipIndex(t => (t + 1) % ATS_TIPS.length);
          setTipAnimClass("tip-enter");
        }, 420);
      }
    }, 250);

    return () => clearInterval(progressInterval);
  }, [loading]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      validateAndSetFile(droppedFile);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    setErrorMsg(null);
    const extension = selectedFile.name.split(".").pop()?.toLowerCase();
    if (extension === "pdf" || extension === "docx" || extension === "txt") {
      setFile(selectedFile);
    } else {
      setErrorMsg("Unsupported file type. Please upload a PDF or DOCX file.");
    }
  };

  const removeFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const triggerUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleAnalyze = async () => {
    if (!file || !jobDescription.trim()) return;
    
    setLoading(true);
    setErrorMsg(null);

    try {
      // Step 1: Text extraction
      setLoadingStep("Extracting text from resume...");
      const extractedText = await extractText(file);
      
      if (!extractedText || extractedText.length < 50) {
        throw new Error("This PDF appears to be a scanned image with no selectable text. Please upload a text-based PDF or a DOCX file instead.");
      }

      // Step 2: Call Edge Function
      setLoadingStep("AI analyzing keywords and scoring compatibility...");
      const token = session?.access_token;
      
      const { data: edgeData, error: edgeError } = await supabase.functions.invoke("analyze-resume", {
        body: {
          resume_text: extractedText,
          job_description: jobDescription,
          resume_filename: file.name,
        },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (edgeError) {
        // Parse custom JSON errors returned by our Edge Function
        let errMsg = "Failed to run analysis.";
        try {
          const bodyJson = await edgeError.context.json();
          if (bodyJson.error || bodyJson.message) {
            errMsg = bodyJson.error || bodyJson.message;
          }
        } catch (_) {}
        throw new Error(errMsg);
      }

      if (!edgeData) {
        throw new Error("No data returned from AI analyzer.");
      }

      // Step 3: Complete and navigate
      setLoadingStep("Formatting rewritten resume...");
      setAnalysisResult({
        ...edgeData,
        resume_filename: file.name,
      });

      // Refresh limits
      await fetchUsage();
      
      setCurrentPage("results");
    } catch (err: any) {
      console.error("Analysis failed:", err);
      setErrorMsg(err.message || "An unexpected error occurred during resume analysis.");
    } finally {
      setLoading(false);
      setLoadingStep("");
    }
  };

  const isLimitReached = usage !== null && usage.monthly_analyses !== null && usage.analyses_count >= usage.monthly_analyses;

  // ─── Rich animated loading screen ───────────────────────────────────────────
  if (loading) {
    const steps = [
      { label: "Extracting resume text",       done: loadProgress > 12 },
      { label: "Parsing sections & keywords",   done: loadProgress > 30 },
      { label: "Matching against job posting",  done: loadProgress > 55 },
      { label: "Scoring ATS compatibility",     done: loadProgress > 75 },
      { label: "Rewriting & formatting output", done: loadProgress > 90 },
    ];
    const currentTip = ATS_TIPS[tipIndex];

    return (
      <div className="flex flex-col items-center justify-center min-h-[85vh] px-4 py-10">
        <div className="w-full max-w-lg space-y-6">

          {/* ── Orbital animation + title ── */}
          <div className="glass-card border border-slate-200 rounded-3xl p-8 shadow-2xl text-center space-y-6">

            {/* Orbital rings */}
            <div className="relative mx-auto flex h-32 w-32 items-center justify-center">
              {/* Outer spinning dashed ring */}
              <div
                className="animate-spin-ring absolute inset-0 rounded-full"
                style={{
                  border: "2px dashed rgba(13,148,136,0.25)",
                  borderTopColor: "rgba(13,148,136,0.7)",
                }}
              />
              {/* Inner counter-spinning ring */}
              <div
                className="animate-spin-ring-reverse absolute inset-4 rounded-full"
                style={{
                  border: "2px dashed rgba(94,234,212,0.3)",
                  borderBottomColor: "rgba(94,234,212,0.8)",
                }}
              />
              {/* Orbiting dot 1 */}
              <div className="animate-orbit absolute h-3 w-3 rounded-full bg-teal-400 shadow-lg shadow-teal-400/50" />
              {/* Orbiting dot 2 (offset) */}
              <div
                className="animate-orbit-reverse absolute h-2 w-2 rounded-full bg-teal-200 shadow shadow-teal-300/50"
                style={{ animationDelay: "-2s" }}
              />
              {/* Centre icon */}
              <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 shadow-xl shadow-teal-600/30">
                <Sparkles className="h-7 w-7 text-white" />
                <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-white border-2 border-teal-500 text-[9px] font-extrabold text-teal-700 tracking-tight">
                  AI
                </span>
              </div>
            </div>

            <div>
              <h3 className="font-display text-2xl font-bold text-slate-900">Analyzing Your Resume</h3>
              <p className="mt-1.5 text-sm text-slate-500">{loadingStep || "AI is working hard — this usually takes under 90 seconds"}</p>
              {/* Typing dots */}
              <div className="mt-3 flex items-center justify-center space-x-1.5">
                <div className="float-dot-1 h-2 w-2 rounded-full bg-teal-500" />
                <div className="float-dot-2 h-2 w-2 rounded-full bg-teal-400" />
                <div className="float-dot-3 h-2 w-2 rounded-full bg-teal-300" />
              </div>
            </div>

            {/* Progress bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold text-slate-400">
                <span>Progress</span>
                <span>{Math.round(loadProgress)}%</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full progress-shimmer transition-all duration-700 ease-out"
                  style={{ width: `${loadProgress}%` }}
                />
              </div>
            </div>

            {/* Step checklist */}
            <div className="space-y-2 text-left">
              {steps.map((step, i) => {
                const isActive = !step.done && (i === 0 || steps[i - 1].done);
                return (
                  <div key={i} className="flex items-center space-x-3">
                    <div
                      className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-all duration-500 ${
                        step.done
                          ? "bg-teal-500 text-white"
                          : isActive
                          ? "border-2 border-teal-400 bg-teal-50 text-teal-600"
                          : "border-2 border-slate-200 bg-white text-slate-300"
                      }`}
                    >
                      {step.done ? "✓" : i + 1}
                    </div>
                    <span
                      className={`text-xs font-medium transition-colors duration-300 ${
                        step.done
                          ? "text-teal-700 line-through decoration-teal-300"
                          : isActive
                          ? "text-slate-800"
                          : "text-slate-400"
                      }`}
                    >
                      {step.label}
                    </span>
                    {isActive && (
                      <Loader2 className="h-3.5 w-3.5 text-teal-500 animate-spin flex-shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Cycling tip card ── */}
          <div
            key={tipIndex}
            className={`${tipAnimClass} glass-card border border-teal-100 rounded-2xl p-5 shadow-lg bg-gradient-to-br from-teal-50/80 to-white`}
          >
            <div className="flex items-start space-x-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-teal-500/10 text-xl border border-teal-100">
                {currentTip.icon}
              </div>
              <div>
                <div className="flex items-center space-x-2 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-teal-600">ATS Insight</span>
                  <span className="text-[10px] text-slate-400">{tipIndex + 1}/{ATS_TIPS.length}</span>
                </div>
                <p className="text-sm font-bold text-slate-800">{currentTip.title}</p>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">{currentTip.body}</p>
              </div>
            </div>
            {/* Tip progress dots */}
            <div className="mt-4 flex justify-center space-x-1.5">
              {ATS_TIPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    i === tipIndex ? "w-5 bg-teal-500" : "w-1.5 bg-slate-200"
                  }`}
                />
              ))}
            </div>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      
      {/* Header */}
      <div className="mb-8 text-center md:text-left">
        <h2 className="font-display text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          AI Resume Analyzer & Tailor
        </h2>
        <p className="mt-2 text-sm sm:text-base text-slate-500">
          Upload your resume and paste the target job description to reveal matches and missing keywords.
        </p>
      </div>

      {/* Warning if limit reached */}
      {isLimitReached && (
        <div className="mb-8 flex flex-col md:flex-row items-center justify-between gap-4 rounded-2xl bg-amber-50 border border-amber-200 p-5 shadow-sm">
          <div className="flex items-start space-x-3.5 text-left">
            <AlertCircle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-amber-900 text-sm md:text-base">Quota Limit Reached</h4>
              <p className="text-xs md:text-sm text-amber-800 mt-1">
                You have used {usage?.analyses_count} of your {usage?.monthly_analyses} free monthly analyses. Upgrade to keep using the system.
              </p>
            </div>
          </div>
          <button
            onClick={() => setCurrentPage("pricing")}
            className="w-full md:w-auto flex items-center justify-center space-x-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs uppercase tracking-wide px-4 py-2.5 shadow-md shadow-amber-500/10 transition-colors"
          >
            <span>Upgrade Plan</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Main Form Fields */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        
        {/* Input panel */}
        <div className="lg:col-span-3 space-y-6">
          <div className="glass-card border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="font-display font-bold text-slate-900 text-lg flex items-center space-x-2">
              <FileText className="h-5 w-5 text-teal-600" />
              <span>1. Upload Resume</span>
            </h3>

            {/* File uploader */}
            {!file ? (
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={triggerUploadClick}
                className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all ${
                  dragActive
                    ? "border-teal-500 bg-teal-50/50"
                    : "border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".pdf,.docx,.txt"
                  className="hidden"
                />
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm border border-slate-100 text-slate-400 mb-4">
                  <Upload className="h-6 w-6" />
                </div>
                <div className="font-semibold text-slate-800 text-sm">Drag & drop your resume file</div>
                <p className="text-xs text-slate-400 mt-1.5">Supports PDF, DOCX or TXT (Max 5MB)</p>
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-xl border border-slate-200 p-4 bg-slate-50/50">
                <div className="flex items-center space-x-3.5 min-w-0">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-teal-50 border border-teal-100 text-teal-600">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-800">{file.name}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {(file.size / 1024).toFixed(1)} KB • Ready to extract
                    </div>
                  </div>
                </div>
                <button
                  onClick={removeFile}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-700 transition-colors p-1"
                >
                  Remove
                </button>
              </div>
            )}
          </div>

          {/* Job description field */}
          <div className="glass-card border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="font-display font-bold text-slate-900 text-lg flex items-center space-x-2">
              <Sparkles className="h-5 w-5 text-teal-600" />
              <span>2. Paste Job Description</span>
            </h3>
            
            <div>
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the target job description here..."
                rows={8}
                className="block w-full rounded-2xl border border-slate-200 bg-slate-50/50 p-4 text-sm text-slate-950 placeholder-slate-400 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-500 transition-all resize-none"
              />
              <div className="flex justify-between items-center text-xs text-slate-400 mt-2 px-1">
                <span>Provide as much detail as possible.</span>
                <span>{jobDescription.length} characters</span>
              </div>
            </div>
          </div>
        </div>

        {/* Info panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Usage details */}
          <div className="glass-card border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
            <h4 className="font-display font-bold text-slate-900">Your Plan Details</h4>
            
            <div className="rounded-2xl bg-teal-50/50 border border-teal-100 p-4 flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-400 uppercase tracking-wider font-bold">Active Plan</div>
                <div className="font-display text-lg font-bold text-slate-800 uppercase mt-0.5">{profile?.plan || "Free"}</div>
              </div>
              <button
                onClick={() => setCurrentPage("pricing")}
                className="text-xs font-bold text-teal-600 hover:text-teal-700 transition-colors"
              >
                Change Plan
              </button>
            </div>

            {usage && (
              <div className="space-y-2.5">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 font-medium">Monthly Usage</span>
                  <span className="font-bold text-slate-800">
                    {usage.monthly_analyses === null 
                      ? `${usage.analyses_count} (Unlimited)` 
                      : `${usage.analyses_count} of ${usage.monthly_analyses} used`}
                  </span>
                </div>
                {usage.monthly_analyses !== null && (
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-teal-600 transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          (usage.analyses_count / usage.monthly_analyses) * 100
                        )}%`,
                      }}
                    />
                  </div>
                )}
                {usage.monthly_analyses !== null && (
                  <div className="text-xs text-slate-400 text-center">
                    Quota resets on the first day of next month.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action validation panel */}
          <div className="glass-card border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            {errorMsg && (
              <div className="flex items-start space-x-2.5 rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-800">
                <AlertCircle className="h-5 w-5 text-rose-600 flex-shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              onClick={handleAnalyze}
              disabled={!file || !jobDescription.trim() || isLimitReached}
              className="w-full flex items-center justify-center space-x-2 rounded-2xl bg-teal-600 py-4 text-base font-bold text-white shadow-lg shadow-teal-500/20 hover:bg-teal-700 hover:shadow-teal-600/35 transition-all disabled:opacity-50 disabled:shadow-none"
            >
              <span>Start Analysis</span>
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
