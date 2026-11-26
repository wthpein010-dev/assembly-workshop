CREATE TABLE workshop_social_events (
  seq integer PRIMARY KEY AUTOINCREMENT,
  id text NOT NULL UNIQUE,
  type text NOT NULL CHECK(type IN ('message', 'gift')),
  at integer NOT NULL,
  from_id text NOT NULL REFERENCES workshop_accounts(id),
  to_id text REFERENCES workshop_accounts(id),
  request_id text NOT NULL,
  text text,
  gift_id text,
  gift_cost integer,
  featured integer NOT NULL DEFAULT 0 CHECK(featured IN (0, 1)),
  save_rev integer,
  UNIQUE(from_id, request_id),
  CHECK(
    (type = 'message' AND text IS NOT NULL AND length(text) BETWEEN 1 AND 160 AND to_id IS NULL
      AND gift_id IS NULL AND gift_cost IS NULL AND featured = 0 AND save_rev IS NULL)
    OR
    (type = 'gift' AND text IS NULL AND to_id IS NOT NULL AND from_id <> to_id
      AND gift_id IS NOT NULL AND gift_cost IS NOT NULL AND gift_cost > 0 AND save_rev IS NOT NULL AND save_rev > 0)
  )
);
--> statement-breakpoint
CREATE INDEX workshop_social_rate_idx ON workshop_social_events(from_id, type, at);
--> statement-breakpoint
CREATE INDEX workshop_social_feed_idx ON workshop_social_events(at DESC, seq DESC);
--> statement-breakpoint
CREATE INDEX workshop_social_received_idx ON workshop_social_events(to_id, at DESC, seq DESC) WHERE type = 'gift';
--> statement-breakpoint
CREATE INDEX workshop_social_featured_idx ON workshop_social_events(at DESC, seq DESC) WHERE featured = 1;
--> statement-breakpoint
CREATE TRIGGER workshop_social_debit_gift
AFTER INSERT ON workshop_social_events WHEN NEW.type = 'gift'
BEGIN
  UPDATE workshop_accounts
  SET state = json_set(state, '$.coins', json_extract(state, '$.coins') - NEW.gift_cost),
      rev = rev + 1,
      last_seen = max(last_seen, NEW.at)
  WHERE id = NEW.from_id AND rev = NEW.save_rev
    AND json_type(state, '$.coins') = 'integer'
    AND json_extract(state, '$.coins') BETWEEN NEW.gift_cost AND 9007199254740991;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'Social gift debit did not match its save') END;
END;
