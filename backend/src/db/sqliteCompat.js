// Translates PostgreSQL-style SQL to SQLite for local development only.
export function adaptSqlForSqlite(sql) {
  let adapted = sql;

  adapted = adapted.replace(/\$(\d+)/g, '?');
  adapted = adapted.replace(/\bNOW\s*\(\s*\)/gi, 'CURRENT_TIMESTAMP');
  adapted = adapted.replace(/>\s*NOW\s*\(\s*\)\s*-\s*INTERVAL\s+'(\d+)\s+days'/gi, "> datetime('now', '-$1 days')");
  adapted = adapted.replace(
    /SET\s+expires_at\s*=\s*NOW\s*\(\s*\)\s*\+\s*INTERVAL\s+'1\s+hour'/gi,
    "SET expires_at = datetime('now', '+1 hour')"
  );
  adapted = adapted.replace(/::numeric/gi, '');

  return adapted;
}
