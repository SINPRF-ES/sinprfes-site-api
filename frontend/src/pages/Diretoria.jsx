import React from 'react';

const Diretoria = () => {
  // Dados extraídos exatamente do seu HTML original
  const diretoriaExecutiva = [
    { cargo: "PRESIDENTE", nome: "Marcelo Fávero Brandão", foto: "presidente.jpg" },
    { cargo: "VICE-PRESIDENTE", nome: "Andre Luis Olmo de Aquino", foto: "vice-presidente.jpg" },
    { cargo: "DELEGADO REPRESENTANTE", nome: "Angelo Silva Gava", foto: "delegado-representante.jpg" },
    { cargo: "DELEGADO REPRESENTANTE SUPLENTE", nome: "Emerson Ander Milanezi", foto: "delegado-representante-suplente.jpg" },
    { cargo: "DIRETOR DE SECRETARIA", nome: "Leonardo Noel Gomes", foto: "diretor-secretaria.jpg" },
    { cargo: "DIRETORA DE SECRETARIA SUPLENTE", nome: "Nadia Helena da Paixão Gave", foto: "diretora-secretaria-suplente.jpg" },
    { cargo: "DIRETOR FINANCEIRO", nome: "Vinicius Scopel de Carvalho", foto: "diretor-financeiro.jpg" },
    { cargo: "DIRETOR FINANCEIRO SUPLENTE", nome: "Orlando Jeronymo da Silva Junior", foto: "diretor-financeiro-suplente.jpg" },
    { cargo: "DIRETOR JURÍDICO", nome: "Vinicius Xavier Teixeira", foto: "diretor-juridico.jpg" },
    { cargo: "DIRETOR JURÍDICO SUPLENTE", nome: "Ricardo Assad Galveas", foto: "diretor-juridico-suplente.jpg" },
    { cargo: "DIRETOR SOCIAL", nome: "Fabiano Prates Moreira", foto: "diretor-social.jpg" },
    { cargo: "DIRETOR SOCIAL SUPLENTE", nome: "Wagner Luiz Serpa da Motta", foto: "diretor-social-suplente.jpg" },
    { cargo: "DIRETORA PARLAMENTAR", nome: "Ana Carolina Albuquerque Cavalcanti", foto: "diretora-parlamentar.jpg" },
    { cargo: "DIRETOR PARLAMENTAR SUPLENTE", nome: "Fabricio Barros Gomes de Lima", foto: "diretor-parlamentar-suplente.jpg" },
  ];

  const conselhoFiscal = [
    { cargo: "PRESIDENTE DO CONSELHO FISCAL", nome: "Felipe Sobrinho Casado", foto: "presidente-conselho-fiscal.jpg" },
    { cargo: "1º MEMBRO DO CONSELHO FISCAL", nome: "Sander Oliveira da Silva", foto: "membro1-conselho-fiscal.jpg" },
    { cargo: "2º MEMBRO DO CONSELHO FISCAL", nome: "Luiz Claudio Ferreguetti", foto: "membro2-conselho-fiscal.jpg" },
  ];

  // Função auxiliar para renderizar os cards
  const renderCards = (lista) => lista.map((membro, index) => (
    <article className="member-card" key={index}>
      <div className="member-photo">
        <img 
          src={`/img/diretor/${membro.foto}`} 
          alt={`Foto do ${membro.cargo}`} 
          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
        />
      </div>
      <div className="member-info">
        <div className="member-role">{membro.cargo}</div>
        <div className="member-name">{membro.nome}</div>
      </div>
    </article>
  ));

  return (
    <main className="page-content" id="diretoria">
      <section className="card">
        <h2 className="section-title">
          <span className="emoji">👔</span> Diretoria e Conselho Fiscal
        </h2>
        <p className="section-subtitle">
          Composição da Diretoria Executiva e do Conselho Fiscal do
          Sindicato dos Policiais Rodoviários Federais no Estado do Espírito Santo – Gestão 2025/2027.
        </p>

        <div className="section-box">
          <div className="board-group-title">Diretoria Executiva</div>
          <div className="board-grid">
            {renderCards(diretoriaExecutiva)}
          </div>

          <div className="board-group-title" style={{ marginTop: '32px' }}>
            Conselho Fiscal
          </div>
          <div className="board-grid">
            {renderCards(conselhoFiscal)}
          </div>
        </div>
      </section>
    </main>
  );
};

export default Diretoria;