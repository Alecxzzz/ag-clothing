const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
const files = ['index.html', 'checkout.html', 'cuenta.html', 'admin.html', 'politica-envio.html'];

for (const f of files) {
  const filePath = path.join(publicDir, f);
  const data = fs.readFileSync(filePath);
  // Guardar como UTF-8 sin BOM
  fs.writeFileSync(filePath, data, 'utf8');
  console.log('Re-fixed: ' + f);
}
