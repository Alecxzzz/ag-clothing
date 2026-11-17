/* ==========================================================================
   A&G CLOTHING — catálogo y carrito (index.html)
   ========================================================================== */
(function () {
  "use strict";

  const grid = document.getElementById("productos");
  const filtros = document.getElementById("filtros");
  const buscador = document.getElementById("buscar");
  const sinProductos = document.getElementById("sin-productos");
  const listaCarrito = document.getElementById("carrito-lista");
  const totalCarrito = document.getElementById("carrito-total");
  const panel = document.getElementById("carrito");
  const velo = document.getElementById("velo");

  const FONDOS = [
    "linear-gradient(160deg,#f1e8d8,#d2bfa3)",
    "linear-gradient(160deg,#eae3d5,#c1b29a)",
    "linear-gradient(160deg,#e6ded1,#b8a892)",
    "linear-gradient(160deg,#efe4d4,#cbb193)",
    "linear-gradient(160deg,#e4e7e0,#a9b5a3)",
    "linear-gradient(160deg,#e9dfd6,#c0a99b)",
  ];

  const SILUETAS = {
    Hombre: '<path d="M22 8 L14 12 L6 20 L12 28 L18 25 L18 56 L46 56 L46 25 L52 28 L58 20 L50 12 L42 8 C40 12.5 36.5 14 32 14 C27.5 14 24 12.5 22 8 Z"/>',
  };

  let productos = [];
  let categoriaActiva = "Todas";
  let busqueda = "";
  let seleccion = {};

  /* ---------- Utilidades ------------------------------------------------ */
  function tallasDe(producto) {
    return Array.isArray(producto.tallas) && producto.tallas.length ? producto.tallas : ["Único"];
  }

  function silueta(producto) {
    const trazo = SILUETAS[producto.categoria] || SILUETAS.Hombre;
    return '<svg viewBox="0 0 64 64" aria-hidden="true">' + trazo + "</svg>";
  }

  function filtrados() {
    const texto = busqueda.trim().toLowerCase();
    return productos.filter(function (producto) {
      const porCategoria = categoriaActiva === "Todas" || producto.categoria === categoriaActiva;
      const porTexto = !texto ||
        producto.nombre.toLowerCase().indexOf(texto) !== -1 ||
        String(producto.categoria).toLowerCase().indexOf(texto) !== -1;
      return porCategoria && porTexto;
    });
  }

  /* ---------- Pintado --------------------------------------------------- */
  function pintarFiltros() {
    const categorias = ["Todas"];
    productos.forEach(function (producto) {
      if (categorias.indexOf(producto.categoria) === -1) categorias.push(producto.categoria);
    });

    filtros.innerHTML = categorias.map(function (categoria) {
      const activa = categoria === categoriaActiva;
      return '<button class="filtro' + (activa ? " activo" : "") + '" type="button" data-filtro="' +
        escaparHtml(categoria) + '" aria-pressed="' + activa + '">' + escaparHtml(categoria) + "</button>";
    }).join("");
  }

  function pintarProductos() {
    const lista = filtrados();
    sinProductos.hidden = lista.length > 0;

    grid.innerHTML = lista.map(function (producto, indice) {
      const agotado = producto.disponible === false;
      const tallas = tallasDe(producto);
      const elegida = seleccion[producto.id] || tallas[0];

      if (!seleccion[producto.id]) seleccion[producto.id] = elegida;

      const foto = producto.imagen
        ? '<img src="' + escaparHtml(producto.imagen) + '" alt="' + escaparHtml(producto.nombre) + '" loading="lazy">'
        : silueta(producto);

      const badge = producto.badge
        ? '<span class="producto__badge' + (Number(producto.precioAntes) > 0 ? " producto__badge--oferta" : "") +
          '">' + escaparHtml(producto.badge) + "</span>"
        : "";

      const antes = Number(producto.precioAntes) > 0
        ? '<s class="producto__antes">' + formatearPrecio(producto.precioAntes) + "</s>"
        : "";

      const botonesTalla = agotado ? "" :
        '<div class="producto__tallas" role="group" aria-label="Tallas de ' + escaparHtml(producto.nombre) + '">' +
          tallas.map(function (talla) {
            const activa = talla === elegida;
            return '<button class="talla' + (activa ? " activa" : "") + '" type="button" data-talla="' +
              escaparHtml(talla) + '" data-producto="' + producto.id + '" aria-pressed="' + activa + '">' +
              escaparHtml(talla) + "</button>";
          }).join("") +
        "</div>";

      const accion = agotado
        ? '<p class="producto__aviso">Agotado</p>'
        : '<button class="producto__agregar" type="button" data-agregar="' + producto.id +
          '">Añadir al carrito</button>';

      return '<article class="producto' + (agotado ? " producto--agotado" : "") +
        '" style="--fondo: ' + FONDOS[indice % FONDOS.length] + '">' +
        '<div class="producto__foto">' + badge + foto + "</div>" +
        '<div class="producto__info">' +
          '<span class="producto__cat">' + escaparHtml(producto.categoria) + "</span>" +
          '<h3 class="producto__nombre">' + escaparHtml(producto.nombre) + "</h3>" +
          (producto.descripcion
            ? '<p class="producto__descripcion">' + escaparHtml(producto.descripcion) + "</p>"
            : "") +
          '<p class="producto__precio">' + formatearPrecio(producto.precio) + antes + "</p>" +
          botonesTalla +
          accion +
        "</div>" +
      "</article>";
    }).join("");
  }

  /* ---------- Carrito --------------------------------------------------- */
  function productoPorId(id) {
    return productos.find(function (p) { return String(p.id) === String(id); });
  }

  function carritoValido() {
    const carrito = obtenerCarrito().filter(function (item) {
      return productos.some(function (p) { return String(p.id) === String(item.id); });
    });
    guardarCarrito(carrito);
    return carrito;
  }

  function pintarCarrito() {
    const carrito = carritoValido();

    if (!carrito.length) {
      listaCarrito.innerHTML = '<p class="vacio">Tu carrito está vacío.<br>Elige una prenda y vuelve por aquí.</p>';
      totalCarrito.textContent = formatearPrecio(0);
      actualizarContadores();
      return;
    }

    let total = 0;
    listaCarrito.innerHTML = carrito.map(function (item) {
      const producto = productoPorId(item.id);
      total += Number(producto.precio) * item.cantidad;

      const foto = producto.imagen
        ? '<img src="' + escaparHtml(producto.imagen) + '" alt="">'
        : escaparHtml(producto.nombre);
      const talla = escaparHtml(item.talla);

      return '<div class="item">' +
        '<div class="item__foto">' + foto + "</div>" +
        "<div>" +
          '<p class="item__nombre">' + escaparHtml(producto.nombre) + "</p>" +
          '<p class="item__meta">' + talla + " · " + formatearPrecio(producto.precio) + "</p>" +
          '<div class="item__cantidad">' +
            '<button type="button" data-menos="' + producto.id + '" data-talla="' + talla +
              '" aria-label="Quitar una unidad">−</button>' +
            "<span>" + item.cantidad + "</span>" +
            '<button type="button" data-mas="' + producto.id + '" data-talla="' + talla +
              '" aria-label="Añadir una unidad">+</button>' +
          "</div>" +
        "</div>" +
        '<button class="item__quitar" type="button" data-quitar="' + producto.id +
          '" data-talla="' + talla + '">Quitar</button>' +
      "</div>";
    }).join("");

    totalCarrito.textContent = formatearPrecio(total);
    actualizarContadores();
  }

  function agregar(id) {
    const producto = productoPorId(id);
    if (!producto) return;

    const talla = seleccion[producto.id] || tallasDe(producto)[0];
    const carrito = carritoValido();
    const existente = carrito.find(function (item) {
      return String(item.id) === String(producto.id) && item.talla === talla;
    });

    if (existente) {
      existente.cantidad += 1;
    } else {
      carrito.push({ id: String(producto.id), talla: talla, cantidad: 1 });
    }

    guardarCarrito(carrito);
    pintarCarrito();
    abrirPanel();
  }

  function cambiarCantidad(id, talla, delta) {
    const carrito = carritoValido();
    const item = carrito.find(function (i) {
      return String(i.id) === String(id) && i.talla === talla;
    });
    if (!item) return;

    item.cantidad += delta;
    guardarCarrito(carrito.filter(function (i) { return i.cantidad > 0; }));
    pintarCarrito();
  }

  function quitar(id, talla) {
    guardarCarrito(obtenerCarrito().filter(function (item) {
      return !(String(item.id) === String(id) && item.talla === talla);
    }));
    pintarCarrito();
  }

  /* ---------- Panel del carrito ----------------------------------------- */
  function abrirPanel() {
    panel.classList.add("abierto");
    panel.setAttribute("aria-hidden", "false");
    velo.classList.add("visible");
  }

  function cerrarPanel() {
    panel.classList.remove("abierto");
    panel.setAttribute("aria-hidden", "true");
    velo.classList.remove("visible");
  }

  /* ---------- Eventos --------------------------------------------------- */
  filtros.addEventListener("click", function (evento) {
    const boton = evento.target.closest("[data-filtro]");
    if (!boton) return;
    categoriaActiva = boton.dataset.filtro;
    pintarFiltros();
    pintarProductos();
  });

  buscador.addEventListener("input", function () {
    busqueda = buscador.value;
    pintarProductos();
  });

  grid.addEventListener("click", function (evento) {
    const botonTalla = evento.target.closest("[data-talla]");

    if (botonTalla) {
      seleccion[botonTalla.dataset.producto] = botonTalla.dataset.talla;
      botonTalla.parentElement.querySelectorAll(".talla").forEach(function (boton) {
        const activa = boton === botonTalla;
        boton.classList.toggle("activa", activa);
        boton.setAttribute("aria-pressed", String(activa));
      });
      return;
    }

    const botonAgregar = evento.target.closest("[data-agregar]");
    if (botonAgregar) agregar(botonAgregar.dataset.agregar);
  });

  listaCarrito.addEventListener("click", function (evento) {
    const mas = evento.target.closest("[data-mas]");
    const menos = evento.target.closest("[data-menos]");
    const quitarBoton = evento.target.closest("[data-quitar]");

    if (mas) cambiarCantidad(mas.dataset.mas, mas.dataset.talla, 1);
    if (menos) cambiarCantidad(menos.dataset.menos, menos.dataset.talla, -1);
    if (quitarBoton) quitar(quitarBoton.dataset.quitar, quitarBoton.dataset.talla);
  });

  document.querySelectorAll("a[data-categoria]").forEach(function (enlace) {
    enlace.addEventListener("click", function () {
      categoriaActiva = enlace.dataset.categoria;
      pintarFiltros();
      pintarProductos();
    });
  });

  document.getElementById("abrir-carrito").addEventListener("click", abrirPanel);
  document.getElementById("cerrar-carrito").addEventListener("click", cerrarPanel);
  velo.addEventListener("click", cerrarPanel);
  document.addEventListener("keydown", function (evento) {
    if (evento.key === "Escape") cerrarPanel();
  });

  /* ---------- Arranque -------------------------------------------------- */
  (async function iniciar() {
    prepararCabecera();

    try {
      const datos = await API.productos();
      productos = datos.productos;
      pintarFiltros();
      pintarProductos();
      pintarCarrito();
    } catch (error) {
      grid.innerHTML = '<p class="vacio">' + escaparHtml(error.message) + "</p>";
      listaCarrito.innerHTML = '<p class="vacio">No se pudo cargar el carrito.</p>';
      actualizarContadores();
    }
  })();


})();
