# Usuarios demo — Kipu

Cuentas de prueba para recorrer la plataforma por rol.

## 🔑 Contraseña (todas las cuentas)

```
KipuDemo2026!
```

Configurable con `DEMO_PASSWORD` en `api/.env` al correr los scripts.

---

## ⭐ Logins recomendados (simples)

Los tres logins fáciles para la demo. `director@` y `profesor@` están ligados al
mismo colegio (**ANGELITOS DE MARIA**) y con datos, para que ningún panel salga
vacío.

| Rol | Email | Qué ve |
|---|---|---|
| **UGEL** | `ugel@kipu.demo` | Métricas agregadas, mapa diagnóstico y alertas de toda la UGEL |
| **Director** | `director@kipu.demo` | Su colegio: profesores, artefactos, alertas, contextos |
| **Profesor** | `profesor@kipu.demo` | Subida de evidencias, unidades y calendario (María Elena Torres) |

Se crean/actualizan con:

```bash
cd api && npm run db:demo-users
```

> El script es idempotente: borra las cuentas `javier.*@kipu.demo` (descontinuadas),
> garantiza los tres logins simples y no toca a los demás profesores.

---

## Requisito previo (poblar la DB)

Las cuentas de referencia de abajo (y los datos que ven los paneles) existen solo
tras correr, **en este orden**:

```bash
cd api
npm run db:poblacion    # profesores + colegios (data UGEL 06)
npm run db:seed         # UGEL, directores, unidades/evaluaciones demo y alertas
npm run db:demo-users   # logins simples de arriba
```

---

## Cuentas de referencia (seed)

Además de los logins simples, el seed genera una cuenta por director y por
profesor. Útiles si quieres entrar como un colegio específico.

### Directores (15) — `director.<school_key>@kipu.demo`

| Email | Colegio |
|---|---|
| `director.ugel06_rei01_cl300720@kipu.demo` | 219 CESAR AUGUSTO |
| `director.ugel06_rei01_cl300796@kipu.demo` | 157 |
| `director.ugel06_rei01_cl752547@kipu.demo` | ANGELITOS DE MARIA |
| `director.ugel06_rei01_cl777251@kipu.demo` | PAMPAS TINAJAS |
| `director.ugel06_rei01_cl780102@kipu.demo` | MI PEQUEÑO MUNDO |
| `director.ugel06_rei02_cl307397@kipu.demo` | 130 OSCAR EDUARDO BRAVO RATTO |
| `director.ugel06_rei02_cl307439@kipu.demo` | 121 VIRGEN DE FÁTIMA |
| `director.ugel06_rei02_cl307463@kipu.demo` | 140 VIRGEN DE LA MERCED |
| `director.ugel06_rei02_cl307482@kipu.demo` | 136 |
| `director.ugel06_rei02_cl719015@kipu.demo` | 112 |
| `director.ugel06_rei03_cl291730@kipu.demo` | N° 500 EL BOSQUE |
| `director.ugel06_rei03_cl291768@kipu.demo` | Nº 0074 FERNANDO BELAUNDE TERRY |
| `director.ugel06_rei03_cl292070@kipu.demo` | N° 1136 JOHN F KENNEDY |
| `director.ugel06_rei03_cl292522@kipu.demo` | 142 GRUMETE MEDINA |
| `director.ugel06_rei03_cl293767@kipu.demo` | NIÑITA MARÍA |

### Profesores — `profe.<dni>@kipu.demo`

> Nota: `profe.98000001` fue renombrado a **`profesor@kipu.demo`** por el script
> `db:demo-users`; por eso no aparece abajo.

| Email | Nombre | Curso | Colegio |
|---|---|---|---|
| `profe.98000002@kipu.demo` | Carlos Alberto Mendoza Ríos | Comunicación | ANGELITOS DE MARIA |
| `profe.98000003@kipu.demo` | Rosa Patricia Fernández León | Matemática | PAMPAS TINAJAS |
| `profe.98000004@kipu.demo` | José Luis Ramírez Castro | Comunicación | PAMPAS TINAJAS |
| `profe.98000005@kipu.demo` | Ana Lucía Paredes Soto | Matemática | MI PEQUEÑO MUNDO |
| `profe.98000006@kipu.demo` | Miguel Ángel Herrera Vargas | Comunicación | MI PEQUEÑO MUNDO |
| `profe.98000007@kipu.demo` | Claudia Isabel Rojas Medina | Matemática | 219 CESAR AUGUSTO |
| `profe.98000008@kipu.demo` | Jorge Eduardo Salazar Peña | Comunicación | 219 CESAR AUGUSTO |
| `profe.98000009@kipu.demo` | Diana Carolina Flores Núñez | Matemática | 157 |
| `profe.98000010@kipu.demo` | Luis Fernando Vega Ortiz | Comunicación | 157 |
| `profe.98000011@kipu.demo` | Paola Andrea Castro Reyes | Matemática | 112 |
| `profe.98000012@kipu.demo` | Ricardo Alonso Navarro Cruz | Comunicación | 112 |
| `profe.98000013@kipu.demo` | Gabriela Sofía Medina Campos | Matemática | 130 OSCAR EDUARDO BRAVO RATTO |
| `profe.98000014@kipu.demo` | Eduardo Martín Aguilar León | Comunicación | 130 OSCAR EDUARDO BRAVO RATTO |
| `profe.98000015@kipu.demo` | Verónica Alejandra Cabrera Silva | Matemática | 140 VIRGEN DE LA MERCED |
| `profe.98000016@kipu.demo` | Sergio Antonio Morales Fuentes | Comunicación | 140 VIRGEN DE LA MERCED |
| `profe.98000017@kipu.demo` | Natalia Beatriz Vargas Lozano | Matemática | 121 VIRGEN DE FÁTIMA |
| `profe.98000018@kipu.demo` | Fernando Javier Castillo Ríos | Comunicación | 121 VIRGEN DE FÁTIMA |
| `profe.98000019@kipu.demo` | Mónica Patricia Espinoza Peña | Matemática | 136 |
| `profe.98000020@kipu.demo` | Hugo Andrés Benavides Soto | Comunicación | 136 |
| `profe.98000021@kipu.demo` | Elena Marisol Fuentes Castro | Matemática | Nº 0074 FERNANDO BELAUNDE TERRY |
| `profe.98000022@kipu.demo` | Raúl Ernesto Peña Salazar | Comunicación | Nº 0074 FERNANDO BELAUNDE TERRY |
| `profe.98000023@kipu.demo` | Cecilia Lorena Silva Paredes | Matemática | N° 500 EL BOSQUE |
| `profe.98000024@kipu.demo` | Óscar Daniel Núñez Herrera | Comunicación | N° 500 EL BOSQUE |
| `profe.98000025@kipu.demo` | Patricia Milagros León Rojas | Matemática | 142 GRUMETE MEDINA |
| `profe.98000026@kipu.demo` | Javier Alonso Soto Medina | Comunicación | 142 GRUMETE MEDINA |
| `profe.98000027@kipu.demo` | Lucía Fernanda Reyes Vargas | Matemática | NIÑITA MARÍA |
| `profe.98000028@kipu.demo` | Marco Antonio Campos Navarro | Comunicación | NIÑITA MARÍA |
| `profe.98000029@kipu.demo` | Teresa del Pilar Lozano Cruz | Matemática | N° 1136 JOHN F KENNEDY |
| `profe.98000030@kipu.demo` | Andrés Felipe Cabrera Torres | Comunicación | N° 1136 JOHN F KENNEDY |
