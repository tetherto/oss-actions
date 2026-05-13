#!/usr/bin/env bash
# Appends Markdown to stdout from `npm audit --json`: overview counts,
# moderate package rows (capped), then high/critical package rows.
set -euo pipefail
audit_json="${1:-}"
MODERATE_MAX="${2:-40}"
if [[ -z "${audit_json}" || ! -f "${audit_json}" ]]; then
  echo "usage: $0 npm-audit.json [moderate-max-rows]" >&2
  exit 1
fi

jq_overview() {
  jq -r "$(cat <<'JQ'
def via_detail(v):
  [ v.via[]?
    | if type == "object" then
        ( "[" + (.title // .name | gsub("\\|"; "/") ) + "](" + (.url // "") + ")" )
      elif type == "string" then
        "`\(.)`"
      else
        tostring
      end
    ]
  | join(" · ");

(.metadata.vulnerabilities // null) as $meta
| if $meta != null then
    "### npm audit — overview\n\n"
    + "| Severity | Count |\n| :--- | ---: |\n"
    + (["critical","high","moderate","low","info"]
      | map(select($meta[.] != null and $meta[.] > 0))
      | map("| **\(. | ascii_upcase)** | \($meta[.]) |")
      | join("\n"))
    + "\n\n"
  else
    "### npm audit — overview\n\n"
    + "| Severity | Count |\n| :--- | ---: |\n"
    + ((.vulnerabilities // {}) | to_entries
      | map(.value.severity | ascii_downcase)
      | group_by(.)
      | sort_by(.[0])
      | reverse
      | map("| **\(.[0] | ascii_upcase)** | \(length) |")
      | join("\n"))
    + "\n\n"
  end
JQ
)" "$audit_json" 2>/dev/null || printf '%s\n' "### npm audit — overview" "" "_(Could not parse \`npm audit --json\` for this section.)_" ""
}

jq_moderate() {
  jq -r --argjson max "$MODERATE_MAX" "$(cat <<'JQ'
def via_detail(v):
  [ v.via[]?
    | if type == "object" then
        ( "[" + (.title // .name | gsub("\\|"; "/") ) + "](" + (.url // "") + ")" )
      elif type == "string" then
        "`\(.)`"
      else
        tostring
      end
    ]
  | join(" · ");

(.vulnerabilities // {})
| to_entries
| map(select(.value.severity == "moderate"))
| sort_by(.key)
| (. | length) as $total
| if $total == 0 then
    "### npm audit — packages at moderate (0)\n\n_None reported_\n\n"
  else
    (if $total > $max then .[0:$max] else . end) as $rows
    | "### npm audit — packages at moderate (\($total))\n\n"
    + (if $total > $max then
         "> Showing first \($max) of \($total) moderate advisories.\n\n"
       else "" end)
    + "| Package | Severity | Advisors / dependents |\n"
    + "| :--- | :--- | :--- |\n"
    + ([$rows[] |
         "| `\(.key)` | \(.value.severity | ascii_upcase) | \(via_detail(.value) | gsub("\\|"; "¦")) |"
       ] | join("\n"))
    + "\n\n"
  end
JQ
)" "$audit_json" 2>/dev/null || true
}

jq_high_critical() {
  jq -r "$(cat <<'JQ'
def via_detail(v):
  [ v.via[]?
    | if type == "object" then
        ( "[" + (.title // .name | gsub("\\|"; "/") ) + "](" + (.url // "") + ")" )
      elif type == "string" then
        "`\(.)`"
      else
        tostring
      end
    ]
  | join(" · ");

(.vulnerabilities // {})
| to_entries
| map(select(.value.severity == "high" or .value.severity == "critical"))
| sort_by(.key)
| (. | length) as $n
| if $n == 0 then
    "### npm audit — packages at high / critical (0)\n\n_None reported_\n\n"
  else
    "### npm audit — packages at high / critical (\($n))\n\n"
    + "| Package | Severity | Advisors / dependents |\n"
    + "| :--- | :--- | :--- |\n"
    + ([ .[] |
        "| `\(.key)` | \(.value.severity | ascii_upcase) | \(via_detail(.value) | gsub("\\|"; "¦")) |"
      ] | join("\n"))
    + "\n\n"
  end
JQ
)" "$audit_json" 2>/dev/null || true
}

jq_overview
jq_moderate
jq_high_critical
