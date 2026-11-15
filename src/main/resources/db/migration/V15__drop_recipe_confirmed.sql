-- There are no confirmed recipes: only foods are checked against an official source. The column
-- was never set by anybody.
ALTER TABLE recipe DROP COLUMN is_confirmed;
