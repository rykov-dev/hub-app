import { type FormEvent, type KeyboardEvent, useCallback, useState } from 'react';
import { Link, NavLink, useNavigate, useParams } from 'react-router';
import { Loader } from '../components/Loader';
import { SectionStub } from '../components/SectionStub';
import { type ChatStatus, useChat } from '../hooks/useChat';
import { useChats } from '../hooks/useChats';
import { useModelAvailable } from '../hooks/useModelAvailable';
import { useAppContext } from '../layouts/AppLayout';
import type { Chat as SavedChat } from '../lib/api';
import { chatConfig } from '../lib/chat/config';
import { formatDateTime } from '../lib/format';

const statusText: Record<ChatStatus, string> = {
  idle: '',
  waiting: 'Модель читает…',
  thinking: 'Думает…',
  answering: '',
};

const ChatList = ({ chats }: { chats: SavedChat[] | undefined }) => (
  <nav className="card area-chats" aria-label="Чаты">
    <div className="world-header">
      <h2>Чаты</h2>
      <Link to="/chat" className="link">
        + Новый
      </Link>
    </div>
    {chats && chats.length > 0 ? (
      <ul className="chat-list">
        {chats.map((chat) => (
          <li key={chat.id}>
            <NavLink to={`/chat/${chat.id}`} className="chat-list-item">
              <span className="chat-list-title">{chat.title}</span>
              <time className="muted small" dateTime={chat.updated_at}>
                {formatDateTime(chat.updated_at)}
              </time>
            </NavLink>
          </li>
        ))}
      </ul>
    ) : (
      <p className="muted small">{chats ? 'Сохранённых чатов пока нет.' : 'Загрузка…'}</p>
    )}
  </nav>
);

const Chat = ({ onModelError }: { onModelError: () => void }) => {
  const { profile } = useAppContext();
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { chats, error: chatsError } = useChats(profile.id);
  const onCreated = useCallback((id: string) => navigate(`/chat/${id}`, { replace: true }), [navigate]);
  const { messages, status, error, send, stop } = useChat(profile.id, chatId, {
    onCreated,
    onModelError,
  });
  const [draft, setDraft] = useState('');
  const busy = status !== 'idle';
  const title = chats?.find((c) => c.id === chatId)?.title ?? 'Новый чат';

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    setDraft('');
    // Nothing was saved (the model failed): the text goes back to the input.
    send(text).then((saved) => {
      if (!saved) setDraft((d) => d || text);
    });
  };

  // Enter sends, Shift+Enter starts a new line.
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) submit(event);
  };

  return (
    <>
      <ChatList chats={chats} />
      <section className="card area-chat chat">
        <h2>{title}</h2>

        {messages.length === 0 ? (
          <p className="muted">Локальная модель {chatConfig.model}. Спроси что-нибудь.</p>
        ) : (
          <ol className="chat-messages">
            {messages.map((message) => (
              <li key={message.id} className={`chat-message chat-${message.role}`}>
                {message.content || <span className="muted">{statusText[status]}</span>}
              </li>
            ))}
          </ol>
        )}
        {(error ?? chatsError) && <p className="error">{error ?? chatsError}</p>}

        <form className="chat-form" onSubmit={submit}>
          <textarea
            className="input textarea-small"
            placeholder="Сообщение"
            maxLength={10000}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            aria-label="Сообщение"
          />
          {busy ? (
            <button type="button" className="btn" onClick={stop}>
              Стоп
            </button>
          ) : (
            <button type="submit" className="btn btn-primary" disabled={!draft.trim()}>
              Отправить
            </button>
          )}
        </form>
      </section>
    </>
  );
};

/** The chat is shown only while its model can be reached; otherwise a placeholder. */
export const ChatPage = () => {
  const { available, recheck } = useModelAvailable();

  if (available === undefined) return <Loader inline />;
  if (!available) {
    return (
      <SectionStub
        title="Чат"
        description="Здесь можно будет поговорить с ассистентом о своих заметках и идеях."
      >
        {chatConfig.enabled && (
          <p className="muted small">
            Модель недоступна. Запусти <code>bun run bonsai</code>, чат появится сам.
          </p>
        )}
      </SectionStub>
    );
  }
  return <Chat onModelError={recheck} />;
};
