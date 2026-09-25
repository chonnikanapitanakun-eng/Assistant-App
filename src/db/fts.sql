-- Universal search index (SQLite FTS5) — ตรงกับ SPEC §4 Universal Search
-- ใช้ trigram tokenizer เพื่อให้ค้นภาษาไทยได้โดยไม่ต้องตัดคำ
CREATE VIRTUAL TABLE IF NOT EXISTS fts_index USING fts5(
  type UNINDEXED,
  id UNINDEXED,
  title,
  body,
  tags,
  tokenize = 'trigram'
);

-- Update triggers drop the old entry and re-index only live rows, so a soft delete
-- (deleted_at set) removes the record from search. Installs created before this change keep
-- their old triggers (CREATE TRIGGER IF NOT EXISTS); search/queries.ts filters deleted rows anyway.

-- tasks
CREATE TRIGGER IF NOT EXISTS tasks_ai AFTER INSERT ON tasks BEGIN
  INSERT INTO fts_index(type, id, title, body, tags) VALUES ('task', new.id, new.title, coalesce(new.notes,''), '');
END;
CREATE TRIGGER IF NOT EXISTS tasks_au AFTER UPDATE ON tasks BEGIN
  DELETE FROM fts_index WHERE type='task' AND id=old.id;
  INSERT INTO fts_index(type, id, title, body, tags) SELECT 'task', new.id, new.title, coalesce(new.notes,''), '' WHERE new.deleted_at IS NULL;
END;
CREATE TRIGGER IF NOT EXISTS tasks_ad AFTER DELETE ON tasks BEGIN
  DELETE FROM fts_index WHERE type='task' AND id=old.id;
END;

-- notes
CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
  INSERT INTO fts_index(type, id, title, body, tags) VALUES ('note', new.id, new.title, new.body, coalesce(new.tags,''));
END;
CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
  DELETE FROM fts_index WHERE type='note' AND id=old.id;
  INSERT INTO fts_index(type, id, title, body, tags) SELECT 'note', new.id, new.title, new.body, coalesce(new.tags,'') WHERE new.deleted_at IS NULL;
END;
CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
  DELETE FROM fts_index WHERE type='note' AND id=old.id;
END;

-- transactions
CREATE TRIGGER IF NOT EXISTS transactions_ai AFTER INSERT ON transactions BEGIN
  INSERT INTO fts_index(type, id, title, body, tags) VALUES ('transaction', new.id, coalesce(new.note,''), cast(new.amount as text), new.type);
END;
CREATE TRIGGER IF NOT EXISTS transactions_au AFTER UPDATE ON transactions BEGIN
  DELETE FROM fts_index WHERE type='transaction' AND id=old.id;
  INSERT INTO fts_index(type, id, title, body, tags) SELECT 'transaction', new.id, coalesce(new.note,''), cast(new.amount as text), new.type WHERE new.deleted_at IS NULL;
END;
CREATE TRIGGER IF NOT EXISTS transactions_ad AFTER DELETE ON transactions BEGIN
  DELETE FROM fts_index WHERE type='transaction' AND id=old.id;
END;

-- contacts
CREATE TRIGGER IF NOT EXISTS contacts_ai AFTER INSERT ON contacts BEGIN
  INSERT INTO fts_index(type, id, title, body, tags) VALUES ('contact', new.id, new.name, coalesce(new.company,'') || ' ' || coalesce(new.notes,''), '');
END;
CREATE TRIGGER IF NOT EXISTS contacts_au AFTER UPDATE ON contacts BEGIN
  DELETE FROM fts_index WHERE type='contact' AND id=old.id;
  INSERT INTO fts_index(type, id, title, body, tags) SELECT 'contact', new.id, new.name, coalesce(new.company,'') || ' ' || coalesce(new.notes,''), '' WHERE new.deleted_at IS NULL;
END;
CREATE TRIGGER IF NOT EXISTS contacts_ad AFTER DELETE ON contacts BEGIN
  DELETE FROM fts_index WHERE type='contact' AND id=old.id;
END;

-- calendar events
CREATE TRIGGER IF NOT EXISTS calendar_events_ai AFTER INSERT ON calendar_events BEGIN
  INSERT INTO fts_index(type, id, title, body, tags) VALUES ('event', new.id, new.title, coalesce(new.location,''), '');
END;
CREATE TRIGGER IF NOT EXISTS calendar_events_au AFTER UPDATE ON calendar_events BEGIN
  DELETE FROM fts_index WHERE type='event' AND id=old.id;
  INSERT INTO fts_index(type, id, title, body, tags) SELECT 'event', new.id, new.title, coalesce(new.location,''), '' WHERE new.deleted_at IS NULL;
END;
CREATE TRIGGER IF NOT EXISTS calendar_events_ad AFTER DELETE ON calendar_events BEGIN
  DELETE FROM fts_index WHERE type='event' AND id=old.id;
END;
