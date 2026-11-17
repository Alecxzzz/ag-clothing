/* ==========================================================================
   A&G CLOTHING — cuenta: iniciar sesión y crear cuenta (cuenta.html)
   ========================================================================== */
(function () {
  "use strict";

  const tabLogin = document.getElementById("tab-login");
  const tabRegistro = document.getElementById("tab-registro");
  const formLogin = document.getElementById("form-login");
  const formRegistro = document.getElementById("form-registro");
  const errorLogin = document.getElementById("error-login");
  const errorRegistro = document.getElementById("error-registro");
  const sesionIniciada = document.getElementById("sesion-iniciada");
  const saludo = document.getElementById("saludo");
  const enlacePanel = document.getElementById("enlace-panel");
  const salir = document.getElementById("salir");

  function mostrarPestana(cual) {
    const esLogin = cual === "login";

    tabLogin.classList.toggle("activa", esLogin);
    tabRegistro.classList.toggle("activa", !esLogin);
    tabLogin.setAttribute("aria-selected", String(esLogin));
    tabRegistro.setAttribute("aria-selected", String(!esLogin));

    formLogin.hidden = !esLogin;
    formRegistro.hidden = esLogin;
    errorLogin.hidden = true;
    errorRegistro.hidden = true;
  }

  function mostrarSesion(usuario) {
    document.querySelector(".pestanas").hidden = true;
    formLogin.hidden = true;
    formRegistro.hidden = true;
    sesionIniciada.hidden = false;

    saludo.textContent = "Sesión iniciada como " + usuario.nombre + " (" + usuario.email + ").";
    enlacePanel.hidden = usuario.rol !== "admin";
    pintarSesion(usuario);
  }

  function mostrarError(elemento, mensaje) {
    elemento.textContent = mensaje;
    elemento.hidden = false;
  }

  tabLogin.addEventListener("click", function () { mostrarPestana("login"); });
  tabRegistro.addEventListener("click", function () { mostrarPestana("registro"); });

  formLogin.addEventListener("submit", async function (evento) {
    evento.preventDefault();
    errorLogin.hidden = true;

    const identificador = document.getElementById("usuario").value.trim();
    const clave = document.getElementById("login-clave").value;

    if (!identificador || !clave) {
      mostrarError(errorLogin, "Escribe tu usuario (o correo) y tu contraseña.");
      return;
    }

    try {
      const datos = await API.login(identificador, clave);
      mostrarSesion(datos.usuario);
    } catch (error) {
      mostrarError(errorLogin, error.message);
    }
  });

  formRegistro.addEventListener("submit", async function (evento) {
    evento.preventDefault();
    errorRegistro.hidden = true;

    const nombre = document.getElementById("reg-nombre").value.trim();
    const email = document.getElementById("reg-email").value.trim();
    const clave = document.getElementById("reg-clave").value;

    if (nombre.length < 2) return mostrarError(errorRegistro, "Escribe tu nombre completo.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return mostrarError(errorRegistro, "El correo no es válido.");
    if (clave.length < 6) return mostrarError(errorRegistro, "La contraseña necesita al menos 6 caracteres.");

    try {
      const datos = await API.registro({ nombre: nombre, email: email, clave: clave });
      mostrarSesion(datos.usuario);
    } catch (error) {
      mostrarError(errorRegistro, error.message);
    }
  });

  salir.addEventListener("click", async function () {
    try {
      await API.salir();
    } catch (error) {
      /* aunque falle, recargamos para limpiar la vista */
    }
    window.location.reload();
  });

  /* Arranque ------------------------------------------------------------- */
  prepararCabecera().then(function (usuario) {
    if (usuario) {
      mostrarSesion(usuario);
    } else {
      mostrarPestana("login");
    }
  });
})();
