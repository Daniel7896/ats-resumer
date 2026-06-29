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

const loadScript = (src: string): Promise<boolean> => {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export const Pricing: React.FC<PricingProps> = ({ setCurrentPage }) => {
  const { user, profile, refreshProfile, fetchUsage } = useAuth();
  
  const [plans, setPlans] = useState<PlanLimit[]>([
    { plan: "free", monthly_analyses: 5, price: 0 },
    { plan: "standard", monthly_analyses: 25, price: 299 },
    { plan: "premium", monthly_analyses: 50, price: 599 }
  ]);
  const [updatingPlan, setUpdatingPlan] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) {
        throw new Error("No active authentication session. Please sign in again.");
      }

      // Check if we should use mock payment flow (DEV environment only and no Key ID configured)
      const useMockFlow = import.meta.env.DEV && !import.meta.env.VITE_RAZORPAY_KEY_ID;

      // 1. Create the order via create-razorpay-order Edge Function
      const createOrderUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-razorpay-order`;
      const orderRes = await fetch(createOrderUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
          "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY
        },
        body: JSON.stringify({ plan: planName, mock: useMockFlow })
      });

      if (!orderRes.ok) {
        const errData = await orderRes.json();
        throw new Error(errData.error || "Failed to initiate transaction");
      }

      const orderData = await orderRes.json();

      // If it's a zero-price plan (e.g. downgrading/resetting to free), it directly transitions without payment checkout
      if (orderData.zeroPrice) {
        await refreshProfile();
        await fetchUsage();
        setSuccessMsg(`Successfully updated plan to ${planName.toUpperCase()}!`);
        setTimeout(() => setSuccessMsg(null), 5000);
        return;
      }

      if (useMockFlow) {
        // Mock Sandbox Checkout Flow (DEV environment only)
        const confirmMock = window.confirm(
          `[SANDBOX MODE] Simulate successful payment of ₹${orderData.amount / 100} for standard/premium upgrade?`
        );

        if (!confirmMock) {
          throw new Error("Mock payment cancelled by user");
        }

        // Call verify-payment Edge Function with mock details
        const verifyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-payment`;
        const verifyRes = await fetch(verifyUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
            "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY
          },
          body: JSON.stringify({
            razorpay_order_id: orderData.id,
            razorpay_payment_id: `pay_mock_${Math.random().toString(36).substring(2, 15)}`,
            razorpay_signature: "mock_signature_approved"
          })
        });

        if (!verifyRes.ok) {
          const errData = await verifyRes.json();
          throw new Error(errData.error || "Mock payment verification failed");
        }

        const verifyData = await verifyRes.json();
        if (!verifyData.success) {
          throw new Error("Mock payment verification returned failure");
        }

        await refreshProfile();
        await fetchUsage();
        setSuccessMsg(`[MOCK] Successfully upgraded to the ${planName.toUpperCase()} plan! A confirmation details email has been simulated to ${user.email}.`);
        setTimeout(() => setSuccessMsg(null), 7000);
        return;
      }

      // Real Checkout Flow
      const isLoaded = await loadScript("https://checkout.razorpay.com/v1/checkout.js");
      if (!isLoaded) {
        throw new Error("Failed to load Razorpay Checkout SDK. Check your internet connection.");
      }

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "ATS Resumer",
        description: `Upgrade to ${planName.toUpperCase()} Plan`,
        order_id: orderData.id,
        handler: async function (response: any) {
          try {
            setUpdatingPlan(planName);
            const verifyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-payment`;
            const verifyRes = await fetch(verifyUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${session.access_token}`,
                "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            });

            if (!verifyRes.ok) {
              const errData = await verifyRes.json();
              throw new Error(errData.error || "Payment verification failed");
            }

            const verifyData = await verifyRes.json();
            if (!verifyData.success) {
              throw new Error("Payment verification failed");
            }

            await refreshProfile();
            await fetchUsage();
            setSuccessMsg(`Successfully upgraded to the ${planName.toUpperCase()} plan! A confirmation details email has been sent to ${user.email}.`);
            setTimeout(() => setSuccessMsg(null), 7000);
          } catch (err: any) {
            console.error("Signature verification error:", err);
            alert(`Payment verification failed: ${err.message}`);
          } finally {
            setUpdatingPlan(null);
          }
        },
        prefill: {
          name: profile?.full_name || "",
          email: user.email || ""
        },
        theme: {
          color: "#0d9488"
        }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", function (response: any) {
        console.error("Payment failed:", response.error);
        alert(`Payment failed: ${response.error.description}`);
      });
      rzp.open();

    } catch (err: any) {
      console.error("Subscription upgrade failed:", err);
      setErrorMsg(err.message || "An unexpected error occurred during checkout.");
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
          <div className="mt-8 inline-flex items-center space-x-2 rounded-2xl bg-emerald-50 border border-emerald-200 px-6 py-3 text-sm text-emerald-800 shadow-sm animate-pulse">
            <span className="font-semibold">{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="mt-8 inline-flex items-center space-x-2 rounded-2xl bg-rose-50 border border-rose-200 px-6 py-3 text-sm text-rose-800 shadow-sm">
            <span className="font-semibold">{errorMsg}</span>
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
                    <span className="text-slate-600 font-medium">
                      {p.plan === "free" ? "Last 3 history saved" : "Full history saved"}
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
                      <span>Processing...</span>
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
