import React, { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Navbar } from "./components/Navbar";
import { Landing } from "./pages/Landing";
import { Auth } from "./pages/Auth";
import { Dashboard } from "./pages/Dashboard";
import { Results } from "./pages/Results";
import { History } from "./pages/History";
import { Pricing } from "./pages/Pricing";
import { Loader2, AlertTriangle } from "lucide-react";
import { isSupabaseConfigured } from "./supabaseClient";

type Page = "landing" | "auth" | "dashboard" | "results" | "history" | "pricing";

const SupabaseWarning: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12">
      <div className="max-w-md w-full space-y-8 glass-panel border border-slate-200 rounded-3xl p-8 shadow-xl text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 border border-amber-200 text-amber-600">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <div className="space-y-3">
          <h2 className="font-display text-2xl font-black text-slate-900">Supabase Connection Required</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            It looks like your local environment is not yet connected to Supabase. To run this project, configure your project keys in a <code>.env</code> file.
          </p>
        </div>

        <div className="border-t border-slate-100 pt-6 text-left space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Setup Instructions</h3>
          
          <div className="flex items-start space-x-3 text-xs text-slate-600">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-50 border border-teal-100 text-teal-600 font-bold">1</span>
            <span>Create a file named <code>.env</code> in the root directory.</span>
          </div>

          <div className="flex items-start space-x-3 text-xs text-slate-600">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-50 border border-teal-100 text-teal-600 font-bold">2</span>
            <div className="space-y-1">
              <span>Paste your Supabase credentials into the file:</span>
              <pre className="mt-1 bg-slate-800 text-slate-200 p-3 rounded-lg font-mono text-[10px] select-all leading-normal">
{`VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5c...`}
              </pre>
            </div>
          </div>

          <div className="flex items-start space-x-3 text-xs text-slate-600">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-50 border border-teal-100 text-teal-600 font-bold">3</span>
            <span>Restart the dev server to reload environment variables.</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>("landing");
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  // Basic Router Guards
  useEffect(() => {
    if (loading) return;

    const privatePages = ["dashboard", "results", "history"];
    
    // Redirect unauthenticated users trying to access private dashboard pages
    if (!user && privatePages.includes(currentPage)) {
      setCurrentPage("landing");
    }

    // Redirect authenticated users trying to access landing/auth
    if (user && (currentPage === "landing" || currentPage === "auth")) {
      setCurrentPage("dashboard");
    }
  }, [user, loading, currentPage]);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <Loader2 className="mx-auto h-10 w-10 text-teal-600 animate-spin" />
          <p className="text-sm font-semibold text-slate-500 animate-pulse-slow">Loading workspace context...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar currentPage={currentPage} setCurrentPage={setCurrentPage} />
      <main className="flex-grow">
        {currentPage === "landing" && <Landing setCurrentPage={setCurrentPage} />}
        {currentPage === "auth" && <Auth setCurrentPage={setCurrentPage} />}
        {currentPage === "dashboard" && (
          <Dashboard 
            setCurrentPage={setCurrentPage} 
            setAnalysisResult={setAnalysisResult} 
          />
        )}
        {currentPage === "results" && (
          <Results 
            result={analysisResult} 
            setCurrentPage={setCurrentPage} 
          />
        )}
        {currentPage === "history" && (
          <History 
            setCurrentPage={setCurrentPage} 
            setAnalysisResult={setAnalysisResult} 
          />
        )}
        {currentPage === "pricing" && <Pricing setCurrentPage={setCurrentPage} />}
      </main>
    </div>
  );
};

export default function App() {
  if (!isSupabaseConfigured) {
    return <SupabaseWarning />;
  }

  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
