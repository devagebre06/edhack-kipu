# Usuarios demo — Kipu

**Tres cuentas, una por rol.** Es todo lo que hace falta para recorrer la
plataforma.

## 🔑 Contraseña (las tres)

```
KipuDemo2026!
```

Configurable con `DEMO_PASSWORD` en `api/.env` al correr los scripts.

---

## Logins

`director@` y `profesor@` están ligados al mismo colegio (**ANGELITOS DE
MARIA**) y con datos, para que ningún panel salga vacío.

| Rol | Email | Qué ve |
|---|---|---|
| **UGEL** | `ugel@kipu.demo` | Métricas agregadas, mapa diagnóstico, tarjetas de docentes y alertas de toda la UGEL |
| **Director** | `director@kipu.demo` | Su colegio: profesores, artefactos, alertas, contextos |
| **Profesor** | `profesor@kipu.demo` | Subida de evidencias, unidades y calendario (María Elena Torres Salazar) |

Se crean/actualizan con:

```bash
cd api && npm run db:demo-users
```

> Idempotente: garantiza los tres logins y **purga** cualquier otra cuenta de rol
> UGEL o director, además de las cuentas de Auth que quedaron sin fila en
> `usuarios`.

---

## Los 30 docentes son datos, no cuentas de trabajo

Además de los tres logins, la tabla `usuarios` guarda **30 docentes**
(`profe.<dni>@kipu.demo`). No se usan para entrar: existen porque sostienen los
60 dictados —y con ellos las aulas, alumnos y notas— y porque alimentan las
tarjetas de docentes del panel UGEL (`vw_profesor_resumen`, una fila por
docente). Borrarlos vaciaría esa sección del panel.

Uno de ellos, el de menor dni, es el que `db:demo-users` promueve a
`profesor@kipu.demo`.

---

## Requisito previo (poblar la DB)

Los datos que ven los paneles existen solo tras correr, **en este orden**:

```bash
cd api
npm run db:poblacion    # colegios, docentes, aulas, alumnos y notas (data UGEL 06)
npm run db:seed         # ugel + director, periodos, unidades/evaluaciones demo y alertas
npm run db:demo-users   # los tres logins de arriba + purga de cuentas sobrantes
```
