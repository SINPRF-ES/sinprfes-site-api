import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import Dashboard from './pages/Dashboard/Dashboard';
import Diretoria from './pages/Diretoria';
import Inicio from './pages/Inicio';
import Contato from './pages/Contato';
import Estatuto from './pages/Estatuto';

function App() {
  const estaAutenticado = () => !!localStorage.getItem('token');

  return (
    <Router>
      <Header />
      <main className="container" style={{ marginTop: '30px', minHeight: '70vh' }}>
        <Routes>
          {/* Agora a raiz "/" leva para a página de Início */}
          <Route path="/" element={<Inicio />} />
          
          <Route path="/diretoria" element={<Diretoria />} />
          <Route path="/contato" element={<Contato />} />
          <Route path="/estatuto" element={<Estatuto />} />
          
          <Route 
            path="/dashboard" 
            element={estaAutenticado() ? <Dashboard /> : <Navigate to="/login.html" />} 
          />
        </Routes>
      </main>
      <Footer />
    </Router>
  );
}

export default App;