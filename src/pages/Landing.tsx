import React from "react";
import { useAuth } from "../context/AuthContext";
import { FileText, Cpu, ArrowRight, ShieldAlert, Sparkles } from "lucide-react";

interface LandingProps {
  setCurrentPage: (page: any) => void;
}

export const Landing: React.FC<LandingProps> = ({ setCurrentPage }) => {
  const { user } = useAuth();

  const handleCTA = () => {
    if (user) {
      setCurrentPage("dashboard");
    } else {
      setCurrentPage("auth");
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-16 sm:pt-28 sm:pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          
          {/* Badge */}
          <div className="mx-auto mb-6 inline-flex items-center space-x-2 rounded-full border border-teal-200/80 bg-teal-50/50 px-3.5 py-1.5 text-sm font-semibold text-teal-800 backdrop-blur-md">
            <Sparkles className="h-4 w-4 text-teal-600 animate-pulse" />
            <span>Power by Gemini 1.5 Flash</span>
          </div>

          {/* Headline */}
          <h1 className="mx-auto max-w-4xl font-display text-4xl font-extrabold tracking-tight text-slate-900 sm:text-6xl md:text-7xl">
            Optimize Your Resume for{" "}
            <span className="bg-gradient-to-r from-teal-600 via-cyan-600 to-teal-700 bg-clip-text text-transparent">
              ATS Compatibility
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 sm:text-xl">
            Upload your resume, paste any job description, and get an instant ATS compatibility score. Reveal keyword gaps and download a professionally tailored, AI-rewritten resume in seconds.
          </p>

          {/* CTA Group */}
          <div className="mt-10 flex flex-col sm:flex-row justify-center items-center gap-4">
            <button
              onClick={handleCTA}
              className="group flex items-center space-x-2 rounded-xl bg-teal-600 px-7 py-4 text-base font-bold text-white shadow-lg shadow-teal-500/20 hover:bg-teal-700 hover:shadow-teal-600/35 transition-all transform hover:-translate-y-0.5"
            >
              <span>Get Started Free</span>
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </button>
            
            <button
              onClick={() => setCurrentPage("pricing")}
              className="rounded-xl border border-slate-200 bg-white/70 px-7 py-4 text-base font-bold text-slate-700 hover:bg-slate-50 transition-all transform hover:-translate-y-0.5"
            >
              View Pricing
            </button>
          </div>
        </div>

        {/* Floating UI Demo Preview (pure CSS) */}
        <div className="mx-auto mt-16 max-w-4xl px-4 sm:px-6">
          <div className="glass-panel overflow-hidden rounded-2xl border border-slate-200 shadow-2xl">
            
            {/* Window bar */}
            <div className="flex h-11 items-center justify-between border-b border-slate-200 bg-slate-50 px-4">
              <div className="flex space-x-1.5">
                <div className="h-3 w-3 rounded-full bg-slate-300" />
                <div className="h-3 w-3 rounded-full bg-slate-300" />
                <div className="h-3 w-3 rounded-full bg-slate-300" />
              </div>
              <div className="text-xs font-semibold text-slate-400">ATS Resumer - Dashboard Mockup</div>
              <div className="w-12" />
            </div>

            {/* Content Mockup */}
            <div className="grid grid-cols-1 md:grid-cols-3 bg-white p-6 gap-6 text-left">
              <div className="md:col-span-2 space-y-4">
                <div className="rounded-xl border-2 border-dashed border-slate-200 p-8 text-center bg-slate-50/50">
                  <FileText className="mx-auto h-10 w-10 text-teal-600 mb-2" />
                  <div className="font-semibold text-slate-800 text-sm">resume_software_engineer.pdf</div>
                  <div className="text-xs text-slate-400 mt-1">Successfully parsed • 12.4 KB</div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Job Description</label>
                  <div className="rounded-xl border border-slate-200 p-4 bg-slate-50 text-xs text-slate-500 font-mono h-24 overflow-hidden">
                    We are looking for a Software Engineer with experience in React, TypeScript, and database indexing. You should have strong communication skills and be comfortable with Git pipelines...
                  </div>
                </div>
              </div>

              {/* Sidebar score preview */}
              <div className="rounded-2xl bg-teal-900/5 p-6 border border-teal-900/10 flex flex-col justify-between space-y-6">
                <div className="text-center">
                  <div className="text-sm font-semibold text-slate-600">ATS Score</div>
                  <div className="font-display text-5xl font-black text-teal-600 mt-2">84%</div>
                  <div className="text-[11px] text-teal-800 font-bold bg-teal-100 rounded-full px-2 py-0.5 mt-2 inline-block">Good Match</div>
                </div>

                <div className="space-y-3">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Keyword Matches</div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5">React</span>
                    <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5">TypeScript</span>
                    <span className="text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 rounded-full px-2 py-0.5">Database Indexing</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid Section */}
      <section className="bg-slate-50 border-y border-slate-200 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Engineered to Bypass Rigid Filtering Systems
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Modern resume screens reject 75% of applicants before human eyes ever read them. Here is how we ensure you get through.
            </p>
          </div>

          <div className="mx-auto mt-16 max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="glass-card rounded-2xl p-8 hover:-translate-y-1 transition-all">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-100 text-teal-600 mb-6">
                <FileText className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">ATS Compatibility Score</h3>
              <p className="text-sm leading-relaxed text-slate-600">
                Get an instant breakdown showing how well your resume matches the target role. No guesswork, just pure metric evaluation.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="glass-card rounded-2xl p-8 hover:-translate-y-1 transition-all">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-100 text-teal-600 mb-6">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Keyword Gap Analysis</h3>
              <p className="text-sm leading-relaxed text-slate-600">
                Instantly scan for missing soft and hard skills, certificates, and tool tags that the ATS is looking for.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="glass-card rounded-2xl p-8 hover:-translate-y-1 transition-all">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-100 text-teal-600 mb-6">
                <Cpu className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">AI Resume Rewrite</h3>
              <p className="text-sm leading-relaxed text-slate-600">
                Generate tailored bullet points emphasizing metrics and impact. Copy-paste directly into your resume or download.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing / Process Steps */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Get Hired in 3 Simple Steps
          </h2>

          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-12 relative max-w-4xl mx-auto">
            {/* Step 1 */}
            <div className="flex flex-col items-center space-y-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-600 text-white font-display text-2xl font-bold shadow-lg shadow-teal-500/20">
                1
              </div>
              <h3 className="text-lg font-bold text-slate-900">Upload & Paste</h3>
              <p className="text-sm text-slate-500 max-w-xs">
                Drag and drop your PDF or Word resume, and paste the job description text.
              </p>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center space-y-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-600 text-white font-display text-2xl font-bold shadow-lg shadow-teal-500/20">
                2
              </div>
              <h3 className="text-lg font-bold text-slate-900">AI Deep Scan</h3>
              <p className="text-sm text-slate-500 max-w-xs">
                Our Gemini edge function analyzes keywords, semantic alignment, and scores the profile.
              </p>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center space-y-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-600 text-white font-display text-2xl font-bold shadow-lg shadow-teal-500/20">
                3
              </div>
              <h3 className="text-lg font-bold text-slate-900">Export Optimized PDF</h3>
              <p className="text-sm text-slate-500 max-w-xs">
                Refine the rewritten resume in the built-in editor and export it to apply.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-slate-50 py-12 text-center text-sm text-slate-500">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p>© 2026 ATS Resumer. Built for job seekers seeking high-converting job applications.</p>
        </div>
      </footer>
    </div>
  );
};
