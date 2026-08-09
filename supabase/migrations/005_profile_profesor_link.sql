-- Kipu ↔ UGEL 06: enlaza el perfil docente con su profesor del diagnóstico.
-- En teoría el docente Kipu (profiles) y el profesor UGEL 06 (ugel06_profesor)
-- son la misma persona; el DNI es la llave que los relaciona. Nullable: un
-- docente puede no estar aún vinculado a su ficha UGEL.
alter table profiles
  add column if not exists dni text references ugel06_profesor(dni);

create index if not exists profiles_dni_idx on profiles(dni);
