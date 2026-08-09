-- Baja lógica (soft delete) de usuarios: marca el perfil como inactivo sin
-- borrar el registro ni sus datos asociados. La baja definitiva (hard delete)
-- elimina la fila y la cuenta de Auth. Un perfil con deleted_at no null está
-- inactivo; además se banea su cuenta de Auth para bloquear el acceso.
alter table profiles
  add column if not exists deleted_at timestamptz;

create index if not exists profiles_deleted_at_idx on profiles(deleted_at);
