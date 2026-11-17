/* ==========================================================================
   A&G CLOTHING — panel (admin.html)
   1. Acceso  2. Productos  3. Pedidos
   ========================================================================== */
(function () {
  "use strict";

  const acceso = document.getElementById("acceso");
  const panel = document.getElementById("panel");
  const formAcceso = document.getElementById("form-acceso");
  const errorAcceso = document.getElementById("error-acceso");
  const usuarioActualEl = document.getElementById("usuario-actual");
  const listaProductos = document.getElementById("lista-productos");
  const numProductos = document.getElementById("num-productos");
  const formProducto = document.getElementById("form-producto");
  const tituloForm = document.getElementById("titulo-form");
  const listaPedidos = document.getElementById("lista-pedidos");
  const numPedidos = document.getElementById("num-pedidos");

  let productos = [];

  function campo(id) {
    return document.getElementById(id);
  }

  /* ---------- 1. Acceso -------------------------------------------------- */
  function mostrarPanel(usuario) {
    acceso.hidden = true;
    panel.hidden = false;
    usuarioActualEl.textContent = usuario.nombre + " · " + usuario.email;
    cargarProductos();
  }

  function mostrarAcceso() {
    acceso.hidden = false;
    panel.hidden = true;
  }

  formAcceso.addEventListener("submit", async function (evento) {
    evento.preventDefault();
    errorAcceso.hidden = true;

    const identificador = campo("usuario").value.trim();
    const clave = campo("clave").value;

    if (!identificador || !clave) {
      errorAcceso.textContent = "Escribe tu usuario y tu contraseña.";
      errorAcceso.hidden = false;
      return;
    }

    try {
      const datos = await API.login(identificador, clave);

      if (datos.usuario.rol !== "admin") {
        await API.salir();
        errorAcceso.textContent = "Esa cuenta no es de administrador.";
        errorAcceso.hidden = false;
        return;
      }

      mostrarPanel(datos.usuario);
    } catch (error) {
      errorAcceso.textContent = error.message;
      errorAcceso.hidden = false;
    }
  });

  campo("salir").addEventListener("click", async function () {
    try {
      await API.salir();
    } catch (error) {
      /* nada */
    }
    window.location.reload();
  });

  /* ---------- 2. Productos ----------------------------------------------- */
  async function cargarProductos() {
    try {
      const datos = await API.productos();
      productos = datos.productos;
      pintarProductos();
    } catch (error) {
      listaProductos.innerHTML = '<p class="vacio">' + escaparHtml(error.message) + "</p>";
    }
  }

  function pintarProductos() {
    numProductos.textContent = String(productos.length);

    if (!productos.length) {
      listaProductos.innerHTML = '<p class="vacio">No hay productos. Usa «Nuevo producto».</p>';
      return;
    }

    listaProductos.innerHTML = productos.map(function (producto) {
      const foto = producto.imagen
        ? '<img src="' + escaparHtml(producto.imagen) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">'
        : "Sin foto";
      const tallas = Array.isArray(producto.tallas) && producto.tallas.length ? producto.tallas.join(" / ") : "Único";

      return '<div class="fila">' +
        '<div class="fila__foto">' + foto + "</div>" +
        "<div>" +
          '<p class="fila__nombre">' + escaparHtml(producto.nombre) + "</p>" +
          '<p class="fila__meta">' + escaparHtml(producto.categoria) + " · " +
            formatearPrecio(producto.precio) + " · " + escaparHtml(tallas) +
            (producto.disponible ? "" : " · Agotado") + "</p>" +
        "</div>" +
        '<div class="fila__acciones">' +
          '<button class="btn btn--borde btn--mini" type="button" data-editar="' + producto.id + '">Editar</button>' +
          '<button class="btn btn--peligro btn--mini" type="button" data-eliminar="' + producto.id + '">Eliminar</button>' +
        "</div>" +
      "</div>";
    }).join("");
  }

  function abrirFormulario(producto) {
    formProducto.hidden = false;
    tituloForm.textContent = producto ? "Editar producto" : "Nuevo producto";

    campo("prod-id").value = producto ? producto.id : "";
    campo("prod-nombre").value = producto ? producto.nombre : "";
    campo("prod-categoria").value = producto ? producto.categoria : "";
    campo("prod-precio").value = producto ? producto.precio : "";
    campo("prod-antes").value = producto && producto.precioAntes ? producto.precioAntes : "";
    campo("prod-tallas").value = producto && Array.isArray(producto.tallas) ? producto.tallas.join(", ") : "";
    campo("prod-badge").value = producto ? producto.badge || "" : "";
    campo("prod-imagen").value = producto ? producto.imagen || "" : "";
    campo("prod-descripcion").value = producto ? producto.descripcion || "" : "";
    campo("prod-disponible").checked = producto ? producto.disponible !== false : true;

    formProducto.scrollIntoView({ behavior: "smooth", block: "start" });
    campo("prod-nombre").focus();
  }

  function cerrarFormulario() {
    formProducto.hidden = true;
    formProducto.reset();
    campo("prod-id").value = "";
  }

  /* ---------- Imagen del producto --------------------------------------- */
  const archivoInput = campo("prod-imagen-archivo");
  const previewEl = campo("prod-imagen-preview");

  archivoInput.addEventListener("change", function () {
    const file = archivoInput.files[0];
    if (!file) return;

    const lector = new FileReader();
    lector.onload = function (e) {
      previewEl.innerHTML =
        '<img src="' + escaparHtml(e.target.result) + '" alt="Vista previa" style="max-width:100%;max-height:220px;display:block;margin:0 auto;">' +
        '<button type="button" class="btn btn--mini btn--peligro" style="margin-top:0.6rem;" id="btn-borrar-img">Quitar imagen</button>';
      previewEl.hidden = false;
      campo("prod-imagen").placeholder = "img/productos/nombre.jpg";
    };
    lector.readAsDataURL(file);
  });

  campo("btn-borrar-img")?.addEventListener("click", function (evento) {
    evento.stopPropagation();
    archivoInput.value = "";
    previewEl.hidden = true;
    campo("prod-imagen").placeholder = "https://… o img/productos/nombre.jpg";
  });

  formProducto.addEventListener("submit", async function (evento) {
    evento.preventDefault();

    const id = campo("prod-id").value;
    const nombre = campo("prod-nombre").value.trim();
    const categoria = campo("prod-categoria").value.trim();
    const precio = Number(campo("prod-precio").value);

    if (!nombre || !categoria || !(precio > 0)) {
      (!nombre ? campo("prod-nombre") : !categoria ? campo("prod-categoria") : campo("prod-precio")).focus();
      return;
    }

    let imagen = campo("prod-imagen").value.trim();

    const archivo = archivoInput.files[0];
    if (archivo) {
      const formData = new FormData();
      formData.append("imagen", archivo, archivo.name);

      try {
        const respuesta = await fetch("/api/upload-img", {
          method: "POST",
          body: formData,
        });
        const datos = await respuesta.json();
        if (!respuesta.ok) throw new Error(datos.error || "Error al subir la imagen.");
        imagen = datos.url;
      } catch (error) {
        window.alert("No se pudo subir la imagen: " + error.message);
        return;
      }
    }

    const datos = {
      nombre: nombre,
      categoria: categoria,
      precio: precio,
      precioAntes: Number(campo("prod-antes").value) || 0,
      tallas: campo("prod-tallas").value.split(",").map(function (talla) {
        return talla.trim();
      }).filter(Boolean),
      badge: campo("prod-badge").value.trim(),
      imagen: imagen,
      descripcion: campo("prod-descripcion").value.trim(),
      disponible: campo("prod-disponible").checked,
    };

    try {
      if (id) {
        await API.actualizarProducto(id, datos);
      } else {
        await API.crearProducto(datos);
      }
      cerrarFormulario();
      await cargarProductos();
    } catch (error) {
      window.alert(error.message);
    }
  });

  async function eliminar(id) {
    const producto = productos.find(function (p) { return String(p.id) === String(id); });
    if (!producto) return;
    if (!window.confirm("¿Eliminar «" + producto.nombre + "» de la tienda?")) return;

    try {
      await API.borrarProducto(id);
      await cargarProductos();
    } catch (error) {
      window.alert(error.message);
    }
  }

  /* ---------- 3. Pedidos ------------------------------------------------- */
  function whatsappCliente(pedido) {
    const digitos = String(pedido.telefono).replace(/\D/g, "");
    const numero = digitos.length === 8 ? "505" + digitos : digitos;
    return "https://wa.me/" + numero + "?text=" +
      encodeURIComponent("Hola " + pedido.nombre + ", te escribimos de A&G CLOTHING por tu pedido #" + pedido.id + ".");
  }

  async function cargarPedidos() {
    listaPedidos.innerHTML = '<p class="vacio">Cargando pedidos…</p>';

    try {
      const datos = await API.pedidos();
      pintarPedidos(datos.pedidos);
    } catch (error) {
      listaPedidos.innerHTML = '<p class="vacio">' + escaparHtml(error.message) + "</p>";
    }
  }

  function pintarPedidos(pedidos) {
    numPedidos.textContent = String(pedidos.length);

    if (!pedidos.length) {
      listaPedidos.innerHTML = '<p class="vacio">Todavía no hay pedidos.</p>';
      return;
    }

    const estados = ["pendiente", "pagado", "enviado", "cancelado"];

    listaPedidos.innerHTML = pedidos.map(function (pedido) {
      const items = pedido.items.map(function (item) {
        return '<div class="pedido__item"><span>' + item.cantidad + " × " + escaparHtml(item.nombre) +
          " (" + escaparHtml(item.talla) + ")</span><span>" +
          formatearPrecio(Number(item.precio) * item.cantidad) + "</span></div>";
      }).join("");

      const opciones = estados.map(function (estado) {
        return '<option value="' + estado + '"' + (estado === pedido.estado ? " selected" : "") + ">" +
          estado.charAt(0).toUpperCase() + estado.slice(1) + "</option>";
      }).join("");

      return '<article class="pedido">' +
        '<div class="pedido__cabecera">' +
          "<div>" +
            '<span class="pedido__numero">Pedido #' + pedido.id + "</span> " +
            '<span class="pedido__fecha">' + escaparHtml(fechaCorta(pedido.creado)) + "</span>" +
          "</div>" +
          '<span class="estado estado--' + escaparHtml(pedido.estado) + '">' + escaparHtml(pedido.estado) + "</span>" +
        "</div>" +
        '<div class="pedido__datos">' +
          "<span><strong>" + escaparHtml(pedido.nombre) + "</strong> · " + escaparHtml(pedido.telefono) + "</span>" +
          "<span>" + escaparHtml(pedido.correo) + "</span>" +
          "<span>" + escaparHtml(pedido.direccion) + "</span>" +
          "<span>Pago: " + (pedido.metodo === "lafise" ? "LAFISE" : "BAC Credomatic") + "</span>" +
        "</div>" +
        '<div class="pedido__items">' + items + "</div>" +
        '<div class="pedido__pie">' +
          '<span class="pedido__total">' + formatearPrecio(pedido.total) + "</span>" +
          '<select class="estado-select" data-pedido="' + pedido.id +
            '" aria-label="Estado del pedido ' + pedido.id + '">' + opciones + "</select>" +
          '<a class="btn btn--borde btn--mini" target="_blank" rel="noopener" href="' +
            whatsappCliente(pedido) + '">Escribir al cliente</a>' +
        "</div>" +
      "</article>";
    }).join("");
  }

  listaPedidos.addEventListener("change", async function (evento) {
    const selector = evento.target.closest("[data-pedido]");
    if (!selector) return;

    try {
      await API.cambiarEstado(selector.dataset.pedido, selector.value);
      const etiqueta = selector.closest(".pedido").querySelector(".estado");
      etiqueta.className = "estado estado--" + selector.value;
      etiqueta.textContent = selector.value;
    } catch (error) {
      window.alert(error.message);
    }
  });

  /* ---------- Pestañas y eventos ----------------------------------------- */
  function mostrarVista(cual) {
    const esProductos = cual === "productos";

    campo("tab-productos").classList.toggle("activa", esProductos);
    campo("tab-pedidos").classList.toggle("activa", !esProductos);
    campo("tab-productos").setAttribute("aria-selected", String(esProductos));
    campo("tab-pedidos").setAttribute("aria-selected", String(!esProductos));

    campo("vista-productos").hidden = !esProductos;
    campo("vista-pedidos").hidden = esProductos;

    if (!esProductos) cargarPedidos();
  }

  campo("tab-productos").addEventListener("click", function () { mostrarVista("productos"); });
  campo("tab-pedidos").addEventListener("click", function () { mostrarVista("pedidos"); });
  campo("recargar-pedidos").addEventListener("click", cargarPedidos);

  campo("nuevo").addEventListener("click", function () { abrirFormulario(null); });
  campo("cancelar").addEventListener("click", cerrarFormulario);

  listaProductos.addEventListener("click", function (evento) {
    const editar = evento.target.closest("[data-editar]");
    const borrar = evento.target.closest("[data-eliminar]");

    if (editar) {
      const producto = productos.find(function (p) { return String(p.id) === String(editar.dataset.editar); });
      if (producto) abrirFormulario(producto);
    }

    if (borrar) eliminar(borrar.dataset.eliminar);
  });

  /* ---------- Arranque --------------------------------------------------- */
  prepararCabecera().then(function (usuario) {
    if (usuario && usuario.rol === "admin") {
      mostrarPanel(usuario);
    } else {
      mostrarAcceso();
    }
  });


})();
