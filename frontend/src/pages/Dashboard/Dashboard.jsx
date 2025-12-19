import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import './style.css';

const Dashboard = () => {
    const [user, setUser] = useState(null);
    const [abaAtiva, setAbaAtiva] = useState('sec-meus-dados');

    useEffect(() => {
        api.get('/filiados/me')
            .then(res => setUser(res.data))
            .catch(() => window.location.href = '/login.html');
    }, []);

    if (!user) return <div className="loading">Carregando painel...</div>;

    return (
        <main className="page container area-filiado-main">
            <section className="card af-layout section-card">
                {/* Sidebar Identica à Original */}
                <div className="af-sidebar">
                    <h1 className="section-title">
                        <span className="emoji">👤</span>
                        <span>Área do filiado</span>
                    </h1>
                    <p className="section-subtitle">
                        Olá, <strong>{user.nome}</strong>.
                    </p>

                    <nav className="af-nav">
                        <button 
                            className={`af-nav-item ${abaAtiva === 'sec-meus-dados' ? 'active' : ''}`}
                            onClick={() => setAbaAtiva('sec-meus-dados')}
                        >
                            Meus dados
                        </button>
                        
                        {/* Exemplo de aba protegida pelo perfil que corrigimos no banco */}
                        {["ADMIN", "DIRETORIA"].includes(user.perfil_acesso) && (
                            <button 
                                className={`af-nav-item ${abaAtiva === 'sec-filiados' ? 'active' : ''}`}
                                onClick={() => setAbaAtiva('sec-filiados')}
                            >
                                Gerir Filiados
                            </button>
                        )}

                        <button className="af-nav-item text-danger" onClick={() => {
                            localStorage.removeItem('token');
                            window.location.href = '/login.html';
                        }}>
                            Sair
                        </button>
                    </nav>
                </div>

                {/* Conteúdo das Abas */}
                <div className="af-content">
                    {abaAtiva === 'sec-meus-dados' && (
                        <div className="section-card">
                            <h2 className="section-title"><span className="emoji">📝</span> Meus Dados</h2>
                            <div className="section-box">
                                <p><strong>CPF:</strong> {user.cpf}</p>
                                <p><strong>E-mail:</strong> {user.email1}</p>
                                <p><strong>Lotação:</strong> {user.lotacao || 'Sede'}</p>
                            </div>
                        </div>
                    )}
                    
                    {abaAtiva === 'sec-filiados' && (
                        <div className="section-card">
                            <h2 className="section-title">Gerenciamento</h2>
                            <p>Aqui entrará a lista de filiados que você já tem no service.</p>
                        </div>
                    )}
                </div>
            </section>
        </main>
    );
};

export default Dashboard;