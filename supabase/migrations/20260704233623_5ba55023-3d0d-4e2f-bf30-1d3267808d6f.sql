REVOKE ALL ON public.call_logs FROM anon;
REVOKE ALL ON public.call_logs FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON public.call_logs TO authenticated;
GRANT ALL ON public.call_logs TO service_role;