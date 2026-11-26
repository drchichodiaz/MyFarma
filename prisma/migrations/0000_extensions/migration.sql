-- Extensiones que usa MyFarma:
--   postgis   → ubicaciones de sucursales y radios de alertas (ST_DWithin, ST_Distance)
--   pg_trgm   → búsqueda difusa de medicamentos (errores de tipeo)
--   unaccent  → "losartan" encuentra "Losartán"
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
