-- Магазины (у каждого свой вход и брендинг)
CREATE TABLE shops (
  id            TEXT PRIMARY KEY,
  login         TEXT NOT NULL UNIQUE,      -- логин для входа (латиница)
  password_hash TEXT NOT NULL,             -- pbkdf2$итерации$соль$хэш
  name          TEXT NOT NULL,             -- название, видно девушке и покупателю
  color         TEXT,                      -- фирменный цвет #rrggbb
  logo          TEXT,                      -- логотип (data:image/... до ~150 КБ)
  website       TEXT,                      -- сайт / Instagram / WhatsApp магазина
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    INTEGER NOT NULL
);

-- Сессии входа в админку. shop_id = NULL — супер-админ
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  shop_id    TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

-- Защита от подбора пароля
CREATE TABLE login_attempts (
  login        TEXT PRIMARY KEY,
  fails        INTEGER NOT NULL,
  window_start INTEGER NOT NULL
);

-- Приглашения принадлежат магазину (старые — без магазина)
ALTER TABLE invites ADD COLUMN shop_id TEXT;
CREATE INDEX invites_shop ON invites (shop_id, created_at DESC);
