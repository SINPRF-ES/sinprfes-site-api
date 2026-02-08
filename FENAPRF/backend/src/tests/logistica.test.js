const { checkConflict } = require("../../shared/constants");
const assert = require("assert");

function testConflict() {
    console.log("Running checkConflict tests...");

    // Diferentes UFs -> Não deve ter conflito
    assert.strictEqual(checkConflict("Presidente", "ES", "Vice-Presidente", "MG"), false, "UFs diferentes não devem ter conflito");

    // Mesma UF, Mesmos Cargos -> Conflito
    assert.strictEqual(checkConflict("Presidente", "ES", "Presidente", "ES"), true, "Mesmo cargo na mesma UF deve ter conflito");

    // Mesma UF, cargos complementares -> Conflito
    assert.strictEqual(checkConflict("Presidente", "ES", "Vice-Presidente", "ES"), true, "Presidente + Vice na mesma UF deve ter conflito");
    assert.strictEqual(checkConflict("Delegado Representante", "DF", "Delegado Substituto", "DF"), true, "Delegado Representante + Substituto na mesma UF deve ter conflito");

    // Mesma UF, cargos não conflitantes
    assert.strictEqual(checkConflict("Presidente", "ES", "Delegado Representante", "ES"), false, "Presidente + Delegado na mesma UF não deve ter conflito");
    assert.strictEqual(checkConflict("Conselheiro", "RJ", "Diretor", "RJ"), false, "Conselheiro + Diretor não deve ter conflito");

    // Case insensitivity
    assert.strictEqual(checkConflict("presidente", "es", "VICE-PRESIDENTE", "ES"), true, "Deve ser case insensitive");

    console.log("✅ checkConflict tests passed!");
}

try {
    testConflict();
} catch (e) {
    console.error("❌ checkConflict tests failed:");
    console.error(e.message);
    process.exit(1);
}
