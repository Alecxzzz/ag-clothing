/* ==========================================================================
   A&G CLOTHING — finalizar compra (checkout.html)
   1. Resumen  2. Forma de pago  3. Crear pedido y enviar a WhatsApp
   ========================================================================== */
(function () {
  "use strict";

  const resumen = document.getElementById("resumen");
  const totalEl = document.getElementById("total");
  const opciones = document.getElementById("opciones-pago");
  const datosCuenta = document.getElementById("datos-cuenta");
  const formulario = document.getElementById("form-pedido");
  const btnEnviar = document.getElementById("btn-enviar");
  const errorEl = document.getElementById("error");
  const exitoEl = document.getElementById("exito");
  const enlaceManual = document.getElementById("enlace-manual");

  let productos = [];
  let carrito = [];
  let metodo = CONFIG.pagos[0].id;
  let enviando = false;

  function valor(id) {
    return document.getElementById(id).value.trim();
  }

  function buscarProducto(id) {
    return productos.find(function (p) { return String(p.id) === String(id); });
  }

  function totalPedido() {
    return carrito.reduce(function (suma, item) {
      const producto = buscarProducto(item.id);
      return producto ? suma + Number(producto.precio) * item.cantidad : suma;
    }, 0);
  }

  function mostrarError(mensaje) {
    errorEl.textContent = mensaje;
    errorEl.hidden = false;
  }

  /* 1. Resumen ------------------------------------------------------------ */
  function pintarResumen() {
    if (!carrito.length) {
      resumen.innerHTML = '<p class="vacio">Tu carrito está vacío. Vuelve al catálogo para elegir tus prendas.</p>';
      totalEl.textContent = formatearPrecio(0);
      btnEnviar.disabled = true;
      mostrarError("No hay productos en el carrito.");
      return;
    }

    resumen.innerHTML = carrito.map(function (item) {
      const producto = buscarProducto(item.id);
      return '<div class="resumen__linea">' +
        "<span>" + item.cantidad + " × " + escaparHtml(producto.nombre) +
          " <small>(" + escaparHtml(item.talla) + ")</small></span>" +
        "<strong>" + formatearPrecio(Number(producto.precio) * item.cantidad) + "</strong>" +
      "</div>";
    }).join("");

    totalEl.textContent = formatearPrecio(totalPedido());
    actualizarContadores();
  }

  /* 2. Forma de pago ------------------------------------------------------ */
  function pintarMetodos() {
    opciones.innerHTML = CONFIG.pagos.map(function (pago) {
      return '<label class="opcion">' +
        '<input type="radio" name="metodo" value="' + escaparHtml(pago.id) + '"' +
          (pago.id === metodo ? " checked" : "") + ">" +
        '<img src="' + escaparHtml(pago.logo) + '" alt="' + escaparHtml(pago.banco) +
          '" onerror="this.style.display=\'none\'">' +
        "<strong>" + escaparHtml(pago.banco) + "</strong>" +
      "</label>";
    }).join("");
  }

  function pintarCuenta() {
    const pago = CONFIG.pagos.find(function (p) { return p.id === metodo; });
    if (!pago) return;

    datosCuenta.innerHTML =
      "<strong>" + escaparHtml(pago.banco) + " · " + escaparHtml(pago.tipo) + "</strong>" +
      "<span>Número de cuenta: " + escaparHtml(pago.numero) + "</span>" +
      "<span>Titular: " + escaparHtml(pago.titular) + "</span>" +
      "<span>Monto a transferir: <strong>" + formatearPrecio(totalPedido()) + "</strong></span>";
  }

  /* 3. Validación, pedido y WhatsApp -------------------------------------- */
  function validar() {
    errorEl.hidden = true;

    const nombre = document.getElementById("nombre");
    const correo = document.getElementById("correo");
    const telefono = document.getElementById("telefono");
    const direccion = document.getElementById("direccion");

    const reglas = [
      [nombre, nombre.value.trim().length >= 3, "Escribe tu nombre completo."],
      [correo, /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo.value.trim()), "Escribe un correo válido."],
      [telefono, telefono.value.replace(/\D/g, "").length >= 8, "Escribe un teléfono válido (mínimo 8 dígitos)."],
      [direccion, direccion.value.trim().length >= 10, "Escribe tu dirección de entrega completa."],
    ];

    for (let i = 0; i < reglas.length; i += 1) {
      const campo = reglas[i][0];
      const valido = reglas[i][1];
      campo.setAttribute("aria-invalid", String(!valido));

      if (!valido) {
        mostrarError(reglas[i][2]);
        campo.focus();
        return false;
      }
    }

    return true;
  }

  function construirMensaje(pedido) {
    const pago = CONFIG.pagos.find(function (p) { return p.id === pedido.metodo; }) || CONFIG.pagos[0];

    const lineas = pedido.items.map(function (item) {
      return "• " + item.cantidad + " × " + item.nombre + " (" + item.talla + ") — " +
        formatearPrecio(Number(item.precio) * item.cantidad);
    });

    return [
      "Hola A&G CLOTHING 👋",
      "",
      "Quiero comprar:",
      lineas.join("\n"),
      "",
      "Total: " + formatearPrecio(pedido.total),
      "",
      "Quiero pagar a la cuenta " + pago.banco + " N.º " + pago.numero + " (" + pago.titular + ").",
      "Mi pedido es el #" + pedido.id + ". Espero su respuesta, gracias.",
    ].join("\n");
  }

  formulario.addEventListener("submit", async function (evento) {
    evento.preventDefault();
    if (enviando) return;
    if (!carrito.length) return mostrarError("Tu carrito está vacío.");
    if (!validar()) return;

    enviando = true;
    errorEl.hidden = true;
    btnEnviar.disabled = true;
    btnEnviar.textContent = "Enviando…";

    try {
      const datos = await API.crearPedido({
        cliente: {
          nombre: valor("nombre"),
          correo: valor("correo"),
          telefono: valor("telefono"),
          direccion: valor("direccion"),
        },
        metodo: metodo,
        items: carrito.map(function (item) {
          return { id: item.id, talla: item.talla, cantidad: item.cantidad };
        }),
      });

      const enlace = enlaceWhatsapp(construirMensaje(datos.pedido));
      guardarCarrito([]);
      exitoEl.hidden = false;
      enlaceManual.href = enlace;
      window.location.href = enlace;
    } catch (error) {
      mostrarError(error.message);
      btnEnviar.disabled = false;
      btnEnviar.textContent = "Enviar pedido por WhatsApp";
    } finally {
      enviando = false;
    }
  });

  opciones.addEventListener("change", function (evento) {
    if (evento.target.name !== "metodo") return;
    metodo = evento.target.value;
    pintarCuenta();
  });

  /* Arranque ------------------------------------------------------------- */
  (async function iniciar() {
    pintarMetodos();
    pintarCuenta();

    const usuario = await prepararCabecera();

    try {
      const datos = await API.productos();
      productos = datos.productos;
      carrito = obtenerCarrito().filter(function (item) { return Boolean(buscarProducto(item.id)); });
      guardarCarrito(carrito);

      if (usuario) {
        document.getElementById("nombre").value = usuario.nombre;
        document.getElementById("correo").value = usuario.email;
      }

      pintarResumen();
      pintarCuenta();
    } catch (error) {
      mostrarError(error.message);
      btnEnviar.disabled = true;
    }
  })();

})();
