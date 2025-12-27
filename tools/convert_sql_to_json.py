"""
Simple utility to convert SQL INSERT statements into a JSON array.
Supports statements like:
  INSERT INTO teams (col1, col2, players) VALUES ('a','b','[json]');
It attempts to parse basic VALUES lists and will try to coerce JSON-looking columns.

Usage:
  python tools/convert_sql_to_json.py /path/to/teams_rows.sql teams-local.json

The script is permissive and intended for local developer convenience — inspect output before use.
"""
import sys
import re
import json

INSERT_RE = re.compile(r"INSERT\s+INTO\s+\S+\s*\(([^)]+)\)\s*VALUES\s*(.+);", re.IGNORECASE | re.S)
VALUE_ROW_RE = re.compile(r"\(([^)]+)\)\s*,?", re.S)

def split_values(s):
    # split by commas but respect quotes and parentheses
    vals = []
    cur = ''
    depth = 0
    in_quote = False
    quote_char = None
    i = 0
    while i < len(s):
        ch = s[i]
        if in_quote:
            cur += ch
            if ch == quote_char and s[i-1] != '\\':
                in_quote = False
                quote_char = None
        else:
            if ch in "'\"":
                in_quote = True
                quote_char = ch
                cur += ch
            elif ch == '(':
                depth += 1
                cur += ch
            elif ch == ')':
                depth -= 1
                cur += ch
            elif ch == ',' and depth == 0:
                vals.append(cur.strip())
                cur = ''
            else:
                cur += ch
        i += 1
    if cur.strip() != '':
        vals.append(cur.strip())
    return vals


def unquote(v):
    v = v.strip()
    if (v.startswith("'") and v.endswith("'")) or (v.startswith('"') and v.endswith('"')):
        v2 = v[1:-1]
        v2 = v2.replace("\\'", "'").replace('\\"', '"')
        return v2
    return v


def try_parse_value(v):
    v = v.strip()
    if v.upper() == 'NULL':
        return None
    # JSON-looking
    if (v.startswith('{') and v.endswith('}')) or (v.startswith('[') and v.endswith(']')):
        try:
            return json.loads(v)
        except Exception:
            try:
                # replace single quotes with double and try
                return json.loads(v.replace("'", '"'))
            except Exception:
                return unquote(v)
    if v.startswith("'") and v.endswith("'"):
        return unquote(v)
    # numeric?
    if re.match(r'^-?\d+$', v):
        return int(v)
    if re.match(r'^-?\d+\.\d+$', v):
        return float(v)
    return unquote(v)


def parse_insert_block(block):
    m = INSERT_RE.search(block)
    if not m:
        return []
    cols = [c.strip().strip('"') for c in m.group(1).split(',')]
    vals_blob = m.group(2).strip()
    rows = []
    # find each value row
    for rm in VALUE_ROW_RE.finditer(vals_blob):
        row_text = rm.group(1)
        parts = split_values(row_text)
        if len(parts) != len(cols):
            # try tolerant approach: skip
            continue
        obj = {}
        for c, p in zip(cols, parts):
            obj[c] = try_parse_value(p)
        rows.append(obj)
    return rows


def main():
    if len(sys.argv) < 3:
        print('Usage: python convert_sql_to_json.py input.sql output.json')
        sys.exit(1)
    inp = sys.argv[1]
    out = sys.argv[2]
    text = open(inp, 'r', encoding='utf-8').read()
    inserts = re.split(r";\s*\n", text)
    all_rows = []
    for ins in inserts:
        ins = ins.strip()
        if not ins:
            continue
        rows = parse_insert_block(ins + ';')
        if rows:
            all_rows.extend(rows)
    if not all_rows:
        print('No INSERT rows parsed. Check file format.')
    open(out, 'w', encoding='utf-8').write(json.dumps(all_rows, ensure_ascii=False, indent=2))
    print(f'Wrote {len(all_rows)} rows to {out}')

if __name__ == '__main__':
    main()
