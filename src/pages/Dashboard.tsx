import React, { useState, useRef } from "react";
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        throw new Error("Unable to extract sufficient text from your resume. Ensure it is not an image-only scan.");
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
          if (bodyJson.message) {
            errMsg = bodyJson.message;
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

  // Skeleton analysis screen
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[75vh] px-4">
        <div className="w-full max-w-xl text-center space-y-8 glass-card border border-slate-200 rounded-3xl p-8 sm:p-12 shadow-2xl">
          <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-teal-50 border border-teal-200 shadow-md">
            <Loader2 className="h-10 w-10 text-teal-600 animate-spin" />
            <div className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-teal-500 text-[10px] text-white font-bold">
              AI
            </div>
          </div>
          
          <div className="space-y-3">
            <h3 className="font-display text-2xl font-bold text-slate-900">Analyzing Your Resume</h3>
            <p className="text-sm font-medium text-slate-500 animate-pulse-slow">
              {loadingStep}
            </p>
          </div>

          {/* Skeleton progress card */}
          <div className="space-y-4 pt-4 text-left">
            <div className="h-4 w-3/4 rounded bg-slate-100 animate-pulse" />
            <div className="h-4 w-1/2 rounded bg-slate-100 animate-pulse" />
            <div className="space-y-2 pt-2">
              <div className="h-3 w-full rounded bg-slate-100 animate-pulse" />
              <div className="h-3 w-full rounded bg-slate-100 animate-pulse" />
              <div className="h-3 w-5/6 rounded bg-slate-100 animate-pulse" />
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
