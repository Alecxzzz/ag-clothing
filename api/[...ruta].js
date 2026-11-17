/* ==========================================================================
   A&G CLOTHING — punto de entrada para Vercel.
   Cualquier petición a /api/... llega a esta función (catch-all) y la
   resuelve server.js, el mismo archivo que se usa en local.
   ========================================================================== */
module.exports = require("../server.js");
