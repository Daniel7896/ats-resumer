import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../supabaseClient";
import { Check, ArrowRight, Loader2, Award, Zap, ShieldCheck } from "lucide-react";

interface PlanLimit {
  plan: string;
  monthly_analyses: number | null;
  price: number;
}

interface PricingProps {
  setCurrentPage: (page: any) => void;
}

export const Pricing: React.FC<PricingProps> = ({ setCurrentPage }) => {
  const { user, profile, refreshProfile, fetchUsage } = useAuth();
  
  const [plans, setPlans] = useState<PlanLimit[]>([
    { plan: "free", monthly_analyses: 5, price: 0 },
    { plan: "standard", monthly_analyses: 50, price: 499 },
    { plan: "premium", monthly_analyses: null, price: 1299 }
  ]);
  const [updatingPlan, setUpdatingPlan] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);


  useEffect(() => {
    const fetchPlanLimits = async () => {
      try {
        const { data, error } = await supabase
          .from("plan_limits")
          .select("*")
          .order("price", { ascending: true });

        if (error) throw error;
        if (data && data.length > 0) {
          setPlans(data.map(p => ({
            plan: p.plan,
            monthly_analyses: p.monthly_analyses,
            price: Number(p.price)
          })));
        }
      } catch (err) {
        console.warn("Failed to load plan limits from DB. Using local defaults:", err);
      }
    };

    fetchPlanLimits();
  }, []);

  const handlePlanUpgrade = async (planName: string) => {
    if (!user) {
      setCurrentPage("auth");
      return;
    }

    setUpdatingPlan(planName);
    setSuccessMsg(null);

    try {
      // Direct updates of user profiles inside Supabase for live sandbox testing
      const { error } = await supabase
        .from("profiles")
        .update({ plan: planName })
        .eq("id", user.id);

      if (error) throw error;

      // Sync global auth state profiles and usages
      await refreshProfile();
      await fetchUsage();

      setSuccessMsg(`Successfully upgraded to the ${planName.toUpperCase()} plan!`);
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err) {
      console.error("Upgrade error:", err);
    } finally {
      setUpdatingPlan(null);
    }
  };

  const getPlanIcon = (planName: string) => {
    if (planName === "premium") return <Award className="h-6 w-6 text-amber-500" />;
    if (planName === "standard") return <Zap className="h-6 w-6 text-teal-600" />;
    return <ShieldCheck className="h-6 w-6 text-slate-400" />;
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      
      {/* Title */}
      <div className="text-center max-w-3xl mx-auto mb-16">
        <h2 className="font-display text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
          Simple, Transparent Pricing
        </h2>
        <p className="mt-4 text-base sm:text-lg text-slate-500">
          No hidden fees, cancel anytime. Choose a plan that matches your job hunt pace.
        </p>

        {successMsg && (
          <div className="mt-8 inline-flex items-center space-x-2 rounded-2xl bg-emerald-50 border border-emerald-200 px-6 py-3 text-sm text-emerald-800 shadow-sm">
            <span className="font-semibold">{successMsg}</span>
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch max-w-5xl mx-auto">
        {plans.map((p) => {
          const isActive = profile?.plan === p.plan;
          
          return (
            <div
              key={p.plan}
              className={`relative flex flex-col justify-between rounded-3xl p-8 transition-all glass-panel border ${
                isActive
                  ? "border-teal-500 ring-2 ring-teal-500/20 scale-[1.03] shadow-lg bg-teal-50/10"
                  : "border-slate-200 shadow-sm hover:border-slate-300"
              }`}
            >
              {/* Highlight badge for standard/popular plan */}
              {p.plan === "standard" && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-teal-600 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                  Most Popular
                </span>
              )}

              {/* Top details */}
              <div className="space-y-6 text-left">
                <div className="flex justify-between items-center">
                  <h3 className="font-display text-xl font-bold uppercase tracking-wide text-slate-800">
                    {p.plan}
                  </h3>
                  {getPlanIcon(p.plan)}
                </div>

                <div className="flex items-baseline text-slate-900">
                  <span className="font-display text-5xl font-black">₹{p.price}</span>
                  <span className="ml-1 text-sm font-semibold text-slate-400">/month</span>
                </div>

                <p className="text-sm text-slate-500">
                  {p.plan === "free" && "Perfect for testing compatibility and quick edits."}
                  {p.plan === "standard" && "Built for active job hunters applying weekly."}
                  {p.plan === "premium" && "Ultimate package for recruiters and power users."}
                </p>

                {/* Features */}
                <ul className="space-y-4 pt-6 border-t border-slate-100">
                  <li className="flex items-start space-x-3 text-sm">
                    <Check className="h-4.5 w-4.5 text-teal-600 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-600 font-medium">
                      {p.monthly_analyses === null 
                        ? "Unlimited analyses / month" 
                        : `${p.monthly_analyses} resume analyses / month`}
                    </span>
                  </li>
                  <li className="flex items-start space-x-3 text-sm">
                    <Check className="h-4.5 w-4.5 text-teal-600 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-600 font-medium">Full keyword gap reports</span>
                  </li>
                  <li className="flex items-start space-x-3 text-sm">
                    <Check className="h-4.5 w-4.5 text-teal-600 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-600 font-medium">AI Tailored markdown resumes</span>
                  </li>
                  <li className="flex items-start space-x-3 text-sm">
                    <Check className="h-4.5 w-4.5 text-teal-600 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-600 font-medium">Download as Word & PDF</span>
                  </li>
                </ul>
              </div>

              {/* Upgrade Trigger Button */}
              <div className="pt-8">
                <button
                  onClick={() => handlePlanUpgrade(p.plan)}
                  disabled={isActive || updatingPlan !== null}
                  className={`w-full flex items-center justify-center space-x-1.5 rounded-2xl py-3.5 text-sm font-bold shadow-md transition-all ${
                    isActive
                      ? "bg-slate-100 text-slate-500 shadow-none cursor-default"
                      : "bg-teal-600 hover:bg-teal-700 text-white shadow-teal-500/10"
                  }`}
                >
                  {updatingPlan === p.plan ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                      <span>Updating...</span>
                    </>
                  ) : isActive ? (
                    <span>Active Plan</span>
                  ) : (
                    <>
                      <span>{user ? `Upgrade to ${p.plan}` : "Get Started"}</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
};
