/** The hub's main sections: shown as tabs in the top bar and as tiles on the home page. */
export type Section = {
  to: string;
  label: string;
  description: string;
};

export const sections: Section[] = [
  {
    to: '/knowledge',
    label: 'База знаний',
    description: 'Заметки и мысли, собранные в одном месте',
  },
  { to: '/chat', label: 'Чат', description: 'Разговор с ассистентом о своих заметках' },
  { to: '/game', label: 'Игра', description: 'Мир, где тратятся монетки' },
  { to: '/links', label: 'Связи', description: 'Редактор связей между заметками и идеями' },
];
