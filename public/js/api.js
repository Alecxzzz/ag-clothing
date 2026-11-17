/* ==========================================================================
   A&G CLOTHING — llamadas al servidor (API)
   ========================================================================== */
const API = (function () {
  "use strict";

  async function peticion(ruta, metodo, cuerpo) {
    const opciones = {
      method: metodo || "GET",
      credentials: "same-origin",
      headers: {},
    };

    if (cuerpo) {
      opciones.headers["Content-Type"] = "application/json";
      opciones.body = JSON.stringify(cuerpo);
    }

    let respuesta;
    try {
      respuesta = await fetch(ruta, opciones);
    } catch (error) {
      throw new Error("No hay conexión con el servidor. ¿Está encendido?");
    }

    const texto = await respuesta.text();
    let datos = {};

    if (texto) {
      try {
        datos = JSON.parse(texto);
      } catch (error) {
        throw new Error("El servidor respondió algo inesperado.");
      }
    }

    if (!respuesta.ok) {
      throw new Error(datos.error || "No se pudo completar la operación.");
    }

    return datos;
  }

  return {
    sesion: function () { return peticion("/api/sesion"); },
    login: function (identificador, clave) { return peticion("/api/login", "POST", { usuario: identificador, clave: clave }); },
    registro: function (datos) { return peticion("/api/registro", "POST", datos); },
    salir: function () { return peticion("/api/logout", "POST"); },

    productos: function () { return peticion("/api/productos"); },
    crearProducto: function (datos) { return peticion("/api/productos", "POST", datos); },
    actualizarProducto: function (id, datos) { return peticion("/api/productos/" + id, "PUT", datos); },
    borrarProducto: function (id) { return peticion("/api/productos/" + id, "DELETE"); },

    crearPedido: function (datos) { return peticion("/api/pedidos", "POST", datos); },
    pedidos: function () { return peticion("/api/pedidos"); },
    cambiarEstado: function (id, estado) { return peticion("/api/pedidos/" + id, "PATCH", { estado: estado }); },
  };
})();
