CREATE TABLE invites (
  id             TEXT PRIMARY KEY,          -- код приглашения (в ссылках)
  buyer_username TEXT,                      -- @username покупателя без @, в нижнем регистре (может быть пустым)
  buyer_chat_id  INTEGER,                   -- chat_id покупателя, появляется после /start
  to_name        TEXT NOT NULL,             -- имя девушки
  from_name      TEXT,                      -- от кого
  question       TEXT,                      -- свой текст вопроса (необязательно)
  created_at     INTEGER NOT NULL,
  opened_at      INTEGER,                   -- когда девушка впервые открыла
  answer         TEXT,                      -- JSON: {place, date, time, escapes}
  answered_at    INTEGER,
  answer_count   INTEGER NOT NULL DEFAULT 0,
  delivered_at   INTEGER                    -- когда ответ доставлен покупателю
);

CREATE INDEX invites_created_at ON invites (created_at DESC);
