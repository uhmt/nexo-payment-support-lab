# Nexo | Payment Support Lab

**Un pago aprobado. Un pedido pendiente. ¿Qué pasó entre los dos?**

Nexo es una aplicación interactiva para simular problemas de pagos, investigar su causa y documentar una solución. Permite recorrer el proceso completo: crear un pedido, provocar una incidencia, revisar los eventos y resolver el caso.

**[Probar la demo](https://nexoproj.netlify.app/)** · Datos ficticios, sin pagos reales ni registro de cuenta.

Proyecto de **Diego García**, que conecta mi experiencia en atención bancaria con mi formación en desarrollo de software.

**React · TypeScript · Netlify Functions · PostgreSQL** en la demo pública. **Node.js · Express · SQLite** en desarrollo local.

> Todo ocurre en un entorno de simulación con datos ficticios. Nexo no mueve dinero ni se conecta a bancos o proveedores de pago reales.

## El problema que explora

Que un proveedor apruebe un pago no significa que una tienda haya recibido la confirmación. Una notificación puede fallar o llegar más de una vez. Nexo hace visibles esas situaciones para entender qué ocurrió y recuperar el flujo sin duplicar sus efectos.

| Escenario | Qué ocurre | Qué puedes investigar |
| --- | --- | --- |
| Pago aprobado | La confirmación llega correctamente | El recorrido de un pago exitoso |
| Pago rechazado | El proveedor simulado rechaza el intento | El motivo y un nuevo intento de pago |
| Notificación fallida | El pago se aprueba, pero el pedido queda pendiente | La entrega fallida y su recuperación |
| Evento duplicado | La misma notificación llega de nuevo | Cómo evitar aplicar el pago dos veces |

## Funcionalidades

- Crear pedidos con nombre ficticio e importe personalizado.
- Ejecutar cuatro escenarios: aprobado, rechazado, notificación fallida y evento duplicado.
- Seguir el historial y examinar el JSON de cada entrega.
- Recuperar una notificación pendiente sin crear un segundo pago.
- Simular un nuevo intento aprobado tras un rechazo.
- Abrir incidencias, definir prioridad, guardar notas, investigar, resolver y reabrir.
- Buscar, filtrar, ordenar y exportar pedidos a CSV.
- Consultar métricas calculadas a partir de los datos de la sesión.
- Recargar conservando el trabajo y reiniciar solo la demo propia.
- Utilizar la interfaz con teclado, móvil o escritorio.

## Tecnologías y su función

| Tecnología | Uso en Nexo |
| --- | --- |
| React | Pantallas, formularios, filtros y visualización del estado de los casos |
| TypeScript | Tipos compartidos para pedidos, eventos, incidencias y comandos |
| CSS | Interfaz oscura y diseño adaptable a móvil y escritorio |
| Node.js + Express | Servidor local que atiende solicitudes de la interfaz |
| SQLite | Almacenamiento local de sesiones y su historial |
| Netlify Functions + PostgreSQL | API y persistencia de la demo pública |
| Cloudflare Workers + D1 | Alternativa de alojamiento que se conserva en el código |
| Drizzle Kit | Generación de migraciones para la alternativa de Cloudflare D1 |
| esbuild | Compilación y empaquetado de la aplicación |
| Node.js Test Runner + tsx | Ejecución de pruebas automatizadas escritas en TypeScript |
| Lucide | Iconos de la interfaz |

## Ejecutar localmente

Necesitas **Node.js 24** y **pnpm 11 o superior**. Descarga o clona el repositorio y abre una terminal en la carpeta que contiene `package.json`.

```sh
pnpm install
pnpm build
pnpm start
```

Abre **http://127.0.0.1:8787** en tu navegador. No necesitas claves de APIs externas para probarlo.

La base SQLite se crea en `.data/nexo.sqlite`. `PORT` cambia el puerto y `NEXO_DATABASE` permite elegir otra ruta para la base. Después de modificar el frontend, ejecuta de nuevo `pnpm build` y recarga. Reinicia el servidor si cambias el backend.

Para ejecutar las pruebas y comprobar los tipos:

```sh
pnpm test
pnpm typecheck
```

## Demostración de dos minutos

1. Abre **Simulador → La conexión perdida** y ejecuta el escenario.
2. Pulsa **Ver resultado**. El pago está aprobado, pero el pedido sigue pendiente: la entrega respondió 503.
3. Examina la entrega y su JSON. Observa el identificador del evento.
4. Pulsa **Recuperar notificación**. El pedido queda confirmado y el contador de pagos aplicados sube a uno.
5. Pulsa **Reenviar evento duplicado**. La nueva entrega queda registrada como ignorada y el contador continúa en uno.
6. Abre la incidencia vinculada, escribe lo que investigaste y cómo lo resolviste, y marca el caso como resuelto.
7. Recarga la página: el pedido, el historial y la nota siguen guardados.

## Cómo está organizado

| Archivo | Responsabilidad |
| --- | --- |
| `src/main.tsx` | Pantallas, formularios, filtros, navegación y solicitudes al servidor |
| `src/style.css` | Diseño oscuro y adaptación a pantallas pequeñas |
| `src/types.ts` | Modelo compartido de pedidos, eventos e incidencias |
| `server/domain.ts` | Reglas de negocio y simulador, sin dependencia de HTTP o base de datos |
| `server/api.ts` | Endpoints, validación y protección de las solicitudes |
| `server/store.ts` | Persistencia y control de versiones para cambios concurrentes |
| `server/local.ts` | Servidor Express y SQLite para desarrollo local |
| `server/worker.ts` | Entrada de Cloudflare Workers para la versión alojada |
| `db/schema.ts`, `drizzle/` | Esquema y migraciones de la base alojada |
| `tests/core.test.ts` | Pruebas del dominio, API y concurrencia con SQLite |

La interfaz usa React y TypeScript; el backend comparte las mismas reglas entre Node/Express local y Cloudflare Workers. La versión alojada utiliza D1. Los iconos son de Lucide. No necesita claves de servicios externos.

## Decisiones que vale la pena entender

**Dos estados distintos.** El estado del proveedor no es el estado del pedido. El proveedor puede aprobar un pago y fallar la notificación que actualiza el pedido. Se registra ese desacuerdo para poder investigarlo.

**Idempotencia.** Los eventos tienen un identificador único. Si ya fue aplicado, otra entrega queda en el historial pero no repite la operación. Además, cada comando tiene un `requestId`; reenviar la misma solicitud devuelve el resultado guardado. Esto permite un reintento automático si se pierde la respuesta de red.

**Dinero en centavos.** RD$123.45 se guarda como `12345`, un entero. Se valida en el servidor, junto con los nombres, notas, prioridades y estados.

**Concurrencia.** Cada sesión tiene una versión. El servidor guarda con `UPDATE ... WHERE version = ?`. Si otra solicitud se adelantó, vuelve a leer y reevalúa la operación. La verificación del evento y la modificación del pedido se guardan juntas.

**Persistencia acotada.** Una sesión es un agregado JSON en una fila SQL. Esta elección hace pequeña y comprensible la demo y permite guardar de forma atómica el historial completo. No es un diseño recomendado para un libro contable de gran escala: allí convendría normalizar pedidos, eventos, transacciones e incidencias, además de usar restricciones y consultas específicas.

**Sesiones separadas.** Una cookie aleatoria `HttpOnly` identifica la demo; los comandos requieren un token CSRF y verifican el origen. La cookie dura 30 días. No hay cuentas ni recuperación entre dispositivos; al borrar la cookie se crea otra sesión. Los registros no tienen eliminación automática por antigüedad en esta versión.

**Límites.** Hasta 200 pedidos, 100 notas por incidencia, 1,500 entregas, 3,000 entradas de actividad y 2,000 solicitudes registradas por sesión. Al alcanzar un límite, la app solicita reiniciar la demo. No tiene correo, proveedores de pago, webhooks externos, firma criptográfica de eventos, colas ni reintentos automáticos de entregas: la recuperación se inicia desde la interfaz.

## API

`GET /api/state` inicia o recupera una sesión y devuelve `{ state, version, csrf }`.

`POST /api/commands` recibe JSON, la cookie de sesión y la cabecera `X-CSRF-Token`. Todas las operaciones requieren un `requestId` único de 8 a 100 caracteres.

| `type` | Campos |
| --- | --- |
| `simulate` | `scenario`: `approved`, `declined`, `delayed` o `duplicate`; `customer` e `amount` en centavos opcionales |
| `retry` | `orderId` |
| `duplicate` | `orderId` |
| `incident` | `orderId`, `title`, `severity`: `high`, `medium` o `low` |
| `note` | `incidentId`, `text` |
| `status` | `incidentId`, `status`: `open`, `investigating` o `resolved` |
| `reset` | Sin campos adicionales |

`GET /api/health` informa si el proceso responde; no comprueba la conectividad de la base.

Para cambiar el esquema de la demo alojada en Netlify, añade una nueva migración SQL en `netlify/database/migrations/`. Para la alternativa de Cloudflare D1, edita `db/schema.ts` y genera una migración con `pnpm exec drizzle-kit generate`. Revisa las migraciones antes de aplicarlas y no modifiques una que ya se haya aplicado. El esquema local inicial está en `migrations/0001_sessions.sql`.

## Verificación

Las pruebas cubren los cuatro escenarios, 25 duplicados consecutivos sin repetir efectos, preservación del intento rechazado, repetición segura de solicitudes, validación monetaria, resolución documentada, aislamiento de sesiones, CSRF, origen, JSON inválido y escrituras concurrentes. También se revisa el recorrido principal en el navegador.

## Desarrollo

Desarrollado con asistencia de herramientas de IA.

El código separa la interfaz, las reglas de negocio y la persistencia. Los tipos compartidos están en `src/types.ts`; la simulación, en `server/domain.ts`; los endpoints, en `server/api.ts`; y el control de actualizaciones concurrentes, en `server/store.ts`.

## Publicación en Netlify

La configuración está en `netlify.toml`. Usa `pnpm build`, publica `dist/client` y ejecuta la API desde `netlify/functions/nexo.mts`.

La [demo pública](https://nexoproj.netlify.app/) usa Netlify Database con PostgreSQL. La migración `netlify/database/migrations/0001_sessions.sql` crea la tabla de sesiones. La conexión se obtiene con `@netlify/database`; no se guardan contraseñas en el repositorio.

Cada sesión conserva su estado en una fila, con consultas parametrizadas y control de versión para evitar que actualizaciones simultáneas sobrescriban cambios. La prueba `tests/postgres.test.ts` ejecuta la migración y comprueba persistencia, aislamiento y concurrencia con PostgreSQL embebido (PGlite). Los datos del alojamiento anterior no se migran automáticamente.

El servidor local continúa usando SQLite. El código para Cloudflare se conserva como alternativa de alojamiento.

## Mejoras pendientes

Estas mejoras están pendientes; no forman parte de la versión actual:

- Añadir búsqueda por identificador de evento y sus pruebas.
- Incorporar una guía dentro de la aplicación para explicar cada escenario.

## Autor

**Diego Arturo García Vélez** · Desarrollador junior

[GitHub](https://github.com/uhmt) · [LinkedIn](https://www.linkedin.com/in/diego-garc%C3%ADa-0919b02b0/)
