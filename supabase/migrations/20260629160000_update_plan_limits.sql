-- Supabase Migration: Update Plan Limits Pricing and Quotas
-- Standard Plan: 25 analyses/month, Price 299 INR
-- Premium Plan: 50 analyses/month, Price 599 INR

UPDATE public.plan_limits 
SET monthly_analyses = 25, price = 299 
WHERE plan = 'standard';

UPDATE public.plan_limits 
SET monthly_analyses = 50, price = 599 
WHERE plan = 'premium';
