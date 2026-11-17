const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'public', 'img', 'productos');

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
  console.log('Directorio creado en:', dir);
} else {
  console.log('Directorio ya existe en:', dir);
}