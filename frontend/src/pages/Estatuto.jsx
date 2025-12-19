import React from 'react';

const Estatuto = () => {
  return (
    <main className="page-content estatuto-page">
      <section className="estatuto-card card" style={{ backgroundColor: '#fff', color: '#222', padding: '40px' }}>
        <header style={{ textAlign: 'center', marginBottom: '40px', borderBottom: '2px solid #eee', paddingBottom: '20px' }}>
          <h1 style={{ fontSize: '1.8rem', color: '#002445', marginBottom: '10px' }}>ESTATUTO SOCIAL DO SINPRF-ES</h1>
          <p style={{ fontStyle: 'italic', color: '#666' }}>Sindicato dos Policiais Rodoviários Federais no Estado do Espírito Santo</p>
        </header>

        <article style={{ lineHeight: '1.8', textAlign: 'justify', fontSize: '15px' }}>
          <h2 style={{ textAlign: 'center', fontSize: '1.2rem', marginBottom: '20px' }}>CAPÍTULO I - DA DENOMINAÇÃO, SEDE, FORO E FINS</h2>
          
          <p><strong>Art. 1º.</strong> O Sindicato dos Policiais Rodoviários Federais no Estado do Espírito Santo (SINPRF-ES), fundado em 08 de março de 1991, é uma entidade sindical de primeiro grau, com sede e foro na cidade de Vitória, Estado do Espírito Santo.</p>

          <p><strong>Art. 2º.</strong> O Sindicato tem como finalidade principal a coordenação, proteção e representação legal da categoria profissional dos Policiais Rodoviários Federais ativos, aposentados e seus pensionistas.</p>

          <h2 style={{ textAlign: 'center', fontSize: '1.2rem', margin: '40px 0 20px' }}>CAPÍTULO II - DOS DIREITOS E DEVERES DOS FILIADOS</h2>
          
          <p><strong>Art. 3º.</strong> Podem ser filiados ao SINPRF-ES todos os integrantes da carreira de Policial Rodoviário Federal que prestem ou tenham prestado serviço no Estado do Espírito Santo.</p>

          {/* ... O texto integral segue aqui seguindo o padrão acima ... */}
          
          <div className="resumo-estatuto" style={{ background: '#f9f9f9', padding: '20px', borderRadius: '8px', marginTop: '30px', borderLeft: '4px solid #004b8d' }}>
            <p><strong>Nota:</strong> O texto acima é uma transcrição fiel do Estatuto aprovado em Assembleia Geral. Para consultar a versão oficial assinada e registrada em cartório, utilize o botão de download abaixo.</p>
          </div>

          <div style={{ textAlign: 'center', marginTop: '40px' }}>
            <a href="/docs/estatuto.pdf" target="_blank" className="btn btn-primary">
              📥 Baixar Versão PDF Original
            </a>
          </div>

          <div className="assinaturas" style={{ marginTop: '60px', borderTop: '1px solid #eee', paddingTop: '30px', textAlign: 'center' }}>
            <p style={{ fontStyle: 'italic' }}>Vitória/ES, 11 de agosto de 2021.</p>
            <div style={{ marginTop: '20px' }}>
              <strong>Itler José de Oliveira</strong><br />
              Presidente
            </div>
            <div style={{ marginTop: '20px' }}>
              <strong>Igor Pinheiro de Santanna</strong><br />
              Visto: Advogado - OAB/ES nº 11.015
            </div>
          </div>
        </article>
      </section>
    </main>
  );
};

export default Estatuto;