/* ==========================================================================
   A&G CLOTHING — copiar la base local a MongoDB Atlas

   Uso (PowerShell):
     $env:DESTINO = "mongodb+srv://usuario:clave@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority"
     node tools/copiar-a-atlas.js

   Opcionales:
     ORIGEN      cadena de origen        (por defecto mongodb://127.0.0.1:27017)
     MONGODB_BD  base de origen          (por defecto ag_clothing)
     DESTINO_BD  base en el destino      (por defecto la misma)

   No borra nada en el destino: hace upsert por _id, se puede repetir.
   Las sesiones no se copian: son temporales.
   ========================================================================== */
const { MongoClient } = require("mongodb");

const ORIGEN = process.env.ORIGEN || "mongodb://127.0.0.1:27017";
const DESTINO = process.env.DESTINO || "";
const BD_ORIGEN = process.env.MONGODB_BD || "ag_clothing";
const BD_DESTINO = process.env.DESTINO_BD || BD_ORIGEN;

const COLECCIONES = ["usuarios", "productos", "pedidos", "archivos", "sistema"];

function ocultarClave(cadena) {
  return cadena.replace(/\/\/[^/@]*@/, "//***@");
}

async function copiarColeccion(desde, hasta, nombre) {
  const documentos = await desde.collection(nombre).find({}).toArray();

  if (!documentos.length) {
    console.log("  " + nombre.padEnd(10) + " 0 documentos (se omite)");
    return 0;
  }

  for (const documento of documentos) {
    await hasta.collection(nombre).replaceOne({ _id: documento._id }, documento, { upsert: true });
  }

  console.log("  " + nombre.padEnd(10) + documentos.length + " documentos");
  return documentos.length;
}

(async function () {
  if (!DESTINO) {
    console.error("");
    console.error("  Falta la variable DESTINO con la cadena de MongoDB Atlas.");
    console.error('  $env:DESTINO = "mongodb+srv://usuario:clave@cluster0.xxxxx.mongodb.net"');
    console.error("");
    process.exit(1);
  }

  const clienteOrigen = new MongoClient(ORIGEN, { serverSelectionTimeoutMS: 8000 });
  const clienteDestino = new MongoClient(DESTINO, { serverSelectionTimeoutMS: 15000 });

  console.log("");
  console.log("  Origen  : " + ocultarClave(ORIGEN) + " · " + BD_ORIGEN);
  console.log("  Destino : " + ocultarClave(DESTINO) + " · " + BD_DESTINO);
  console.log("");

  try {
    await clienteOrigen.connect();
    await clienteDestino.connect();

    const desde = clienteOrigen.db(BD_ORIGEN);
    const hasta = clienteDestino.db(BD_DESTINO);

    let total = 0;
    for (const nombre of COLECCIONES) {
      total += await copiarColeccion(desde, hasta, nombre);
    }

    console.log("");
    console.log("  Listo: " + total + " documentos copiados.");
    console.log("  (sesiones no se copian: son temporales)");
    console.log("");
  } catch (error) {
    console.error("");
    console.error("  Error: " + error.message);
    console.error("");
    process.exitCode = 1;
  } finally {
    await clienteOrigen.close();
    await clienteDestino.close();
  }
})();
