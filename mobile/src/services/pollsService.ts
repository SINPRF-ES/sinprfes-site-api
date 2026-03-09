import api from './apiService';

export type PollStatus = 'ACTIVE' | 'CLOSED' | 'DRAFT';

export interface PollSummary {
  id: number;
  title: string;
  type: 'YES_NO' | 'MULTIPLE_CHOICE';
  allow_multiple_answers: boolean;
  allow_other_option: boolean;
  deadline_at: string;
  deadline_date?: string;
  status: PollStatus;
  participants: number;
}

export interface PollOption {
  id: number;
  label: string;
  is_other: boolean;
  votes_count: number;
  voters: Array<{ user_id: number; nome: string; other_text?: string | null }>;
}

export interface PollDetail extends PollSummary {
  options: PollOption[];
  my_votes: Array<{ option_id: number; other_text?: string | null }>;
}

export async function listPolls(status: 'ativas' | 'encerradas' = 'ativas'): Promise<PollSummary[]> {
  const response = await api.get('/api/polls', { params: { status } });
  return response.data?.polls || [];
}

export async function getPollById(id: number): Promise<PollDetail> {
  const response = await api.get(`/api/polls/${id}`);
  return response.data?.poll;
}

export async function votePoll(id: number, payload: { option_ids: number[]; other_texts?: Record<number, string> }) {
  const response = await api.post(`/api/polls/${id}/vote`, payload);
  return response.data;
}

export async function createPoll(payload: {
  title: string;
  type: 'YES_NO' | 'MULTIPLE_CHOICE';
  allow_multiple_answers: boolean;
  allow_other_option: boolean;
  deadline_date: string;
  options: string[];
}) {
  const createResponse = await api.post('/api/polls', payload);
  const poll = createResponse.data?.poll;
  if (poll?.id) {
    await api.post(`/api/polls/${poll.id}/publish`);
  }
  return poll;
}
