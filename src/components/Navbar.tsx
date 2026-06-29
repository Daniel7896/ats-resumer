import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Menu, X, FileText, History, DollarSign, LogOut, LayoutDashboard, LogIn } from "lucide-react";

interface NavbarProps {
  currentPage: string;
  setCurrentPage: (page: any) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPage, setCurrentPage }) => {
  const { user, profile, usage, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNav = (page: string) => {
    setCurrentPage(page);
    setMobileMenuOpen(false);
  };

  const getPlanBadgeStyles = (plan: string = "free") => {
    switch (plan.toLowerCase()) {
      case "premium":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "standard":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-teal-100 text-teal-800 border-teal-200";
    }
  };

  return (
    <nav className="glass-panel sticky top-0 z-50 w-full border-b border-slate-200 bg-white/75">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between items-center">
          
          {/* Logo / Brand */}
          <div 
            onClick={() => handleNav(user ? "dashboard" : "landing")} 
            className="flex cursor-pointer items-center space-x-2 font-display text-xl font-bold tracking-tight text-slate-900"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-white shadow-md shadow-teal-500/20">
              <FileText className="h-5 w-5" />
            </div>
            <span className="bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">
              ATS Resumer
            </span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {user ? (
              <>
                <button
                  onClick={() => handleNav("dashboard")}
                  className={`flex items-center space-x-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                    currentPage === "dashboard" || currentPage === "results"
                      ? "bg-teal-50 text-teal-700"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span>Dashboard</span>
                </button>

                <button
                  onClick={() => handleNav("history")}
                  className={`flex items-center space-x-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                    currentPage === "history"
                      ? "bg-teal-50 text-teal-700"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <History className="h-4 w-4" />
                  <span>History</span>
                </button>

                <button
                  onClick={() => handleNav("pricing")}
                  className={`flex items-center space-x-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                    currentPage === "pricing"
                      ? "bg-teal-50 text-teal-700"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <DollarSign className="h-4 w-4" />
                  <span>Pricing</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => handleNav("landing")}
                  className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                >
                  Features
                </button>
                <button
                  onClick={() => handleNav("pricing")}
                  className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                >
                  Pricing
                </button>
              </>
            )}
          </div>

          {/* User Status / Action Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            {user ? (
              <div className="flex items-center space-x-3.5">
                {/* Usage statistics display */}
                {usage && (
                  <div className="text-right text-xs">
                    <div className="font-semibold text-slate-700">
                      {usage.monthly_analyses === null
                        ? "Unlimited Access"
                        : `${usage.analyses_count} / ${usage.monthly_analyses} Used`}
                    </div>
                    {usage.monthly_analyses !== null && (
                      <div className="h-1 w-24 overflow-hidden rounded-full bg-slate-200 mt-1">
                        <div
                          className="h-full rounded-full bg-teal-600"
                          style={{
                            width: `${Math.min(
                              100,
                              (usage.analyses_count / usage.monthly_analyses) * 100
                            )}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Plan Badge */}
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${getPlanBadgeStyles(profile?.plan)}`}>
                  {profile?.plan || "Free"}
                </span>

                {/* Log Out */}
                <button
                  onClick={signOut}
                  className="flex items-center space-x-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Log Out</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleNav("auth")}
                className="flex items-center space-x-1.5 rounded-lg bg-teal-600 px-4.5 py-2 text-sm font-semibold text-white shadow-md shadow-teal-500/10 hover:bg-teal-700 transition-colors"
              >
                <LogIn className="h-4 w-4" />
                <span>Sign In</span>
              </button>
            )}
          </div>

          {/* Mobile menu toggle */}
          <div className="flex md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex items-center justify-center rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:outline-none"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-100 bg-white/95 px-4 pt-2 pb-4 space-y-1.5 shadow-lg">
          {user ? (
            <>
              <button
                onClick={() => handleNav("dashboard")}
                className={`flex w-full items-center space-x-2 rounded-lg px-3 py-2 text-base font-medium ${
                  currentPage === "dashboard" ? "bg-teal-50 text-teal-700" : "text-slate-600"
                }`}
              >
                <LayoutDashboard className="h-5 w-5" />
                <span>Dashboard</span>
              </button>
              <button
                onClick={() => handleNav("history")}
                className={`flex w-full items-center space-x-2 rounded-lg px-3 py-2 text-base font-medium ${
                  currentPage === "history" ? "bg-teal-50 text-teal-700" : "text-slate-600"
                }`}
              >
                <History className="h-5 w-5" />
                <span>History</span>
              </button>
              <button
                onClick={() => handleNav("pricing")}
                className={`flex w-full items-center space-x-2 rounded-lg px-3 py-2 text-base font-medium ${
                  currentPage === "pricing" ? "bg-teal-50 text-teal-700" : "text-slate-600"
                }`}
              >
                <DollarSign className="h-5 w-5" />
                <span>Pricing</span>
              </button>
              
              <div className="border-t border-slate-100 my-2 pt-2">
                <div className="px-3 py-1 text-sm font-medium text-slate-500">
                  Plan: <span className="font-bold text-teal-600 uppercase">{profile?.plan || "Free"}</span>
                </div>
                {usage && (
                  <div className="px-3 py-1.5 text-xs text-slate-500">
                    Usage: {usage.monthly_analyses === null ? "Unlimited" : `${usage.analyses_count} of ${usage.monthly_analyses} used`}
                  </div>
                )}
                <button
                  onClick={signOut}
                  className="flex w-full items-center space-x-2 rounded-lg px-3 py-2 text-base font-medium text-red-600 hover:bg-red-50 mt-2"
                >
                  <LogOut className="h-5 w-5" />
                  <span>Log Out</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                onClick={() => handleNav("landing")}
                className="flex w-full items-center rounded-lg px-3 py-2 text-base font-medium text-slate-600"
              >
                Features
              </button>
              <button
                onClick={() => handleNav("pricing")}
                className="flex w-full items-center rounded-lg px-3 py-2 text-base font-medium text-slate-600"
              >
                Pricing
              </button>
              <button
                onClick={() => handleNav("auth")}
                className="flex w-full justify-center items-center space-x-2 rounded-lg bg-teal-600 px-3 py-2.5 text-base font-semibold text-white mt-4"
              >
                <LogIn className="h-5 w-5" />
                <span>Sign In</span>
              </button>
            </>
          )}
        </div>
      )}
    </nav>
  );
};
