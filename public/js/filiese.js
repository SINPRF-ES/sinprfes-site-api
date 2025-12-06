// public/js/filiese.js

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('filiese-form');

    if (form) {
        form.addEventListener('submit', async (event) => {
            // 1. IMPEDE O ENVIO PADRÃO E COLETA OS DADOS
            event.preventDefault();

            const submitButton = form.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = 'Gerando PDF e Enviando...'; 
            
            const formData = new FormData(form);
            const data = {};
            
            // Converte FormData para objeto JSON, tratando checkboxes
            formData.forEach((value, key) => {
                if (key === 'aceite' || key === 'aceite_lgpd_opcional') {
                   // Se o checkbox estiver marcado, o valor é 'on' ou true. 
                   // A rota de backend só verifica a existência de 'aceite'.
                   data[key] = true;
                } else {
                   data[key] = value;
                }
            });

            // Adiciona campos não marcados para garantir que estejam presentes no objeto (específico para checkboxes)
            if (!formData.has('aceite')) {
                data['aceite'] = false; 
            }
            if (!formData.has('aceite_lgpd_opcional')) {
                data['aceite_lgpd_opcional'] = false;
            }


            // 2. ENVIA OS DADOS PARA A ROTA DO SEU BACKEND
            try {
                // Rota que você já tem no seu index.js
                const response = await fetch('/api/filiese', { 
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                // 3. TRATAMENTO DA RESPOSTA
                if (response.ok) {
                    alert('Solicitação de filiação enviada com sucesso! Você receberá uma cópia no seu e-mail pessoal.');
                    form.reset(); 
                } else {
                    const errorData = await response.json();
                    alert(`Erro ao processar a solicitação: ${errorData.error || response.statusText}`);
                }
            } catch (error) {
                console.error('Erro de conexão ou processamento:', error);
                alert('Ocorreu um erro de rede. Tente novamente.');
            } finally {
                // 4. REATIVA O BOTÃO
                submitButton.disabled = false;
                submitButton.textContent = 'Enviar solicitação de filiação';
            }
        });
    }
});