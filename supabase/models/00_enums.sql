-- =============================================================================
-- Kipu · Tipos enumerados (modelo unificado)
-- =============================================================================
-- DDL autoritativo: supabase/migrations/008_remodelado.sql
-- Valores en inglés (tokens usados por la UI).
-- =============================================================================

-- Estado del análisis de una evidencia / versión.
create type evidencia_estado as enum (
  'PROCESSING', 'APPROVED', 'NEEDS_REVISION', 'MANUAL_REVIEW', 'PROCESSING_ERROR'
);

-- Severidad de una alerta.
create type alert_severity as enum ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- Estado del ciclo de vida de una alerta.
create type alert_status as enum (
  'NEW', 'UNDER_REVIEW', 'DISMISSED', 'ESCALATED', 'RESOLVED'
);
