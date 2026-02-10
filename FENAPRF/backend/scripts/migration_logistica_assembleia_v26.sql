-- Migration: Link Logistics Event to Assembly (1:N)
-- Date: 2026-02-10

ALTER TABLE public.logistica_eventos
ADD COLUMN assembleia_id UUID REFERENCES public.assembleias(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.logistica_eventos.assembleia_id IS 'ID da assembleia vinculada a este evento logístico';
