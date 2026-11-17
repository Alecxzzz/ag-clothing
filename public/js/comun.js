/* ==========================================================================
   A&G CLOTHING — configuración, utilidades y cabecera compartida
   Cambia aquí el nombre, el WhatsApp y las cuentas de pago.
   ========================================================================== */

const CONFIG = {
  marca: {
    nombre: "A&G CLOTHING",
    monograma: "A&G",
    lema: "Ropa con carácter",
    moneda: "C$",
    whatsapp: "50557233510", // -> https://wa.me/50557233510
    whatsappVisible: "+505 5723 3510",
  },

  pagos: [
    {
      id: "bac",
      banco: "BAC Credomatic",
      tipo: "Cuenta de ahorro",
      numero: "000000000",
      titular: "Nombre del titular de la cuenta",
      logo: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTPKyUO7FzhgDSBrBe7peXAxzFydHKPrCTRh554XGLWhw&s",
    },
    {
      id: "lafise",
      banco: "LAFISE",
      tipo: "Cuenta de ahorro",
      numero: "000000000",
      titular: "Nombre del titular de la cuenta",
      logo: "https://www.lafise.com/Portals/0/Logo_LAFISEultimo2.png?ver=2020-03-11-120637-857",
    },
  ],
};

const CLAVES = { carrito: "agy_carrito" };

/* ---------- Utilidades -------------------------------------------------- */
function formatearPrecio(valor) {
  return CONFIG.marca.moneda + " " + (Number(valor) || 0).toFixed(2);
}

function escaparHtml(texto) {
  return String(texto == null ? "" : texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function enlaceWhatsapp(mensaje) {
  return "https://wa.me/" + CONFIG.marca.whatsapp + "?text=" + encodeURIComponent(mensaje);
}

function fechaCorta(iso) {
  if (!iso) return "";
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "";
  return fecha.toLocaleDateString("es-NI", { day: "2-digit", month: "short", year: "numeric" }) +
    " · " + fecha.toLocaleTimeString("es-NI", { hour: "2-digit", minute: "2-digit" });
}

/* ---------- Carrito (se guarda en el navegador) ------------------------- */
function obtenerCarrito() {
  try {
    const datos = JSON.parse(window.localStorage.getItem(CLAVES.carrito) || "[]");
    return Array.isArray(datos) ? datos : [];
  } catch (error) {
    return [];
  }
}

function guardarCarrito(lista) {
  try {
    window.localStorage.setItem(CLAVES.carrito, JSON.stringify(lista));
  } catch (error) {
    /* si el navegador bloquea el almacenamiento, el carrito dura la sesión */
  }
  actualizarContadores();
}

function contarCarrito() {
  return obtenerCarrito().reduce(function (suma, item) {
    return suma + (Number(item.cantidad) || 0);
  }, 0);
}

function actualizarContadores() {
  const total = contarCarrito();
  document.querySelectorAll("[data-contador]").forEach(function (el) {
    el.textContent = String(total);
  });
}

/* ---------- Cabecera común ---------------------------------------------- */
function pintarSesion(usuario) {
  const enlace = document.getElementById("enlace-cuenta");
  if (enlace) {
    enlace.textContent = usuario ? usuario.nombre.split(" ")[0] : "Iniciar sesión";
    enlace.href = usuario ? (usuario.rol === "admin" ? "admin.html" : "cuenta.html") : "cuenta.html";
  }

  document.querySelectorAll("[data-solo-admin]").forEach(function (el) {
    el.hidden = !(usuario && usuario.rol === "admin");
  });
}

async function prepararCabecera() {
  const marca = document.getElementById("marca-nombre");
  if (marca) marca.textContent = CONFIG.marca.monograma;
  document.title = document.title.replace("A&G CLOTHING", CONFIG.marca.nombre);

  document.querySelectorAll("[data-whatsapp]").forEach(function (el) {
    el.href = enlaceWhatsapp(el.dataset.mensaje || "Hola A&G CLOTHING, quiero información sobre sus prendas.");
    el.target = "_blank";
    el.rel = "noopener";
  });

  document.querySelectorAll("[data-whatsapp-visible]").forEach(function (el) {
    el.textContent = CONFIG.marca.whatsappVisible;
  });

  document.querySelectorAll("[data-anio]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  /* menú móvil */
  const botonMenu = document.querySelector("[data-menu]");
  const nav = document.getElementById("nav");

  if (botonMenu && nav) {
    botonMenu.addEventListener("click", function () {
      const abierto = document.body.classList.toggle("menu-abierto");
      botonMenu.setAttribute("aria-expanded", String(abierto));
    });
    nav.addEventListener("click", function (evento) {
      if (evento.target.closest("a")) document.body.classList.remove("menu-abierto");
    });
  }

  actualizarContadores();

  try {
    const datos = await API.sesion();
    pintarSesion(datos.usuario);
    return datos.usuario;
  } catch (error) {
    pintarSesion(null);
    return null;
  }
}
