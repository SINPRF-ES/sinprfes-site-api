// C:\D\sinprfes\sinprfes-site-api\frontend\src\components\Footer.jsx

import React from 'react';

const Footer = () => {
  return (
    <footer>
      <div className="container footer-inner">
        <div className="footer-text">
          © {new Date().getFullYear()} SINPRF-ES — Sindicato dos Policiais Rodoviários Federais no Espírito Santo.
          <br />
          Portal em desenvolvimento. Conteúdos sujeitos a ajustes.
        </div>
      </div>
    </footer>
  );
};

export default Footer;