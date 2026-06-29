import React, { createContext, useContext, useEffect, useState } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "../supabaseClient";


interface UserProfile {
  id: string;
  full_name: string;
  plan: string;
  created_at: string;
}

interface MonthlyUsage {
  analyses_count: number;
  monthly_analyses: number | null; // null = unlimited
  remaining_quota: number | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  usage: MonthlyUsage | null;
  loading: boolean;
  signOut: () => Promise<void>;
  fetchUsage: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [usage, setUsage] = useState<MonthlyUsage | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) {
        console.error("Error fetching user profile:", error);
        return null;
      }
      return data as UserProfile;
    } catch (err) {
      console.error("Profile query error:", err);
      return null;
    }
  };

  const fetchUsage = async () => {
    if (!user || !profile) return;
    try {
      const now = new Date();
      const monthYear = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

      // 1. Fetch analyses count for this month
      const { data: usageData, error: usageErr } = await supabase
        .from("usage_tracking")
        .select("analyses_count")
        .eq("user_id", user.id)
        .eq("month_year", monthYear)
        .maybeSingle();

      if (usageErr) {
        console.error("Error fetching usage tracker:", usageErr);
      }

      // 2. Fetch limits for active plan
      const { data: limitData, error: limitErr } = await supabase
        .from("plan_limits")
        .select("monthly_analyses")
        .eq("plan", profile.plan)
        .single();

      if (limitErr) {
        console.error("Error fetching plan limits:", limitErr);
      }

      const count = usageData?.analyses_count || 0;
      const limit = limitData ? limitData.monthly_analyses : 5; // fallback to 5

      setUsage({
        analyses_count: count,
        monthly_analyses: limit,
        remaining_quota: limit !== null ? Math.max(0, limit - count) : null,
      });
    } catch (err) {
      console.error("Usage refresh error:", err);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      const prof = await fetchProfile(user.id);
      setProfile(prof);
    }
  };

  // Sync usage whenever profile updates
  useEffect(() => {
    if (user && profile) {
      fetchUsage();
    } else {
      setUsage(null);
    }
  }, [user, profile?.plan]);

  useEffect(() => {
    // Check active session immediately
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      const activeUser = session?.user ?? null;
      setUser(activeUser);
      
      if (activeUser) {
        const prof = await fetchProfile(activeUser.id);
        setProfile(prof);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        const activeUser = newSession?.user ?? null;
        setUser(activeUser);

        if (activeUser) {
          const prof = await fetchProfile(activeUser.id);
          setProfile(prof);
        } else {
          setProfile(null);
          setUsage(null);
        }
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setUsage(null);
    setLoading(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        usage,
        loading,
        signOut,
        fetchUsage,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
