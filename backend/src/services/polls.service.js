const repository = require("../repositories/polls.repository");

function normalizeType(type) {
  const value = String(type || "").toUpperCase().trim();
  if (value === "SIM_NAO" || value === "YES_NO") return "YES_NO";
  if (value === "MULTIPLA_ESCOLHA" || value === "MULTIPLE_CHOICE") return "MULTIPLE_CHOICE";
  return "";
}

function ensureFutureDate(deadlineAt) {
  const parsed = new Date(deadlineAt);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Data limite inválida.");
  }
  return parsed.toISOString();
}

function buildOptions({ type, allowOtherOption, options }) {
  if (type === "YES_NO") {
    const base = [
      { label: "Sim", is_other: false },
      { label: "Não", is_other: false },
    ];
    if (allowOtherOption) base.push({ label: "Outro", is_other: true });
    return base;
  }

  const normalized = (options || [])
    .map((label) => String(label || "").trim())
    .filter(Boolean)
    .map((label) => ({ label, is_other: false }));

  if (normalized.length < 2) {
    throw new Error("Informe ao menos 2 opções para enquete de múltipla escolha.");
  }

  if (allowOtherOption) normalized.push({ label: "Outro", is_other: true });
  return normalized;
}

function validatePayload(payload) {
  const title = String(payload?.title || payload?.question || "").trim();
  if (!title) throw new Error("Pergunta é obrigatória.");

  const type = normalizeType(payload?.type);
  if (!type) throw new Error("Tipo de enquete inválido.");

  const allowMultipleAnswers = Boolean(payload?.allow_multiple_answers ?? payload?.allowMultipleAnswers);
  const allowOtherOption = Boolean(payload?.allow_other_option ?? payload?.allowOtherOption);

  const deadlineAt = ensureFutureDate(payload?.deadline_at ?? payload?.deadlineAt);
  const options = buildOptions({ type, allowOtherOption, options: payload?.options || [] });

  return { title, type, allowMultipleAnswers, allowOtherOption, deadlineAt, options };
}

async function createPoll({ userId, payload }) {
  const data = validatePayload(payload);
  return repository.createPoll({ ...data, createdBy: userId });
}

async function updatePoll({ pollId, payload }) {
  const data = validatePayload(payload);
  return repository.updatePoll({ pollId, ...data });
}

async function publishPoll(pollId) {
  return repository.publishPoll(pollId);
}

async function listPolls(status) {
  const mapped = String(status || "").toLowerCase() === "encerradas" ? "CLOSED" : "ACTIVE";
  return repository.listPolls({ status: mapped });
}

async function getPollById({ pollId, userId }) {
  const poll = await repository.getPollById(pollId);
  if (!poll) return null;

  const myVotes = await repository.getVotesByUser({ pollId, userId });
  const resultsRows = await repository.getPollResults(pollId);

  const grouped = poll.options.map((option) => {
    const voters = resultsRows
      .filter((row) => Number(row.option_id) === Number(option.id) && row.user_id)
      .map((row) => ({
        user_id: row.user_id,
        nome: row.nome,
        other_text: row.other_text,
      }));

    return {
      ...option,
      votes_count: voters.length,
      voters,
    };
  });

  return {
    ...poll,
    options: grouped,
    my_votes: myVotes,
  };
}

async function vote({ pollId, userId, payload }) {
  const poll = await repository.getPollById(pollId);
  if (!poll) throw new Error("Enquete não encontrada.");
  if (poll.status !== "ACTIVE") throw new Error("Enquete encerrada ou ainda não publicada.");
  if (new Date(poll.deadline_at).getTime() <= Date.now()) throw new Error("Enquete encerrada.");

  const selectedOptionIdsRaw = payload?.option_ids ?? payload?.optionIds ?? payload?.option_id ?? payload?.optionId;
  const rawList = Array.isArray(selectedOptionIdsRaw) ? selectedOptionIdsRaw : [selectedOptionIdsRaw];
  const selectedOptionIds = [...new Set(rawList.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))];

  if (!selectedOptionIds.length) throw new Error("Selecione ao menos uma opção.");
  if (!poll.allow_multiple_answers && selectedOptionIds.length > 1) {
    throw new Error("Esta enquete aceita apenas uma resposta.");
  }

  const validOptions = new Map(poll.options.map((opt) => [Number(opt.id), opt]));
  for (const optionId of selectedOptionIds) {
    if (!validOptions.has(optionId)) throw new Error("Opção inválida para esta enquete.");
  }

  const otherTexts = payload?.other_texts || payload?.otherTexts || {};
  const votes = selectedOptionIds.map((optionId) => {
    const opt = validOptions.get(optionId);
    let otherText = null;

    if (opt.is_other) {
      const fromMap = otherTexts[optionId] || otherTexts[String(optionId)] || payload?.other_text || payload?.otherText;
      otherText = String(fromMap || "").trim();
      if (!otherText) throw new Error("Informe sua resposta para a opção Outro.");
    }

    return { optionId, otherText };
  });

  await repository.replaceVote({ pollId, userId, votes });
  return { success: true };
}

async function getResults(pollId) {
  const poll = await repository.getPollById(pollId);
  if (!poll) return null;
  const detailed = await getPollById({ pollId, userId: 0 });
  return detailed;
}

module.exports = {
  createPoll,
  updatePoll,
  publishPoll,
  listPolls,
  getPollById,
  vote,
  getResults,
};
