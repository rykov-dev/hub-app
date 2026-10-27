const dateTimeFormat = new Intl.DateTimeFormat('ru', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});

export const formatDateTime = (iso: string) => dateTimeFormat.format(new Date(iso));
