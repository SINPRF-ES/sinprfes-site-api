import { EMOJI } from './emojis';

export const CONTENT_MODULE = {
  INFORMES: {
    key: 'informes',
    label: 'Informes',
    title: 'Informes',
    emoji: EMOJI.NOTICIAS,
    apiBase: '/api/informes',
    routeName: 'Noticias',
  },
  ANIVERSARIOS: {
    key: 'aniversarios',
    label: 'Aniversários',
    title: 'Aniversários',
    emoji: EMOJI.ANIVERSARIOS,
    apiBase: '/api/aniversarios',
    routeName: 'Aniversarios',
  },
} as const;

export type ContentModuleKey = keyof typeof CONTENT_MODULE;
