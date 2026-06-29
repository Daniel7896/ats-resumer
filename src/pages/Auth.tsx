import React, { useState } from "react";
import { supabase } from "../supabaseClient";
import { Mail, Lock, User, AlertCircle, FileText, ArrowRight } from "lucide-react";

interface AuthProps {
  setCurrentPage: (page: any) => void;
}

export const Auth: React.FC<AuthProps> = ({ setCurrentPage }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (isSignUp) {
        // Sign Up Flow
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName || "User",
            },
          },
        });

        if (error) throw error;
        setSuccessMsg("Account created! Please check your email for a verification link or sign in.");
        // If auto-sign in is not enabled by default, let them log in.
      } else {
        // Sign In Flow
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
        // AuthContext will update user state automatically, redirect user to dashboard
        setCurrentPage("dashboard");
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      setErrorMsg(err.message || "An authentication error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[85vh] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 glass-card border border-slate-200 rounded-3xl p-8 sm:p-10 shadow-xl">
        
        {/* Title / Logo */}
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-600 text-white shadow-md shadow-teal-500/20 mb-4">
            <FileText className="h-6 w-6" />
          </div>
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-slate-900">
            {isSignUp ? "Create Your Account" : "Sign In to Your Workspace"}
          </h2>
          <p className="mt-2.5 text-sm text-slate-500">
            {isSignUp
              ? "Start optimizing your resume for ATS instantly"
              : "Access your dashboard, history, and generated resumes"}
          </p>
        </div>

        {/* Message Alerts */}
        {errorMsg && (
          <div className="flex items-center space-x-2.5 rounded-xl bg-rose-50 border border-rose-200 p-4 text-sm text-rose-800">
            <AlertCircle className="h-5 w-5 text-rose-600 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-center space-x-2.5 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800">
            <AlertCircle className="h-5 w-5 text-emerald-600 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {isSignUp && (
            <div className="space-y-1">
              <label htmlFor="full-name" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Full Name
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <User className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="full-name"
                  name="name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm text-slate-950 placeholder-slate-400 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-500 transition-all"
                  placeholder="John Doe"
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label htmlFor="email-address" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Email Address
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Mail className="h-5 w-5 text-slate-400" />
              </div>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm text-slate-950 placeholder-slate-400 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-500 transition-all"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="password-field" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Password
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Lock className="h-5 w-5 text-slate-400" />
              </div>
              <input
                id="password-field"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm text-slate-950 placeholder-slate-400 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-500 transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="group flex w-full items-center justify-center space-x-2 rounded-xl bg-teal-600 py-3 text-sm font-semibold text-white shadow-md shadow-teal-500/10 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-all disabled:opacity-50"
          >
            <span>{loading ? "Processing..." : isSignUp ? "Create Account" : "Sign In"}</span>
            {!loading && <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />}
          </button>
        </form>

        {/* Toggle Switch */}
        <div className="text-center pt-2">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className="text-sm font-semibold text-teal-600 hover:text-teal-700 transition-colors focus:outline-none"
          >
            {isSignUp
              ? "Already have an account? Sign In"
              : "Don't have an account? Sign Up Free"}
          </button>
        </div>
      </div>
    </div>
  );
};
