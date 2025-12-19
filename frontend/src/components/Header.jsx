import React from 'react';
import { Link } from 'react-router-dom';

const Header = () => {
  return (
    <>
      <div className="topbar">
        Portal oficial do <strong>SINPRF-ES</strong> em construção. Em breve, mais serviços ao filiado.
      </div>

      <header>
        <div className="container header-inner">
          <div className="brand">
            <Link to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', gap: '15px' }}>
              <div className="brand-logo">
                <img src="/img/placeholder-sinprf.png" alt="Logo SINPRF-ES" />
              </div>
              <div className="brand-text">
                <h1><span>SINPRF</span>-ES</h1>
                <p>Sindicato dos Policiais Rodoviários Federais no Espírito Santo</p>
              </div>
            </Link>
          </div>

          <nav className="header-nav">
            <Link to="/" className="nav-link">Início</Link>
            <Link to="/diretoria" className="nav-link">Diretoria</Link>
            <Link to="/contato" className="nav-link nav-cta">Fale conosco</Link>
            <Link to="/dashboard" className="nav-link" style={{fontWeight: 'bold', marginLeft: '10px'}}>Área do Filiado</Link>
          </nav>
        </div>
      </header>
    </>
  );
};

export default Header;