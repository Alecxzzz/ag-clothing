# A&G CLOTHING

Tienda de ropa con **MongoDB**, cuenta para clientes y panel de administración
con apartado de **pedidos**. El pedido se cierra por WhatsApp.

Node.js + driver oficial de MongoDB.

## Cómo arrancarla

1. Comprueba que el servicio **MongoDB** esté iniciado (en Windows: servicio `MongoDB`).
2. Arranca el servidor:

```bash
cd ag-clothing
node server.js
```

3. Abre 👉 **http://localhost:3000**

La primera vez el servidor crea solo la base de datos `ag_clothing`, las colecciones
(`usuarios`, `productos`, `pedidos`), los dos administradores y 10 productos de ejemplo.

Si copias el proyecto a otro equipo: `npm install` (instala el driver `mongodb` y el generador de QR).

## 📱 Verla desde el móvil (misma Wi-Fi)

El servidor escucha en **toda la red local** y al arrancar imprime la dirección y un **QR**:

```
   En este equipo : http://localhost:3000
   Desde el móvil : http://192.168.11.101:3000
   ...(QR para escanear con la cámara)...
```

1. La PC y el móvil tienen que estar en la **misma red Wi-Fi**.
2. En el móvil abre `http://192.168.11.101:3000` — o escanea el QR que sale en la terminal.
3. Para el panel desde el móvil: `http://192.168.11.101:3000/admin.html` (con tu usuario y contraseña de admin).
4. Deja la PC encendida y la terminal con `node server.js` abierta: si la cierras, la web se apaga.

Notas:

- La IP (`192.168.11.101`) puede cambiar si el router la reasigna: mira siempre la que imprime
  el servidor al arrancar. Para fijarla, reserva la IP en el router.
- Si el móvil no carga nada, abre el puerto en el firewall (PowerShell **como administrador**):

```powershell
New-NetFirewallRule -DisplayName "AG tienda 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private,Public
```

- Solo funciona dentro de tu red. Para que la vea alguien **fuera de casa** hace falta un túnel
  temporal (`npx localtunnel --port 3000`) o publicarla en un hosting.

## 🌍 Que la vea desde otra casa (internet)

La forma rápida es un **túnel de Cloudflare**: convierte tu servidor local en una dirección
`https://...trycloudflare.com` accesible desde cualquier sitio, sin cuenta y sin abrir puertos.

**Lo más fácil:** doble clic en **`iniciar-publico.bat`**. Arranca el servidor y el túnel, y en la
ventana aparece la dirección para pasar por WhatsApp.

A mano sería:

```powershell
node server.js                                             # en una ventana
tools\cloudflared.exe tunnel --url http://localhost:3000   # en otra
```

Importante:

- La dirección **cambia cada vez** que arrancas el túnel, y solo vive mientras la PC esté encendida
  y esa ventana abierta.
- Es una dirección **pública**: cualquiera que la tenga puede ver el catálogo y entrar a
  `/admin.html`. No la publiques en redes y usa contraseñas fuertes.
- Si la PC se suspende, el túnel se cae.

Para algo **permanente** (URL fija, sin depender de tu PC):

1. **MongoDB Atlas** (gratis): crea un cluster y copia su cadena de conexión.
2. Sube el proyecto a **Render** o **Railway** como *Web Service* (`node server.js`).
3. Variables de entorno en el hosting: `MONGODB_URI` (la de Atlas) y `PORT` (la da el hosting).

## 🚀 Publicar en Vercel (gratis)

El proyecto ya está preparado para **Vercel**: estáticos + una función serverless.

1. **MongoDB Atlas** (obligatorio, Vercel no puede usar tu MongoDB local):
   crea un cluster gratis en [mongodb.com/atlas](https://www.mongodb.com/atlas), crea un usuario de
   base de datos y copia su cadena `mongodb+srv://...`.
2. **GitHub**: sube el proyecto.

   ```bash
   git remote add origin https://github.com/alecxzzz/ag-clothing.git
   git push -u origin main
   ```

3. **Vercel**: entra en [vercel.com/new](https://vercel.com/new), importa el repositorio
   `ag-clothing` y pulsa *Deploy*. No hay que tocar el *build*: Vercel sirve `public/` como
   estáticos y `api/[...ruta].js` como función.
4. **Environment Variables** (Project → Settings → Environment Variables):

   | Variable | Valor |
   | --- | --- |
   | `MONGODB_URI` | la cadena de MongoDB Atlas |
   | `MONGODB_BD` | `ag_clothing` (opcional, es el valor por defecto) |

Qué hace cada parte en Vercel:

| Parte | Dónde vive |
| --- | --- |
| HTML, CSS, JS e imágenes de `public/` | archivos estáticos en la raíz del dominio |
| `/api/*` (cuentas, productos, pedidos, fotos) | `api/[...ruta].js` → `server.js` |

Diferencias respecto a ejecutarlo en tu PC:

- Las **sesiones** se guardan en la colección `sesiones` (Vercel no comparte memoria entre
  peticiones) y caducan solas a los 7 días.
- Las **fotos** se guardan en la colección `archivos` y se sirven en `/api/img/<id>`, porque en
  Vercel el disco es de solo lectura. Límite de 4 MB por foto (Vercel corta en 4,5 MB).
- La conexión a MongoDB se abre una sola vez por instancia (arranque en frío).
- `tools/cloudflared.exe` no se sube al repositorio: con Vercel ya no hace falta el túnel.

En local todo sigue igual: `node server.js` y abre `http://localhost:3000`.

## Cuentas de administración

| Usuario | Nombre |
| --- | --- |
| `admin` | Administración A&G |
| `glaaa` | Gladys |

Se crean automáticamente al arrancar si no existen, con la contraseña definida en
`ADMINISTRADORES` (al principio de `server.js`). **Las contraseñas no se documentan aquí a
propósito**: cámbialas antes de publicar el sitio y mantén el repositorio en privado.

Para cambiarlas: edita `ADMINISTRADORES`, o borra el usuario en MongoDB y vuelve a arrancar.

Los **clientes** se registran en `cuenta.html`. El login acepta **usuario o correo**.
Las contraseñas se guardan cifradas con `scrypt` y la sesión va en una cookie `HttpOnly`.

## Cómo funciona

1. **Catálogo** (`index.html`): buscador, filtros por categoría, selector de talla y carrito lateral.
2. **Finalizar compra** (`checkout.html`): nombre completo, correo, teléfono y dirección + cuenta
   (**BAC** o **LAFISE**). Al enviar, el pedido se guarda en MongoDB y se abre WhatsApp con:
   > Hola A&G CLOTHING 👋 Quiero comprar: • 2 × Camiseta Oversize Essential (M) — C$900.00.
   > Total: C$900.00. Quiero pagar a la cuenta BAC Credomatic N.º 000000000 (Titular).
   > Mi pedido es #67a1… Espero su respuesta, gracias.
3. **Panel** (`admin.html`), con dos pestañas:
   - **Productos**: crear, editar, marcar agotado y eliminar.
   - **Pedidos**: datos del cliente, productos, total, forma de pago, botón para escribirle por
     WhatsApp y selector de estado (`pendiente → pagado → enviado / cancelado`).

## Base de datos

- Servidor: `mongodb://127.0.0.1:27017` (configurable con `MONGODB_URI`).
- Base de datos: `ag_clothing` (configurable con `MONGODB_BD`).

Colecciones:

| Colección | Contenido |
| --- | --- |
| `usuarios` | `nombre`, `email`, `usuario` (admins), `clave` (hash), `rol`, `creado` |
| `productos` | `nombre`, `categoria`, `precio`, `precioAntes`, `tallas[]`, `badge`, `imagen`, `descripcion`, `disponible` |
| `pedidos` | `cliente{...}`, `metodo`, `total`, `estado`, `items[]`, `creado`, `usuarioId` |
| `sesiones` | `token`, `usuarioId`, `expira` (índice TTL: se borran solas) |
| `archivos` | `tipo`, `datos` (base64), `tamanio`, `creado` — fotos de productos |
| `sistema` | marca interna: el catálogo de ejemplo ya se sembró |

Para verla:

```bash
mongosh
use ag_clothing
db.usuarios.find().pretty()
db.productos.countDocuments()
db.pedidos.find().sort({ creado: -1 })
```

Copia de seguridad: `mongodump --db ag_clothing --out respaldo`

## Dónde se cambia lo importante

| Qué | Dónde |
| --- | --- |
| Usuarios y contraseñas de admin | `server.js` → `ADMINISTRADORES` |
| Productos de ejemplo | `server.js` → `PRODUCTOS_INICIALES` |
| WhatsApp, cuentas BAC/LAFISE, moneda, marca | `public/js/comun.js` → `CONFIG` |
| Fotos del inicio (hero) | `public/img/hero/` → `portada.jpg`, `hombre.jpg`, `accesorios.jpg` |
| Colores y tipografías | `public/css/estilos.css` → `:root` |

## Estructura

```
ag-clothing/
├── server.js              # servidor HTTP + API + MongoDB (local y Vercel)
├── api/[...ruta].js       # función serverless de Vercel → server.js
├── vercel.json            # ajustes de despliegue
├── package.json
├── .env.example           # variables de entorno de ejemplo
├── _respaldo/             # base SQLite de la versión anterior
├── tools/                 # cloudflared (túnel local; no se sube al repo)
└── public/
    ├── index.html         # catálogo + carrito
    ├── cuenta.html        # iniciar sesión / crear cuenta
    ├── checkout.html      # datos + forma de pago + WhatsApp
    ├── admin.html         # productos y pedidos
    ├── css/estilos.css
    ├── img/hero/          # fotos del inicio (portada, hombre, accesorios)
    └── js/ (api, comun, tienda, cuenta, checkout, admin)
```

## API

| Método | Ruta | Quién |
| --- | --- | --- |
| POST | `/api/registro`, `/api/login`, `/api/logout` | público |
| GET | `/api/sesion` | público |
| POST | `/api/upload-img` | solo admin (guarda la foto en MongoDB) |
| GET | `/api/img/:id` | público |
| GET | `/api/productos` | público (el admin ve también los agotados) |
| POST / PUT / DELETE | `/api/productos`, `/api/productos/:id` | solo admin |
| POST | `/api/pedidos` | público (guarda el pedido) |
| GET | `/api/pedidos` | solo admin |
| PATCH | `/api/pedidos/:id` | solo admin (cambia el estado) |

## Notas y límites

- Las sesiones viven en MongoDB (colección `sesiones`): sobreviven a reinicios y funcionan en
  Vercel. Caducan solas a los 7 días.
- Las fotos de productos se guardan en MongoDB: máximo **4 MB** por imagen.
- Los precios se recalculan en el servidor al crear el pedido (el cliente no puede alterarlos).
- La tienda no cobra sola: el pago es una transferencia que se confirma a mano por WhatsApp.
- Para publicarla necesitas MongoDB accesible desde internet (MongoDB Atlas) y un hosting con
  Node: Vercel (ver arriba), Render, Railway o un VPS.
