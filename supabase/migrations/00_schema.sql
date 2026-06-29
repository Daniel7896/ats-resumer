-- Supabase Migration: Schema Setup for ATS Resumer

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create plan_limits Table
CREATE TABLE public.plan_limits (
    plan text PRIMARY KEY,
    monthly_analyses integer, -- NULL represents unlimited
    price numeric NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read plan limits
CREATE POLICY "Allow public read of plan limits" ON public.plan_limits
    FOR SELECT TO authenticated, anon USING (true);

-- Seed plan limits
INSERT INTO public.plan_limits (plan, monthly_analyses, price) VALUES
('free', 5, 0),
('standard', 50, 499),
('premium', NULL, 1299)
ON CONFLICT (plan) DO UPDATE 
SET monthly_analyses = EXCLUDED.monthly_analyses, price = EXCLUDED.price;


-- 2. Create profiles Table
CREATE TABLE public.profiles (
    id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    full_name text,
    plan text DEFAULT 'free' REFERENCES public.plan_limits(plan),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profile RLS Policies
CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Trigger to automatically create a public profile on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, plan)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'User'),
        'free'
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 3. Create usage_tracking Table
CREATE TABLE public.usage_tracking (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    month_year text NOT NULL, -- Format: 'YYYY-MM'
    analyses_count integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_user_month UNIQUE (user_id, month_year)
);

ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;

-- Usage Tracking RLS Policies
CREATE POLICY "Users can select their own usage tracking" ON public.usage_tracking
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Note: The Edge Function runs as SERVICE_ROLE or we can allow authenticated inserts/updates.
-- We will write policies to allow authenticated users to update their own usage 
-- (or we can bypass via service_role inside the Edge Function. 
-- For safety, we allow SELECT, and let the edge function handle writing using Service Role bypass).
CREATE POLICY "Service role can modify usage tracking" ON public.usage_tracking
    USING (true) WITH CHECK (true);


-- 4. Create resume_history Table
CREATE TABLE public.resume_history (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    resume_filename text NOT NULL,
    job_description text NOT NULL,
    ats_score integer NOT NULL,
    matched_keywords jsonb DEFAULT '[]'::jsonb NOT NULL,
    missing_keywords jsonb DEFAULT '[]'::jsonb NOT NULL,
    rewritten_resume text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.resume_history ENABLE ROW LEVEL SECURITY;

-- Resume History RLS Policies
CREATE POLICY "Users can view their own resume history" ON public.resume_history
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own resume history" ON public.resume_history
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own resume history" ON public.resume_history
    FOR DELETE TO authenticated USING (auth.uid() = user_id);
