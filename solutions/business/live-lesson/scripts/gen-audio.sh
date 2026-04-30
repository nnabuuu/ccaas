#!/bin/bash
# Generate TTS audio via fish.audio
# Voice: ELITE Nabil EL-Hilaly
# Workflow: PUT /tts-draft (polish text with [emphasis] etc.) → POST /task (TTS)
# Generates 1.0x and 0.9x speed for each text segment

FORCE=0
if [ "${1:-}" = "--force" ] || [ "${1:-}" = "-f" ]; then
  FORCE=1
  echo "*** --force mode: overwriting existing files ***"
fi

API="https://api.fish.audio/task"
DRAFT_API="https://api.fish.audio/tts-draft"
TOKEN="Bearer 35d86f18-4c8a-4e90-a450-ac52753a26e4"
MODEL="d8a1340984ee4b63ad1ffae27a6a4339"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTDIR="$SCRIPT_DIR/../data/lessons/ideal-beauty-reading/audio"
mkdir -p "$OUTDIR"

FAIL=0
SKIP=0
OK=0
POLISH_OK=0
POLISH_FAIL=0

# ── polish: call PUT /tts-draft to add [emphasis] and prosody tags ──
# Uses temp files to avoid shell-escaping issues with complex text.
# Falls back to original text on failure.
polish() {
  local text="$1"
  local tmptext tmpreq tmpresp
  tmptext=$(mktemp)
  tmpreq=$(mktemp)
  tmpresp=$(mktemp)
  printf '%s' "$text" > "$tmptext"

  python3 -c "
import json, sys, uuid
with open(sys.argv[1]) as f: t = f.read()
print(json.dumps({
  'schema_version': 3, 'version': 's2-pro',
  'audio_settings': {
    'latency': 'balanced', 'normalize': True,
    'prosody': {'speed': 0.9, 'volume': 0, 'normalize_loudness': True},
    'sampler': {'temperature': 1, 'top_p': 0.9}
  },
  'segments': [{
    'id': str(uuid.uuid4()),
    'speaker_model_id': sys.argv[2],
    'speaker_title': 'ELITE',
    'text': t
  }]
}))
" "$tmptext" "$MODEL" > "$tmpreq"

  local code
  code=$(curl -s -w '%{http_code}' -X PUT "$DRAFT_API" \
    -H "Authorization: $TOKEN" \
    -H "Content-Type: application/json" \
    -d @"$tmpreq" \
    -o "$tmpresp")

  local result
  if [ "$code" = "200" ] || [ "$code" = "201" ]; then
    result=$(python3 -c "
import json, sys
with open(sys.argv[1]) as f: r = json.loads(f.read())
print(r['segments'][0]['text'], end='')
" "$tmpresp" 2>/dev/null)
    if [ -z "$result" ]; then
      result="$text"
      echo "    WARN polish parse failed, using original" >&2
      POLISH_FAIL=$((POLISH_FAIL + 1))
    else
      POLISH_OK=$((POLISH_OK + 1))
    fi
  else
    result="$text"
    echo "    WARN polish HTTP $code, using original" >&2
    POLISH_FAIL=$((POLISH_FAIL + 1))
  fi

  rm -f "$tmptext" "$tmpreq" "$tmpresp"
  printf '%s' "$result"
}

# ── generate: POST /task to produce MP3 ──
generate() {
  local name="$1"
  local speed="$2"
  local suffix="$3"
  local text="$4"
  local outfile="$OUTDIR/${name}${suffix}.mp3"

  if [ "$FORCE" -eq 0 ] && [ -f "$outfile" ]; then
    local existing_size
    existing_size=$(wc -c < "$outfile" | tr -d ' ')
    if [ "$existing_size" -gt 5000 ]; then
      echo "  SKIP ${name}${suffix}.mp3 (exists, ${existing_size} bytes)"
      SKIP=$((SKIP + 1))
      return 0
    fi
  fi

  echo "  GEN  ${name}${suffix}.mp3 (speed=${speed})..."

  local payload
  payload=$(python3 -c "
import json, sys
print(json.dumps({
    'type': 'tts',
    'stream': False,
    'model': sys.argv[2],
    'prosody': {'speed': float(sys.argv[3]), 'volume': 0, 'normalize_loudness': True},
    'latency': 'balanced',
    'parameters': {
        'text': '<|speaker:0|>' + sys.argv[1],
        'model_id': sys.argv[2],
        'format': 'mp3'
    }
}))" "$text" "$MODEL" "$speed")

  local http_code
  http_code=$(curl -s -w '%{http_code}' -X POST "$API" \
    -H "Authorization: $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$payload" \
    -o "$outfile")

  if [ "$http_code" != "200" ]; then
    echo "  FAIL ${name}${suffix}.mp3 — HTTP $http_code"
    cat "$outfile" 2>/dev/null | head -c 200
    echo ""
    rm -f "$outfile"
    FAIL=$((FAIL + 1))
    return 1
  fi

  local size
  size=$(wc -c < "$outfile" | tr -d ' ')
  if [ "$size" -lt 5000 ]; then
    echo "  WARN ${name}${suffix}.mp3 — only ${size} bytes"
  else
    echo "  OK   ${name}${suffix}.mp3 (${size} bytes)"
  fi
  OK=$((OK + 1))
}

# ── gen_pair: polish once → generate both 1.0x and 0.9x ──
gen_pair() {
  local name="$1"
  local text="$2"

  # Skip entirely if both files exist and are valid (avoids unnecessary polish call)
  if [ "$FORCE" -eq 0 ]; then
    local f1="$OUTDIR/${name}.mp3"
    local f2="$OUTDIR/${name}-slow.mp3"
    if [ -f "$f1" ] && [ -f "$f2" ]; then
      local s1 s2
      s1=$(wc -c < "$f1" | tr -d ' ')
      s2=$(wc -c < "$f2" | tr -d ' ')
      if [ "$s1" -gt 5000 ] && [ "$s2" -gt 5000 ]; then
        echo "  SKIP ${name}.mp3 (exists, ${s1} bytes)"
        echo "  SKIP ${name}-slow.mp3 (exists, ${s2} bytes)"
        SKIP=$((SKIP + 2))
        return 0
      fi
    fi
  fi

  echo "  POLISH ${name}..."
  local polished
  polished=$(polish "$text")
  local preview="${polished:0:80}"
  echo "    → ${preview}..."

  generate "$name" 1.0 "" "$polished"
  generate "$name" 0.9 "-slow" "$polished"
}

# ── extract_manifest: read all TTS texts from manifest.json ──
# Outputs tab-separated lines: name\ttext
# Sources:
#   - article.paragraphs[].id + text        → p1, p2, ...
#   - readingSteps[instruction].studentView.ttsText → step-N-intro
#   - readingSteps[task].summary             → step-N-summary
#   - lessonIntro / lessonSummary            → lesson-intro / lesson-summary
MANIFEST="$SCRIPT_DIR/../data/lessons/ideal-beauty-reading/manifest.json"

extract_manifest() {
  python3 -c "
import json, re, sys

with open(sys.argv[1]) as f:
    m = json.load(f)

def clean_md(s):
    s = re.sub(r'\*+', '', s)
    s = re.sub(r'\n+', ' ', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s

if m.get('lessonIntro'):
    print(f'lesson-intro\t{clean_md(m[\"lessonIntro\"])}')
if m.get('lessonSummary'):
    print(f'lesson-summary\t{clean_md(m[\"lessonSummary\"])}')

for p in m.get('article', {}).get('paragraphs', []):
    print(f'{p[\"id\"]}\t{p[\"text\"]}')

task_num = 0
for s in sorted(m.get('readingSteps', []), key=lambda x: x.get('idx', 0)):
    if s.get('type') == 'instruction':
        sv = s.get('studentView', {})
        tts = sv.get('ttsText', '')
        if tts:
            print(f'step-{task_num + 1}-intro\t{tts}')
    elif s.get('type') == 'task':
        task_num += 1
        summary = s.get('summary', '')
        if summary:
            print(f'step-{task_num}-summary\t{clean_md(summary)}')
" "$MANIFEST"
}

# Count expected files
TOTAL=$(extract_manifest | wc -l | tr -d ' ')
echo "=== Generating ${TOTAL} x 2 = $((TOTAL * 2)) audio files (from manifest) ==="
echo "Output: $OUTDIR"
echo ""

# Generate audio for each manifest entry
while IFS=$'\t' read -r name text; do
  echo "[${name}]"
  gen_pair "$name" "$text"
  echo ""
done < <(extract_manifest)

echo "=== Done. OK=$OK  SKIP=$SKIP  FAIL=$FAIL  POLISH=$POLISH_OK/${POLISH_FAIL}fail ==="
echo ""

# -- Verification --
echo "=== File verification ==="
for f in "$OUTDIR"/*.mp3; do
  name=$(basename "$f")
  size=$(wc -c < "$f" | tr -d ' ')
  printf "  %-30s %8s bytes\n" "$name" "$size"
done
