/* ==========================================================================
   A&G CLOTHING — servidor con MongoDB
   Node.js + driver oficial de MongoDB.

   Local:   node server.js          ->  http://localhost:3000
   Vercel:  api/[...ruta].js importa este archivo (funciones serverless)

   Variables: PORT, MONGODB_URI, MONGODB_BD
   En Vercel, MONGODB_URI debe apuntar a un cluster de MongoDB Atlas.
   ========================================================================== */

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { MongoClient, ObjectId } = require("mongodb");
const busboy = require("busboy");

/* QR opcional en la terminal (si el paquete está instalado) */
let qrcode = null;
try {
  qrcode = require("qrcode-terminal");
} catch (error) {
  qrcode = null;
}

const PUERTO = Number(process.env.PORT) || 3000;
const PUBLICO = path.join(__dirname, "public");
const URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const NOMBRE_BD = process.env.MONGODB_BD || "ag_clothing";

/* ---------- Administradores ------------------------------------------- */
/* Se crean al arrancar si no existen en la base de datos. */
const ADMINISTRADORES = [
  { usuario: "admin", email: "admin@agyclothing.com", clave: "alec1212", nombre: "Administración A&G" },
  { usuario: "glaaa", email: "glaaa@agyclothing.com", clave: "gladys.8", nombre: "Gladys" },
];

/* ---------- Catálogo de ejemplo ---------------------------------------- */
const PRODUCTOS_INICIALES = [
  { nombre: "Camisa Lino Relaxed", categoria: "Hombre", precio: 750, precioAntes: 950, tallas: ["S", "M", "L", "XL"], badge: "Oferta", imagen: "", descripcion: "Lino europeo, botonadura completa y bolsillo.", disponible: true },
  { nombre: "Pantalón Cargo Utility", categoria: "Hombre", precio: 820, precioAntes: 0, tallas: ["30", "32", "34", "36"], badge: "", imagen: "", descripcion: "Sarga resistente con bolsillos laterales.", disponible: true },
  { nombre: "Hoodie A&G Essential", categoria: "Hombre", precio: 700, precioAntes: 0, tallas: ["M", "L", "XL"], badge: "Nuevo", imagen: "", descripcion: "Fleece perchado, capucha doble y puños elásticos.", disponible: true },
];

const conexion = new MongoClient(URI, { serverSelectionTimeoutMS: 5000 });
let bd = null;
let preparandoBd = null;

/* ---------- Utilidades -------------------------------------------------- */
function ahora() {
  return new Date().toISOString();
}

function cifrarClave(clave) {
  const sal = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(clave), sal, 64).toString("hex");
  return sal + ":" + hash;
}

function claveCorrecta(clave, guardada) {
  const partes = String(guardada || "").split(":");
  if (partes.length !== 2) return false;
  const calculado = crypto.scryptSync(String(clave), partes[0], 64);
  const esperado = Buffer.from(partes[1], "hex");
  return calculado.length === esperado.length && crypto.timingSafeEqual(calculado, esperado);
}

function sinClave(usuario) {
  return { id: String(usuario._id), nombre: usuario.nombre, email: usuario.email, usuario: usuario.usuario || "", rol: usuario.rol };
}

function aProducto(doc) {
  return {
    id: String(doc._id),
    nombre: doc.nombre,
    categoria: doc.categoria,
    precio: doc.precio,
    precioAntes: doc.precioAntes || 0,
    tallas: Array.isArray(doc.tallas) ? doc.tallas : [],
    badge: doc.badge || "",
    imagen: doc.imagen || "",
    descripcion: doc.descripcion || "",
    disponible: doc.disponible !== false,
  };
}

function aPedido(doc) {
  const cliente = doc.cliente || {};
  return {
    id: String(doc._id),
    nombre: cliente.nombre || "",
    correo: cliente.correo || "",
    telefono: cliente.telefono || "",
    direccion: cliente.direccion || "",
    metodo: doc.metodo,
    total: doc.total,
    estado: doc.estado,
    nota: doc.nota || "",
    creado: doc.creado,
    items: (doc.items || []).map(function (item) {
      return { nombre: item.nombre, talla: item.talla, precio: item.precio, cantidad: item.cantidad };
    }),
  };
}

/* ---------- Conexión y datos iniciales --------------------------------- */
async function prepararBaseDeDatos() {
  await conexion.connect();
  bd = conexion.db(NOMBRE_BD);

  await bd.collection("usuarios").createIndex({ email: 1 }, { unique: true });
  await bd.collection("usuarios").createIndex({ usuario: 1 }, { unique: true, sparse: true });
  await bd.collection("productos").createIndex({ categoria: 1 });
  await bd.collection("pedidos").createIndex({ creado: -1 });
  await bd.collection("sesiones").createIndex({ token: 1 }, { unique: true });
  await bd.collection("sesiones").createIndex({ expira: 1 }, { expireAfterSeconds: 0 });
  await bd.collection("archivos").createIndex({ creado: -1 });

  const usuarios = bd.collection("usuarios");

  for (const admin of ADMINISTRADORES) {
    const existe = await usuarios.findOne({ usuario: admin.usuario });

    if (!existe) {
      try {
        await usuarios.insertOne({
          usuario: admin.usuario,
          email: admin.email,
          nombre: admin.nombre,
          clave: cifrarClave(admin.clave),
          rol: "admin",
          creado: ahora(),
        });
        console.log("  Administrador creado: " + admin.usuario + " / " + admin.clave);
      } catch (error) {
        /* Otra instancia (Vercel) lo creó al mismo tiempo. */
        if (error.code !== 11000) throw error;
      }
    }
  }

  /* El catálogo de ejemplo se siembra una sola vez aunque en Vercel arranquen
     varias instancias a la vez: el documento `sistema` hace de cerrojo. */
  try {
    await bd.collection("sistema").insertOne({ _id: "catalogo-inicial", creado: ahora() });
  } catch (error) {
    if (error.code === 11000) return;
    throw error;
  }

  const productos = bd.collection("productos");

  if ((await productos.countDocuments()) === 0) {
    await productos.insertMany(
      PRODUCTOS_INICIALES.map(function (producto) {
        return Object.assign({}, producto, { creado: ahora() });
      })
    );
    console.log("  Catálogo de ejemplo insertado: " + PRODUCTOS_INICIALES.length + " productos");
  }
}

/* ---------- Conexión perezosa ------------------------------------------- */
/* En Vercel cada instancia arranca en frío y no hay servidor permanente:
   conectamos una sola vez y reutilizamos mientras la instancia siga caliente. */
async function asegurarBd() {
  if (bd) return bd;

  if (!preparandoBd) {
    preparandoBd = prepararBaseDeDatos().catch(function (error) {
      preparandoBd = null;
      throw error;
    });
  }

  await preparandoBd;
  return bd;
}

/* ---------- Sesiones ---------------------------------------------------- */
/* Se guardan en MongoDB: en Vercel la memoria del proceso no se comparte
   entre peticiones ni entre instancias. */
const DURACION_SESION = 1000 * 60 * 60 * 24 * 7; // 7 días

async function crearSesion(usuarioId) {
  const token = crypto.randomBytes(32).toString("hex");
  await bd.collection("sesiones").insertOne({
    token: token,
    usuarioId: String(usuarioId),
    expira: new Date(Date.now() + DURACION_SESION),
  });
  return token;
}

function tokenDe(peticion) {
  const cookie = peticion.headers.cookie || "";
  const partes = cookie.split(";").map(function (t) { return t.trim(); });
  const encontrada = partes.find(function (t) { return t.indexOf("sid=") === 0; });
  return encontrada ? encontrada.slice(4) : null;
}

async function usuarioActual(peticion) {
  const token = tokenDe(peticion);
  if (!token) return null;

  const sesion = await bd.collection("sesiones").findOne({ token: token });
  if (!sesion) return null;

  if (sesion.expira && new Date(sesion.expira).getTime() < Date.now()) {
    await bd.collection("sesiones").deleteOne({ token: token });
    return null;
  }

  if (!ObjectId.isValid(sesion.usuarioId)) return null;

  return bd.collection("usuarios").findOne({ _id: new ObjectId(sesion.usuarioId) });
}

function cookieSesion(token) {
  return "sid=" + token + "; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800";
}

/* ---------- Helpers HTTP ------------------------------------------------ */
function enviarJson(respuesta, codigo, datos, extra) {
  respuesta.writeHead(codigo, Object.assign({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  }, extra || {}));
  respuesta.end(JSON.stringify(datos));
}

function leerCuerpo(peticion) {
  return new Promise(function (resolver, rechazar) {
    let texto = "";
    peticion.on("data", function (trozo) {
      texto += trozo;
      if (texto.length > 1e6) {
        rechazar(new Error("El contenido es demasiado grande"));
        peticion.destroy();
      }
    });
    peticion.on("end", function () {
      if (!texto) return resolver({});
      try {
        resolver(JSON.parse(texto));
      } catch (error) {
        rechazar(new Error("JSON inválido"));
      }
    });
    peticion.on("error", rechazar);
  });
}

/* ---------- API: imágenes ----------------------------------------------- */
/* En Vercel el disco es de solo lectura, así que las fotos se guardan en
   MongoDB (colección `archivos`) y se sirven desde /api/img/:id.
   Vercel corta las peticiones en 4,5 MB, de ahí el límite de 4 MB. */
const LIMITE_IMAGEN = 4 * 1024 * 1024;
const TIPOS_IMAGEN = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

function subirImagen(peticion, respuesta) {
  return new Promise(function (resolver) {
    if (peticion.method !== "POST") {
      enviarJson(respuesta, 405, { error: "Método no permitido. Usa POST." });
      return resolver();
    }

    let bb;
    try {
      bb = busboy({ headers: peticion.headers, limits: { fileSize: LIMITE_IMAGEN, files: 1 } });
    } catch (error) {
      enviarJson(respuesta, 400, { error: "No se recibió un formulario válido." });
      return resolver();
    }

    let tipo = null;
    let huboArchivo = false;
    let demasiadoGrande = false;
    let trozos = [];
    let terminado = false;

    function responder(codigo, datos) {
      if (terminado) return;
      terminado = true;
      enviarJson(respuesta, codigo, datos);
      resolver();
    }

    bb.on("file", function (campo, flujo, info) {
      /* busboy v1 pasa un objeto `info`; la v0.x pasaba el nombre suelto. */
      const nombreOriginal = typeof info === "string" ? info : (info && info.filename) || "";

      if (campo !== "imagen") {
        flujo.resume();
        return;
      }

      huboArchivo = true;

      let ext = "";
      try {
        ext = path.extname(nombreOriginal || ".jpg").toLowerCase();
      } catch (error) {
        ext = "";
      }

      tipo = TIPOS_IMAGEN[ext] || null;

      if (!tipo) {
        flujo.resume();
        return;
      }

      flujo.on("data", function (trozo) {
        trozos.push(trozo);
      });

      flujo.on("limit", function () {
        demasiadoGrande = true;
        trozos = [];
      });
    });

    bb.on("error", function (error) {
      responder(500, { error: "Error al procesar la imagen. " + error.message });
    });

    bb.on("close", function () {
      if (!huboArchivo) return responder(400, { error: "No se recibió ningún archivo." });
      if (!tipo) return responder(400, { error: "Solo se permiten JPG, PNG, WEBP o GIF." });
      if (demasiadoGrande) return responder(413, { error: "La imagen supera los 4 MB." });

      const contenido = Buffer.concat(trozos);
      if (!contenido.length) return responder(400, { error: "El archivo llegó vacío." });

      bd.collection("archivos")
        .insertOne({
          tipo: tipo,
          datos: contenido.toString("base64"),
          tamanio: contenido.length,
          creado: ahora(),
        })
        .then(function (resultado) {
          responder(200, { url: "/api/img/" + String(resultado.insertedId) });
        })
        .catch(function (error) {
          responder(500, { error: "No se pudo guardar la imagen. " + error.message });
        });
    });

    peticion.pipe(bb);
  });
}

async function servirImagen(peticion, respuesta, id) {
  if (!ObjectId.isValid(id)) return enviarJson(respuesta, 404, { error: "Imagen no encontrada." });

  const archivo = await bd.collection("archivos").findOne({ _id: new ObjectId(id) });
  if (!archivo) return enviarJson(respuesta, 404, { error: "Imagen no encontrada." });

  const contenido = Buffer.from(archivo.datos || "", "base64");

  respuesta.writeHead(200, {
    "Content-Type": archivo.tipo || "image/jpeg",
    "Content-Length": contenido.length,
    "Cache-Control": "public, max-age=31536000, immutable",
  });
  respuesta.end(contenido);
}

/* ---------- API: cuentas ------------------------------------------------ */
  async function registrar(peticion, respuesta) {
    const cuerpo = await leerCuerpo(peticion);
    const nombre = String(cuerpo.nombre || "").trim();
    const email = String(cuerpo.email || "").trim().toLowerCase();
    const clave = String(cuerpo.clave || "");

    if (nombre.length < 2) return enviarJson(respuesta, 400, { error: "Escribe tu nombre." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return enviarJson(respuesta, 400, { error: "El correo no es válido." });
    if (clave.length < 6) return enviarJson(respuesta, 400, { error: "La contraseña debe tener al menos 6 caracteres." });

    const usuarios = bd.collection("usuarios");

  if (await usuarios.findOne({ email: email })) {
    return enviarJson(respuesta, 409, { error: "Ese correo ya tiene una cuenta. Inicia sesión." });
  }

  const resultado = await usuarios.insertOne({
    nombre: nombre,
    email: email,
    clave: cifrarClave(clave),
    rol: "cliente",
    creado: ahora(),
  });

  enviarJson(
    respuesta,
    201,
    { usuario: { id: String(resultado.insertedId), nombre: nombre, email: email, usuario: "", rol: "cliente" } },
    { "Set-Cookie": cookieSesion(await crearSesion(resultado.insertedId)) }
  );
}

async function iniciarSesion(peticion, respuesta) {
  const cuerpo = await leerCuerpo(peticion);
  const identificador = String(cuerpo.usuario || cuerpo.email || "").trim().toLowerCase();
  const clave = String(cuerpo.clave || "");

  if (!identificador || !clave) {
    return enviarJson(respuesta, 400, { error: "Escribe tu usuario y tu contraseña." });
  }

  const usuario = await bd.collection("usuarios").findOne({
    $or: [{ usuario: identificador }, { email: identificador }],
  });

  if (!usuario || !claveCorrecta(clave, usuario.clave)) {
    return enviarJson(respuesta, 401, { error: "Usuario o contraseña incorrectos." });
  }

  enviarJson(
    respuesta,
    200,
    { usuario: sinClave(usuario) },
    { "Set-Cookie": cookieSesion(await crearSesion(usuario._id)) }
  );
}

async function cerrarSesion(peticion, respuesta) {
  const token = tokenDe(peticion);
  if (token) await bd.collection("sesiones").deleteOne({ token: token });
  enviarJson(respuesta, 200, { ok: true }, { "Set-Cookie": "sid=; HttpOnly; Path=/; Max-Age=0" });
}

async function verSesion(peticion, respuesta) {
  const usuario = await usuarioActual(peticion);
  enviarJson(respuesta, 200, { usuario: usuario ? sinClave(usuario) : null });
}

/* ---------- API: productos --------------------------------------------- */
function aTallas(valor) {
  if (Array.isArray(valor)) {
    return valor.map(function (talla) { return String(talla).trim(); }).filter(Boolean);
  }
  return String(valor || "").split(",").map(function (talla) { return talla.trim(); }).filter(Boolean);
}

function datosProducto(cuerpo) {
  return {
    nombre: String(cuerpo.nombre || "").trim(),
    categoria: String(cuerpo.categoria || "").trim(),
    precio: Number(cuerpo.precio) || 0,
    precioAntes: Number(cuerpo.precioAntes) || 0,
    tallas: aTallas(cuerpo.tallas),
    badge: String(cuerpo.badge || "").trim(),
    imagen: String(cuerpo.imagen || "").trim(),
    descripcion: String(cuerpo.descripcion || "").trim(),
    disponible: cuerpo.disponible !== false,
  };
}

function validarProducto(datos) {
  if (!datos.nombre) return "El producto necesita un nombre.";
  if (!datos.categoria) return "El producto necesita una categoría.";
  if (!(datos.precio > 0)) return "El precio debe ser mayor que 0.";
  return null;
}

async function listarProductos(peticion, respuesta) {
  const usuario = await usuarioActual(peticion);
  const esAdmin = Boolean(usuario && usuario.rol === "admin");

  const documentos = await bd
    .collection("productos")
    .find(esAdmin ? {} : { disponible: { $ne: false } })
    .sort({ _id: -1 })
    .toArray();

  enviarJson(respuesta, 200, { productos: documentos.map(aProducto) });
}

async function crearProducto(peticion, respuesta) {
  const datos = datosProducto(await leerCuerpo(peticion));
  const error = validarProducto(datos);
  if (error) return enviarJson(respuesta, 400, { error: error });

  datos.creado = ahora();
  const coleccion = bd.collection("productos");
  const resultado = await coleccion.insertOne(datos);

  enviarJson(respuesta, 201, { producto: aProducto(await coleccion.findOne({ _id: resultado.insertedId })) });
}

async function actualizarProducto(peticion, respuesta, id) {
  if (!ObjectId.isValid(id)) return enviarJson(respuesta, 400, { error: "Producto no válido." });

  const coleccion = bd.collection("productos");
  const _id = new ObjectId(id);

  if (!(await coleccion.findOne({ _id: _id }))) {
    return enviarJson(respuesta, 404, { error: "Producto no encontrado." });
  }

  const datos = datosProducto(await leerCuerpo(peticion));
  const error = validarProducto(datos);
  if (error) return enviarJson(respuesta, 400, { error: error });

  await coleccion.updateOne({ _id: _id }, { $set: datos });
  enviarJson(respuesta, 200, { producto: aProducto(await coleccion.findOne({ _id: _id })) });
}

async function borrarProducto(peticion, respuesta, id) {
  if (!ObjectId.isValid(id)) return enviarJson(respuesta, 400, { error: "Producto no válido." });

  await bd.collection("productos").deleteOne({ _id: new ObjectId(id) });
  enviarJson(respuesta, 200, { ok: true });
}

/* ---------- API: pedidos ----------------------------------------------- */
const ESTADOS = ["pendiente", "pagado", "enviado", "cancelado"];

async function crearPedido(peticion, respuesta) {
  const cuerpo = await leerCuerpo(peticion);
  const items = Array.isArray(cuerpo.items) ? cuerpo.items : [];
  const recibido = cuerpo.cliente || {};
  const metodo = cuerpo.metodo === "lafise" ? "lafise" : "bac";

  const cliente = {
    nombre: String(recibido.nombre || "").trim(),
    correo: String(recibido.correo || "").trim().toLowerCase(),
    telefono: String(recibido.telefono || "").trim(),
    direccion: String(recibido.direccion || "").trim(),
  };

  if (!items.length) return enviarJson(respuesta, 400, { error: "El carrito está vacío." });
  if (cliente.nombre.length < 3) return enviarJson(respuesta, 400, { error: "Escribe tu nombre completo." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cliente.correo)) return enviarJson(respuesta, 400, { error: "El correo no es válido." });
  if (cliente.telefono.replace(/\D/g, "").length < 8) return enviarJson(respuesta, 400, { error: "El teléfono no es válido." });
  if (cliente.direccion.length < 10) return enviarJson(respuesta, 400, { error: "Escribe la dirección de entrega completa." });

  const ids = items
    .map(function (item) { return String(item.id); })
    .filter(function (id) { return ObjectId.isValid(id); });

  if (!ids.length) return enviarJson(respuesta, 400, { error: "Ningún producto del carrito es válido." });

  const encontrados = await bd
    .collection("productos")
    .find({ _id: { $in: ids.map(function (id) { return new ObjectId(id); }) } })
    .toArray();

  const detalle = [];
  let total = 0;

  items.forEach(function (item) {
    const producto = encontrados.find(function (p) { return String(p._id) === String(item.id); });
    if (!producto) return;

    const cantidad = Math.max(1, Math.min(50, Number(item.cantidad) || 1));
    total += producto.precio * cantidad;

    detalle.push({
      productoId: producto._id,
      nombre: producto.nombre,
      talla: String(item.talla || "Único"),
      precio: producto.precio,
      cantidad: cantidad,
    });
  });

  if (!detalle.length) {
    return enviarJson(respuesta, 400, { error: "Ningún producto del carrito sigue disponible." });
  }

  const usuario = await usuarioActual(peticion);

  const resultado = await bd.collection("pedidos").insertOne({
    usuarioId: usuario ? usuario._id : null,
    cliente: cliente,
    metodo: metodo,
    total: total,
    estado: "pendiente",
    nota: String(cuerpo.nota || "").trim(),
    creado: ahora(),
    items: detalle,
  });

  enviarJson(respuesta, 201, {
    pedido: {
      id: String(resultado.insertedId),
      total: total,
      metodo: metodo,
      items: detalle.map(function (item) {
        return { nombre: item.nombre, talla: item.talla, precio: item.precio, cantidad: item.cantidad };
      }),
    },
  });
}

async function listarPedidos(peticion, respuesta) {
  const documentos = await bd.collection("pedidos").find({}).sort({ _id: -1 }).toArray();
  enviarJson(respuesta, 200, { pedidos: documentos.map(aPedido) });
}

async function cambiarEstado(peticion, respuesta, id) {
  const cuerpo = await leerCuerpo(peticion);
  const estado = String(cuerpo.estado || "");

  if (ESTADOS.indexOf(estado) === -1) return enviarJson(respuesta, 400, { error: "Estado no válido." });
  if (!ObjectId.isValid(id)) return enviarJson(respuesta, 400, { error: "Pedido no válido." });

  const resultado = await bd
    .collection("pedidos")
    .updateOne({ _id: new ObjectId(id) }, { $set: { estado: estado } });

  if (!resultado.matchedCount) return enviarJson(respuesta, 404, { error: "Pedido no encontrado." });

  enviarJson(respuesta, 200, { ok: true });
}

/* ---------- Archivos estáticos ----------------------------------------- */
const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

function servirEstatico(peticion, respuesta) {
  const ruta = decodeURIComponent((peticion.url || "/").split("?")[0]);
  const relativa = ruta === "/" ? "index.html" : ruta.replace(/^\/+/, "");
  const destino = path.join(PUBLICO, relativa);

  if (!destino.startsWith(PUBLICO)) {
    respuesta.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    respuesta.end("Prohibido");
    return;
  }

  fs.readFile(destino, function (error, contenido) {
    if (error) {
      respuesta.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      respuesta.end("<!DOCTYPE html><meta charset='utf-8'><h1>404</h1><p>No encontrado. <a href='/'>Volver al inicio</a></p>");
      return;
    }

    respuesta.writeHead(200, {
      "Content-Type": TIPOS[path.extname(destino).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    respuesta.end(contenido);
  });
}

/* ---------- Permisos --------------------------------------------------- */
async function soloAdmin(peticion, respuesta, manejador) {
  const usuario = await usuarioActual(peticion);

  if (!usuario || usuario.rol !== "admin") {
    return enviarJson(respuesta, 403, { error: "Solo el administrador puede hacer esto." });
  }

  return manejador(peticion, respuesta);
}

/* ---------- Servidor --------------------------------------------------- */
/* Un único manejador para las dos formas de ejecución:
   - local:  http.createServer(manejar)   (ver «Arranque» más abajo)
   - Vercel: la función serverless lo importa desde api/[...ruta].js */
async function manejar(peticion, respuesta) {
  const url = (peticion.url || "/").split("?")[0];
  const metodo = peticion.method || "GET";

  try {
    /* En Vercel no hay arranque previo: aseguramos la conexión aquí. */
    if (url.indexOf("/api/") === 0) await asegurarBd();

    /* cuentas */
    if (url === "/api/sesion" && metodo === "GET") return await verSesion(peticion, respuesta);
    if (url === "/api/registro" && metodo === "POST") return await registrar(peticion, respuesta);
    if (url === "/api/login" && metodo === "POST") return await iniciarSesion(peticion, respuesta);
    if (url === "/api/logout" && metodo === "POST") return await cerrarSesion(peticion, respuesta);

    /* imágenes: subida y lectura (guardadas en MongoDB) */
    if (url === "/api/upload-img" && metodo === "POST") return await soloAdmin(peticion, respuesta, subirImagen);

    const imagenRuta = url.match(/^\/api\/img\/([^/]+)$/);
    if (imagenRuta && metodo === "GET") return await servirImagen(peticion, respuesta, imagenRuta[1]);

    /* productos */
    if (url === "/api/productos" && metodo === "GET") return await listarProductos(peticion, respuesta);
    if (url === "/api/productos" && metodo === "POST") {
      return await soloAdmin(peticion, respuesta, crearProducto);
    }

    const producto = url.match(/^\/api\/productos\/([^/]+)$/);
    if (producto && metodo === "PUT") {
      return await soloAdmin(peticion, respuesta, function (p, r) {
        return actualizarProducto(p, r, producto[1]);
      });
    }
    if (producto && metodo === "DELETE") {
      return await soloAdmin(peticion, respuesta, function (p, r) {
        return borrarProducto(p, r, producto[1]);
      });
    }

    /* pedidos */
    if (url === "/api/pedidos" && metodo === "POST") return await crearPedido(peticion, respuesta);
    if (url === "/api/pedidos" && metodo === "GET") {
      return await soloAdmin(peticion, respuesta, listarPedidos);
    }

    const pedido = url.match(/^\/api\/pedidos\/([^/]+)$/);
    if (pedido && metodo === "PATCH") {
      return await soloAdmin(peticion, respuesta, function (p, r) {
        return cambiarEstado(p, r, pedido[1]);
      });
    }

    if (url.indexOf("/api/") === 0) {
      return enviarJson(respuesta, 404, { error: "Ruta no encontrada." });
    }

    return servirEstatico(peticion, respuesta);
  } catch (error) {
    enviarJson(respuesta, 500, { error: error.message || "Error del servidor." });
  }
}

/* Vercel importa este archivo como función serverless: exportamos el manejador. */
module.exports = manejar;

/* Direcciones IPv4 de la red local (para entrar desde el móvil) */
function direccionesLocales() {
  const redes = os.networkInterfaces();
  const salida = [];

  Object.keys(redes).forEach(function (nombre) {
    (redes[nombre] || []).forEach(function (datos) {
      if (datos.family === "IPv4" && !datos.internal) salida.push(datos.address);
    });
  });

  return salida;
}

/* ---------- Arranque local --------------------------------------------- */
/* En Vercel este bloque no se ejecuta: allí la plataforma importa el
   manejador exportado. Solo corre con `node server.js`. */
if (require.main === module) {
  const servidor = http.createServer(manejar);

  prepararBaseDeDatos()
    .then(function () {
      servidor.listen(PUERTO, "0.0.0.0", function () {
        const ips = direccionesLocales();
        const urlMovil = ips.length ? "http://" + ips[0] + ":" + PUERTO : "";

        console.log("");
        console.log("  ══════════════════════════════════════════════");
        console.log("   A&G CLOTHING");
        console.log("  ══════════════════════════════════════════════");
        console.log("   En este equipo : http://localhost:" + PUERTO);
        ips.forEach(function (ip) {
          console.log("   Desde el móvil : http://" + ip + ":" + PUERTO);
        });
        console.log("   Mongo          : " + URI + " · " + NOMBRE_BD);
        ADMINISTRADORES.forEach(function (admin) {
          console.log("   Admin          : " + admin.usuario + " / " + admin.clave);
        });
        console.log("  ══════════════════════════════════════════════");
        console.log("");
        console.log("   (el móvil debe estar en la misma red Wi-Fi)");
        console.log("");

        if (qrcode && urlMovil) {
          qrcode.generate(urlMovil, { small: true });
          console.log("   Escanea el QR con la cámara del móvil");
          console.log("");
        }
      });
    })
    .catch(function (error) {
      console.error("");
      console.error("  No se pudo conectar a MongoDB en " + URI);
      console.error("  " + error.message);
      console.error("  Comprueba que el servicio MongoDB esté iniciado.");
      console.error("");
      process.exit(1);
    });

  process.on("SIGINT", function () {
    conexion.close().then(function () { process.exit(0); });
  });
}





