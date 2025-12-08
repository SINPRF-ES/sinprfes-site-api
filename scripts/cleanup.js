const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

const arquivosParaApagar = [
  "index.js",
  "auth.js",
  "db.js",
  "node_modules/.package-lock.json"
];

function apagarArquivo(file) {
  const full = path.join(root, file);
  if (fs.existsSync(full)) {
    fs.unlinkSync(full);
    console.log("🗑️ Removido:", file);
  }
}

console.log("=== LIMPEZA DO PROJETO SINPRF-ES ===");

arquivosParaApagar.forEach(apagarArquivo);

console.log("✔ Limpeza concluída!");
