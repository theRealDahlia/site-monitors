// Reading one line of the "Import from a list" box. Kept free of server code so it can be tested on its own; the
// import route hands what it returns to parseMonitorRequest, which does the real validation for each kind.
//
// A line is `kind, target, client, extra, extra`, except a page, which puts its keyword before the client. The kind is
// required, and every field after the target is optional:
//   site, example.com, Northwind
//   page, https://example.com/checkout, Order confirmed, C, Northwind   C = contains (the default), A = absent
//   port, mail.example.com:25, Northwind
//   heartbeat, Nightly backup, Northwind, 1d, 1h    how often it runs, then how late a check-in may be

export type ImportKind = "site" | "http" | "tcp" | "heartbeat";

export interface ImportLine {
  kind: ImportKind;
  clientName: string | null;
  /** What parseMonitorRequest(kind, body) reads. */
  body: Record<string, unknown>;
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const KIND_WORDS: Record<string, ImportKind> = {
  site: "site",
  website: "site",
  page: "http",
  http: "http",
  port: "tcp",
  tcp: "tcp",
  heartbeat: "heartbeat",
  cron: "heartbeat",
};

// The words a header row is made of, such as "type,target,client" or the older "domain,client".
const HEADER_WORDS = new Set([
  ...Object.keys(KIND_WORDS),
  "host", "hostname", "domain", "url", "address", "type", "kind", "target", "name", "client", "customer",
  "keyword", "mode", "rule", "every", "interval", "schedule", "grace", "late", "port", "extra", "extras", "options",
]);

/** Splits a line on tabs, or on commas that aren't inside double quotes, so a page address can contain commas. */
export function splitFields(line: string): string[] {
  if (line.includes("\t")) return line.split("\t").map((f) => unquote(f.trim()));
  const fields: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      fields.push(current.trim());
      current = "";
    } else current += c;
  }
  fields.push(current.trim());
  return fields;
}

const unquote = (f: string) => (f.length >= 2 && f.startsWith('"') && f.endsWith('"') ? f.slice(1, -1).replace(/""/g, '"') : f);

/** True for a first line that only names the columns. "site,example.com" is a monitor, not a header. */
export function isHeaderRow(line: string): boolean {
  const fields = splitFields(line).filter(Boolean);
  return fields.length > 0 && fields.every((f) => HEADER_WORDS.has(f.toLowerCase()));
}

/** "15m", "6 hours", "1d" to milliseconds, or null when it isn't a duration. */
export function parseDuration(text: string): number | null {
  const m = text.trim().match(/^(\d+(?:\.\d+)?)\s*(m|mins?|minutes?|h|hrs?|hours?|d|days?)$/i);
  if (!m) return null;
  const unit = m[2][0].toLowerCase();
  return Math.round(Number(m[1]) * (unit === "m" ? MIN : unit === "h" ? HOUR : DAY));
}

// What each kind's line holds after its type, in order. Shown as faint hints while someone types a line.
const FIELD_HINTS: Record<ImportKind, string[]> = {
  site: ["example.com", "Client"],
  http: ["https://example.com/pricing", "keyword", "C or A", "Client"],
  tcp: ["mail.example.com:25", "Client"],
  heartbeat: ["Nightly backup", "Client", "1d (how often)", "1h (how late)"],
};

/**
 * The faint text to show after a line someone is typing: the fields of its kind that they haven't filled yet, with the
 * separator they still need to type. "port" gives ", mail.example.com:25, Client"; "port, my.site.com" gives ", Client".
 * Empty when the line doesn't start with a type, is tab-separated, is inside a quote, or has every field.
 */
export function importHint(line: string): string {
  if (line.includes("\t") || (line.match(/"/g)?.length ?? 0) % 2) return "";
  const fields = splitFields(line);
  const kind = KIND_WORDS[fields[0].toLowerCase()];
  if (!kind) return "";
  const hints = FIELD_HINTS[kind];
  if (fields.length === 1) return `, ${hints.join(", ")}`;
  const current = fields[fields.length - 1];
  // The field being typed is already taken. An empty one (after a comma) still needs filling.
  const left = hints.slice(current ? fields.length - 1 : fields.length - 2);
  if (left.length === 0) return "";
  const separator = current ? ", " : line.endsWith(" ") ? "" : " ";
  return separator + left.join(", ");
}

/** True when `a` and `b` differ by at most one inserted, missing or changed letter, or by two letters that swapped places. */
function withinOneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    const diff: number[] = [];
    for (let k = 0; k < a.length && diff.length <= 2; k++) if (a[k] !== b[k]) diff.push(k);
    if (diff.length === 2 && a[diff[0]] === b[diff[1]] && a[diff[1]] === b[diff[0]]) return true;
  }
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
  const [long, short] = a.length > b.length ? [a, b] : [b, a];
  return long.slice(i + 1) === short.slice(i);
}

/**
 * A page's keyword rule: blank, C or "contains" is contains; A or "absent" is absent. A word one typo off counts too,
 * as long as it still starts with the right letter. Anything else is null.
 */
export function readKeywordRule(text: string): "contains" | "absent" | null {
  const t = text.trim().toLowerCase();
  if (t === "" || t === "c" || (t[0] === "c" && withinOneEdit(t, "contains"))) return "contains";
  if (t === "a" || (t[0] === "a" && withinOneEdit(t, "absent"))) return "absent";
  return null;
}

export function readImportLine(line: string): ImportLine | { error: string } {
  const fields = splitFields(line);
  const kind = KIND_WORDS[fields[0]?.toLowerCase() ?? ""];
  if (!kind) return { error: "Start the line with site, page, port or heartbeat, like site, example.com." };
  const rest = fields.slice(1);
  const target = rest[0] ?? "";
  const clientName = rest[1] || null;
  const extra = rest.slice(2);

  switch (kind) {
    case "http": {
      // A page puts its keyword first: `page, address, keyword, rule, client`. The rule is blank or C (the default)
      // when the page must contain the keyword, A when it must not.
      const [keyword = "", rule = "", client = ""] = rest.slice(1);
      const mode = readKeywordRule(rule);
      if (!mode) return { error: "Write the keyword rule as C (contains) or A (absent)." };
      return { kind: "http", clientName: client || null, body: { url: target, keyword, keywordMode: mode } };
    }
    case "tcp": {
      const m = target.match(/^(.+):(\d{1,5})$/);
      if (!m) return { error: "Add the port after the server, like mail.example.com:25." };
      return { kind: "tcp", clientName, body: { host: m[1], port: Number(m[2]) } };
    }
    case "heartbeat": {
      const every = extra[0] ? parseDuration(extra[0]) : DAY;
      const grace = extra[1] ? parseDuration(extra[1]) : HOUR;
      if (every === null || grace === null) return { error: "Write the schedule as a time like 15m, 6h or 1d." };
      return { kind: "heartbeat", clientName, body: { name: target, everyMs: every, graceMs: grace } };
    }
    default:
      return { kind: "site", clientName, body: { host: target } };
  }
}
