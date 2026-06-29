import React from "react";
import { useAuth } from "../context/AuthContext";
import { Sparkles, FileText, Cpu, ArrowRight, CheckCircle2, UserCheck } from "lucide-react";

interface WelcomeProps {
  setCurrentPage: (page: any) => void;
}

export const Welcome: React.FC<WelcomeProps> = ({ setCurrentPage }) => {
  const { user, profile } = useAuth();
  
  const displayName = profile?.full_name || user?.user_metadata?.full_name || "there";

  const handleGetStarted = () => {
    if (user) {
      localStorage.setItem(`hasSeenWelcome_${user.id}`, "true");
    }
    setCurrentPage("dashboard");
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-3xl text-center space-y-8 glass-panel border border-slate-200 rounded-3xl p-8 sm:p-12 shadow-2xl relative overflow-hidden">
        
        {/* Decorative background glow elements */}
        <div className="absolute -top-12 -left-12 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Celebratory badge */}
        <div className="mx-auto inline-flex items-center space-x-2 rounded-full border border-teal-200/80 bg-teal-50/70 px-4 py-2 text-sm font-semibold text-teal-800 backdrop-blur-md animate-bounce-slow">
          <UserCheck className="h-4.5 w-4.5 text-teal-600 animate-pulse" />
          <span>Account Created Successfully!</span>
        </div>

        {/* Greeting & Header */}
        <div className="space-y-3.5">
          <h2 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
            Welcome to ATS Resumer, <span className="bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent capitalize">{displayName}</span>!
          </h2>
          <p className="mx-auto max-w-xl text-sm sm:text-base text-slate-500 leading-relaxed">
            We are excited to help you optimize your job search. Let's make sure your resume stands out and sails past the automated application filters.
          </p>
        </div>

        {/* How it Works / Core Features list */}
        <div className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
          {/* Step 1 */}
          <div className="glass-card rounded-2xl p-5 border border-slate-100 flex flex-col justify-between space-y-4 hover:shadow-md transition-all">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 border border-teal-100 text-teal-600 font-semibold">
              1
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm flex items-center space-x-1.5">
                <FileText className="h-4 w-4 text-teal-600" />
                <span>Upload & Match</span>
              </h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Drop your current resume and paste the description of the role you want to land.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="glass-card rounded-2xl p-5 border border-slate-100 flex flex-col justify-between space-y-4 hover:shadow-md transition-all">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 border border-teal-100 text-teal-600 font-semibold">
              2
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm flex items-center space-x-1.5">
                <Cpu className="h-4 w-4 text-teal-600" />
                <span>Scan for Gaps</span>
              </h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Our Gemini AI scans your file for missing skills, keywords, and compatibility criteria.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="glass-card rounded-2xl p-5 border border-slate-100 flex flex-col justify-between space-y-4 hover:shadow-md transition-all">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 border border-teal-100 text-teal-600 font-semibold">
              3
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm flex items-center space-x-1.5">
                <Sparkles className="h-4 w-4 text-teal-600" />
                <span>Optimize & Apply</span>
              </h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Instantly generate high-scoring, tailored bullet points and download your polished PDF.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Tips */}
        <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 max-w-xl mx-auto flex items-start space-x-3 text-left">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-slate-700">Quick Pro-Tip:</h4>
            <p className="text-[11px] text-slate-500 leading-normal">
              You have <strong>5 free monthly analyses</strong>. When matching a resume, use a specific job description rather than a generic one for the highest accuracy.
            </p>
          </div>
        </div>

        {/* Main CTA */}
        <div className="pt-4">
          <button
            onClick={handleGetStarted}
            className="group mx-auto flex items-center space-x-2 rounded-2xl bg-teal-600 px-8 py-4 text-base font-bold text-white shadow-xl shadow-teal-500/20 hover:bg-teal-700 hover:shadow-teal-600/35 transition-all transform hover:-translate-y-0.5"
          >
            <span>Start Your First Analysis</span>
            <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
};
