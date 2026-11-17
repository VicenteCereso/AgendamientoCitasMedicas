-- =====================================================================
-- Foto del esquema "public" para comparar DESARROLLO vs PRODUCCIÓN.
-- Solo lectura: no modifica nada.
--
-- Uso: ejecutar en el SQL Editor de cada proyecto, exportar el resultado
-- (botón "Export" > CSV) y comparar ambos archivos (p. ej. en VS Code:
-- clic derecho > "Select for Compare" / "Compare with Selected").
-- =====================================================================
select * from (
  -- Columnas
  select 'COLUMNA' as objeto,
         c.table_name || '.' || c.column_name as nombre,
         c.data_type
           || case when c.is_nullable = 'NO' then ' NOT NULL' else '' end
           || coalesce(' DEFAULT ' || c.column_default, '') as detalle
  from information_schema.columns c
  join information_schema.tables t
    on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
  where c.table_schema = 'public'

  union all
  -- Índices (incluye únicos)
  select 'INDICE', tablename || '.' || indexname, indexdef
  from pg_indexes
  where schemaname = 'public'

  union all
  -- Restricciones: PK, FK, UNIQUE, CHECK
  select 'RESTRICCION', rel.relname || '.' || con.conname, pg_get_constraintdef(con.oid)
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace n on n.oid = rel.relnamespace
  where n.nspname = 'public'

  union all
  -- RLS activado por tabla
  select 'RLS', c.relname, case when c.relrowsecurity then 'activado' else 'DESACTIVADO' end
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'

  union all
  -- Políticas RLS
  select 'POLITICA', tablename || '.' || policyname,
         cmd || ' TO ' || array_to_string(roles, ',')
           || coalesce(' USING (' || qual || ')', '')
           || coalesce(' CHECK (' || with_check || ')', '')
  from pg_policies
  where schemaname = 'public'

  union all
  -- Funciones
  select 'FUNCION', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
         md5(pg_get_functiondef(p.oid))
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f'

  union all
  -- Triggers
  select 'TRIGGER', event_object_table || '.' || trigger_name,
         action_timing || ' ' || event_manipulation || ' ' || action_statement
  from information_schema.triggers
  where trigger_schema = 'public'
) esquema
order by objeto, nombre, detalle;
