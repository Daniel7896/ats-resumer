import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../supabaseClient";
import { FileText, Calendar, Trash2, ChevronRight, Loader2, RefreshCw } from "lucide-react";

interface HistoryRecord {
  id: string;
  resume_filename: string;
  job_description: string;
  ats_score: number;
  matched_keywords: string[];
  missing_keywords: string[];
  rewritten_resume: string;
  created_at: string;
}

interface HistoryProps {
  setCurrentPage: (page: any) => void;
  setAnalysisResult: (result: any) => void;
}

export const History: React.FC<HistoryProps> = ({ setCurrentPage, setAnalysisResult }) => {
  const { user } = useAuth();
  const [historyList, setHistoryList] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchHistory = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("resume_history")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setHistoryList((data as HistoryRecord[]) || []);
    } catch (err) {
      console.error("Error fetching history:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [user]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering open report
    if (!confirm("Are you sure you want to delete this analysis record?")) return;
    
    setDeletingId(id);
    try {
      const { error } = await supabase
        .from("resume_history")
        .delete()
        .eq("id", id);

      if (error) throw error;
      setHistoryList(historyList.filter(item => item.id !== id));
    } catch (err) {
      console.error("Failed to delete record:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleOpenReport = (record: HistoryRecord) => {
    setAnalysisResult({
      ats_score: record.ats_score,
      matched_keywords: record.matched_keywords,
      missing_keywords: record.missing_keywords,
      section_feedback: {
        summary: "Loaded from history record.",
        experience: "Loaded from history record.",
        skills: "Loaded from history record."
      },
      rewritten_resume: record.rewritten_resume,
      resume_filename: record.resume_filename,
      created_at: record.created_at
    });
    setCurrentPage("results");
  };

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  };

  // Helper to color-code score badge
  const getScoreBadgeClass = (score: number) => {
    if (score >= 80) return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (score >= 50) return "bg-amber-50 text-amber-700 border-amber-200";
    return "bg-rose-50 text-rose-700 border-rose-200";
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="h-10 w-10 text-teal-600 animate-spin" />
        <span className="text-sm text-slate-500 font-medium mt-4">Loading your analysis history...</span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-5 mb-8 gap-4">
        <div>
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Analysis History
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Review your past resume analyses, keyword reports, and tailored AI rewrites.
          </p>
        </div>

        <button
          onClick={fetchHistory}
          className="flex items-center space-x-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* History List */}
      {historyList.length === 0 ? (
        <div className="glass-card border border-slate-200 rounded-3xl p-12 text-center max-w-xl mx-auto shadow-sm space-y-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 border border-teal-100 text-teal-600">
            <FileText className="h-7 w-7" />
          </div>
          <div className="space-y-2">
            <h3 className="font-display text-xl font-bold text-slate-950">No Reports Yet</h3>
            <p className="text-sm text-slate-500">
              Run your first resume analysis on the dashboard to start saving your history.
            </p>
          </div>
          <button
            onClick={() => setCurrentPage("dashboard")}
            className="rounded-xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white hover:bg-teal-700 shadow-md shadow-teal-500/15 transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {historyList.map((item) => (
            <div
              key={item.id}
              onClick={() => handleOpenReport(item)}
              className="glass-card border border-slate-200 hover:border-slate-300 rounded-2xl p-5 shadow-sm hover:shadow-md cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-5 transition-all"
            >
              
              {/* Left Details */}
              <div className="flex items-start space-x-4 min-w-0">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600 border border-teal-100">
                  <FileText className="h-5.5 w-5.5" />
                </div>
                <div className="min-w-0 space-y-1">
                  <h4 className="font-semibold text-slate-800 truncate text-base">{item.resume_filename}</h4>
                  
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 font-medium">
                    <span className="flex items-center space-x-1">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{formatDate(item.created_at)}</span>
                    </span>
                    <span className="truncate max-w-[250px] italic">
                      JD: {item.job_description}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right score / action panel */}
              <div className="flex items-center justify-between md:justify-end gap-5">
                <div className="flex items-center space-x-4">
                  
                  {/* Score badge */}
                  <div className={`flex items-center space-x-1.5 rounded-full border px-3 py-1 text-xs font-bold ${getScoreBadgeClass(item.ats_score)}`}>
                    <span className="font-black text-sm">{item.ats_score}%</span>
                    <span className="font-semibold">Match</span>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={(e) => handleDelete(item.id, e)}
                    disabled={deletingId === item.id}
                    title="Delete record"
                    className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 className="h-4.5 w-4.5" />
                  </button>
                </div>

                <ChevronRight className="h-5 w-5 text-slate-400 hidden md:block" />
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
};
