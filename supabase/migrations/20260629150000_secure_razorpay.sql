-- Supabase Migration: Secure Razorpay & Profiles RLS Hardening

-- 1. Harden profiles table RLS policies to prevent users from self-updating their plan.
-- Users can still update their full_name, but the plan column is protected.
-- Only the service_role key (which bypasses RLS) can update a user's plan.
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id 
        AND plan IS NOT DISTINCT FROM (SELECT plan FROM public.profiles WHERE id = auth.uid())
    );

-- Comment explaining the security design:
-- The subquery (SELECT plan FROM public.profiles WHERE id = auth.uid()) queries the table in its pre-update state.
-- This ensures that any update statement modifying profiles.plan to a value different from the existing database row
-- will fail the WITH CHECK condition for normal authenticated users.

-- 2. Create payments table to log transaction details.
CREATE TABLE IF NOT EXISTS public.payments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    razorpay_order_id text NOT NULL UNIQUE,
    razorpay_payment_id text,
    razorpay_signature text,
    plan text REFERENCES public.plan_limits(plan) NOT NULL,
    amount numeric NOT NULL,
    status text NOT NULL, -- 'created', 'paid', 'failed'
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own payment history
CREATE POLICY "Users can view their own payments" ON public.payments
    FOR SELECT TO authenticated USING (auth.uid() = user_id);
