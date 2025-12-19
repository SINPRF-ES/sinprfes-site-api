import React from 'react';

const Contato = () => {
  return (
    <main className="page-content">
      <section className="card">
        <h2 className="section-title">
          <span className="emoji">📞</span> Fale conosco
        </h2>
        <p className="section-subtitle">Canais oficiais de atendimento ao filiado e ao público.</p>

        <div className="section-box contato-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
          <div className="contato-info">
            <p><strong>Endereço:</strong><br />
              Avenida Nair de Azevedo Silva, 450, Lojas 14/20<br />
              Bairro Mário Cypreste – Vitória/ES
            </p>
            <p style={{ marginTop: '15px' }}><strong>Telefones:</strong><br />
              (27) 99607-3073<br />
              (27) 99691-9312
            </p>
            <p style={{ marginTop: '15px' }}><strong>E-mail:</strong><br />
              <a href="mailto:sinprfes@sinprfes.org.br" style={{ color: 'var(--amarelo)' }}>sinprfes@sinprfes.org.br</a>
            </p>
          </div>

          <aside className="contato-acao" style={{ background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '12px' }}>
            <h3>Atendimento rápido</h3>
            <p style={{ marginBottom: '15px', fontSize: '0.9rem' }}>Escolha o canal de contato preferido:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <a href="https://wa.me/5527996073073" target="_blank" className="btn btn-primary">💬 WhatsApp 1</a>
              <a href="https://wa.me/5527996919312" target="_blank" className="btn btn-primary">💬 WhatsApp 2</a>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
};

export default Contato;