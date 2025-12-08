// src/controllers/primeiroAcesso.controller.js
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const {
  normalizarCpf,
  normalizarDataEntrada,
  normalizarDataBanco,
} = require("../utils/format");
const {
  buscarPorCpf,
  atualizarPrimeiroAcesso,
} = require("../services/filiados.service");

exports.iniciar = async (req, res) => {
  try {
    const { cpf, data_nascimento } = req.body || {};

    if (!cpf || !data_nascimento) {
      return res.status(400).json({
        error: "Informe CPF e data de nascimento.",
      });
    }

    const cpfNormalizado = normalizarCpf(cpf);
    const dataEntradaISO = normalizarDataEntrada(data_nascimento);

    const filiado = await buscarPorCpf(cpfNormalizado);

    if (!filiado) {
      return res.status(400).json({ error: "CPF não encontrado na base do sindicato." });
    }

    const dataBancoISO = normalizarDataBanco(filiado.data_nascimento);

    if (dataBancoISO !== dataEntradaISO) {
      return res
        .status(400)
        .json({ error: "CPF ou data de nascimento não conferem." });
    }

    if (filiado.situacao && filiado.situacao !== "Ativo") {
      return res
        .status(400)
        .json({ error: "Seu cadastro não está ativo na base do sindicato." });
    }

    return res.json({
      id: filiado.id,
      nome: filiado.nome,
      cpf: filiado.cpf,
      telefone1: filiado.telefone1 || "",
      telefone2: filiado.telefone2 || "",
      email1: filiado.email1 || "",
      email2: filiado.email2 || "",
      endereco: filiado.endereco || "",
      situacao: filiado.situacao || "",
    });
  } catch (err) {
    console.error("💥 Erro em primeiro-acesso/iniciar:", err);
    return res.status(500).json({ error: "Erro interno ao iniciar primeiro acesso." });
  }
};

exports.confirmar = async (req, res) => {
  try {
    const {
      id,
      cpf,
      telefone1,
      telefone2,
      email1,
      email2,
      endereco,
      senha,
    } = req.body || {};

    if (!id || !cpf || !telefone1 || !email1 || !endereco || !senha) {
      return res.status(400).json({
        error: "Preencha todos os campos obrigatórios para concluir o cadastro.",
      });
    }

    if (senha.length < 6) {
      return res.status(400).json({
        error: "A senha deve ter pelo menos 6 caracteres.",
      });
    }

    const cpfNormalizado = normalizarCpf(cpf);

    const senha_hash = await bcrypt.hash(senha, 10);

    const atualizado = await atualizarPrimeiroAcesso(id, cpfNormalizado, {
      telefone1,
      telefone2: telefone2 || "",
      email1,
      email2: email2 || "",
      endereco,
      senha_hash,
    });

    if (!atualizado) {
      return res
        .status(400)
        .json({ error: "Não foi possível atualizar seus dados. Verifique o CPF." });
    }

    const perfil = atualizado.perfil_acesso || "FILIADO";

    const token = jwt.sign(
      {
        id: atualizado.id,
        cpf: atualizado.cpf,
        nome: atualizado.nome,
        perfil_acesso: perfil,
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    return res.json({
      message: "Primeiro acesso concluído com sucesso.",
      token,
      perfil_acesso: perfil,
    });
  } catch (err) {
    console.error("💥 Erro em primeiro-acesso/confirmar:", err);
    return res
      .status(500)
      .json({ error: "Erro interno ao confirmar dados no primeiro acesso." });
  }
};
