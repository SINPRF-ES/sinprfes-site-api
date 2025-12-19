import React from 'react';
import { Link } from 'react-router-dom';

const Inicio = () => {
  return (
    <main className="page-content" id="inicio">
      <section className="card">
        <h2 className="section-title">
          <span className="emoji">👋</span>
          <span>Bem-vindo ao SINPRF-ES</span>
        </h2>
        <p className="section-subtitle">
          Sindicato dos Policiais Rodoviários Federais no Estado do Espírito Santo.
        </p>

        <div className="section-box">
          <p>
            Nossa missão é defender, representar e fortalecer os policiais rodoviários federais do estado,
            garantindo direitos, melhorias, valorização e bem-estar.
          </p>
        </div>

        <div className="btn-row" style={{ display: 'flex', gap: '15px', marginTop: '20px' }}>
          <Link to="/diretoria" className="btn btn-outline">Conheça a Diretoria</Link>
          <Link to="/estatuto" className="btn btn-primary">Consultar Estatuto</Link>
        </div>
      </section>
      
      {/* Correção: 'var(--amarelo)' entre aspas */}
      <section className="card destaque-jogos" style={{ marginTop: '20px', borderLeft: '5px solid var(--amarelo)' }}>
        <h3 style={{ color: 'var(--amarelo)' }}>🏆 Jogos de Integração 2026</h3>
        <p style={{ marginTop: '10px' }}>Prepare-se para o maior evento esportivo da nossa categoria. Em breve, inscrições abertas!</p>
      </section>
    </main>
  );
};

export default Inicio;