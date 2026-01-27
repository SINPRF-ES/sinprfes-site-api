import json
from playwright.sync_api import sync_playwright

def verify_assemblies():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))

        # Force bypass login by mocking the check
        page.add_init_script("""
            window.Utils = {
                obterUserInfo: () => ({id: '1', nome: 'Filiado Teste', perfil_acesso: 'FILIADO'})
            };
            window.Api = {
                apiFetch: async (url, options) => {
                    console.log('MOCK FETCH:', url);
                    if (url.includes('/api/assembleias/1/estado')) return { ok: true, json: async () => ({
                        assembleia: { id: '1', titulo: 'Assembleia Geral Extraordinária de Teste', tipo: 'AGE' },
                        quorumVigente: { total: 15, userHasCheckedIn: false, presentes: [] },
                        votacaoAtiva: null, mesa: null, pedidosPalavra: [], propostas: []
                    }), blob: async () => new Blob(['pdf'], {type: 'application/pdf'}) };

                    if (url.includes('/api/assembleias/1')) return { ok: true, json: async () => ({
                        id: '1', tipo: 'AGE', titulo: 'Assembleia Geral Extraordinária de Teste',
                        pauta: '1. Teste de Pauta\\n2. Novo Layout', estado: 'ABERTA',
                        data_evento: '2026-12-31', hora_primeira_chamada: '19:00', hora_segunda_chamada: '19:30',
                        edital_url: '/api/assembleias/1/edital'
                    }) };

                    if (url.includes('/api/assembleias')) return { ok: true, json: async () => ([
                        { id: '1', tipo: 'AGE', titulo: 'Assembleia Geral Extraordinária de Teste', estado: 'ABERTA', data_evento: '2026-12-31', hora_primeira_chamada: '19:00', hora_segunda_chamada: '19:30' }
                    ]) };

                    return { ok: true, json: async () => ({}) };
                }
            };
            // Mock window.Formatters and others if needed
            window.Formatters = { formatISOToBR: (d) => d };
            window.AssembleiaUtils = {
                getStatusLabel: (s) => s,
                getStatusEmoji: (s) => '🗳️'
            };
        """)

        page.goto("http://localhost:3000/area-filiado.html")
        page.wait_for_timeout(2000)

        # Manually trigger section switch if needed, but area-filiado.js should handle it
        # Let's just force the section to be visible and call the initializer
        page.evaluate("""() => {
            document.querySelectorAll('.af-section').forEach(s => s.style.display = 'none');
            document.getElementById('sec-assembleias').style.display = 'block';
            window.Assembleias.inicializarAssembleias('FILIADO');
        }""")

        page.wait_for_timeout(2000)
        page.screenshot(path="assemblies_list.png")
        print("Took assemblies_list.png")

        # Click Details
        page.click("button:has-text('Ver Detalhes')")
        page.wait_for_timeout(2000)
        page.screenshot(path="assembly_details.png")
        print("Took assembly_details.png")

        # Test Sala
        page.evaluate("""() => {
            // Mock state to be checked in
            const originalFetch = window.Api.apiFetch;
            window.Api.apiFetch = async (url) => {
                if (url.includes('/estado')) return { ok: true, json: async () => ({
                    assembleia: { id: '1', titulo: 'Assembleia Geral Extraordinária de Teste', tipo: 'AGE' },
                    quorumVigente: { total: 15, userHasCheckedIn: true, presentes: [] },
                    votacaoAtiva: {
                        id: 'v1', titulo: 'Votação Ativa', status: 'ATIVA',
                        contagem: {SIM: 10, NAO: 5, total: 15}, userVoted: false,
                        encerra_em: new Date(Date.now() + 60000).toISOString()
                    },
                    mesa: { presidente_nome: 'Presidente', secretario_nome: 'Secretario' },
                    pedidosPalavra: [], propostas: []
                }) };
                return originalFetch(url);
            };
            window.Assembleias.abrirDetalhes('1');
        }""")
        page.wait_for_timeout(2000)
        page.click("button:has-text('Entrar na Sala')")
        page.wait_for_timeout(2000)
        page.screenshot(path="assembly_sala.png")
        print("Took assembly_sala.png")

        browser.close()

if __name__ == "__main__":
    verify_assemblies()
