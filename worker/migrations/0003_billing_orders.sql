-- Тарифы и подписка (оплата пока вручную)
ALTER TABLE shops ADD COLUMN plan TEXT NOT NULL DEFAULT 'trial';
ALTER TABLE shops ADD COLUMN paid_until INTEGER;            -- до какого момента доступ (мс)
-- Куда ведёт кнопка «Заказать букет»: "wa:77011234567" (WhatsApp) или https://...
ALTER TABLE shops ADD COLUMN order_link TEXT;
-- Код для подключения Telegram-уведомлений магазина (/start s_<код>)
ALTER TABLE shops ADD COLUMN tg_code TEXT;

-- Уже существующим магазинам — пробный период 14 дней с сегодняшнего дня
UPDATE shops SET paid_until = (CAST(strftime('%s', 'now') AS INTEGER) + 14 * 86400) * 1000 WHERE paid_until IS NULL;

-- Telegram-чаты сотрудников магазина для уведомлений
CREATE TABLE shop_chats (
  shop_id    TEXT NOT NULL,
  chat_id    INTEGER NOT NULL,
  name       TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (shop_id, chat_id)
);

-- Журнал оплат (вносит супер-админ)
CREATE TABLE payments (
  id         TEXT PRIMARY KEY,
  shop_id    TEXT NOT NULL,
  plan       TEXT NOT NULL,
  months     INTEGER NOT NULL,
  amount     INTEGER,                 -- сумма в тенге
  note       TEXT,
  paid_until INTEGER NOT NULL,        -- новая дата окончания после этой оплаты
  created_at INTEGER NOT NULL
);
CREATE INDEX payments_created ON payments (created_at DESC);

-- Настройки сервиса (реквизиты для оплаты, контакт поддержки)
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- Переходы покупателя к заказу букета
ALTER TABLE invites ADD COLUMN order_clicks INTEGER NOT NULL DEFAULT 0;
ALTER TABLE invites ADD COLUMN order_clicked_at INTEGER;
