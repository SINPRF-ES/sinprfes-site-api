import React, { useEffect, useState } from 'react';
import client from '../api/client';
import useAssembleiaStore from '../store/useAssembleiaStore';

function AssembleiaList() {
  const [assembleias, setAssembleias] = useState([]);
  const { setCurrentAssembleia, logout } = useAssembleiaStore();

  useEffect(() => {
    client.get('/api/assembleias')
      .then(res => setAssembleias(res.data))
      .catch(err => console.error(err));
  }, []);

  return (
    <div className="list-container">
      <header>
        <h1>Assembleias</h1>
        <button onClick={() => {
          localStorage.removeItem('token');
          logout();
        }}>Sair</button>
      </header>
      <div className="assembleia-grid">
        {assembleias.map(a => (
          <div key={a.id} className="assembleia-card" onClick={() => setCurrentAssembleia(a)}>
            <h3>{a.titulo}</h3>
            <p>{a.tipo}</p>
            <span className={`status status-${a.estado.toLowerCase()}`}>{a.estado}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AssembleiaList;
