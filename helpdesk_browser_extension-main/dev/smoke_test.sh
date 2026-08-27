#!/usr/bin/env bash
# Backend smoke test — run after `uvicorn main:app --port 8080` is up.
# For a real KB, ingest the guide first:  python ingest.py ../BSS_steps.md
set -e
BASE=${BASE:-http://localhost:8080}

echo "== healthz =="
curl -s $BASE/healthz; echo; echo

echo "== seed one guide chunk into the KB =="
curl -s -X POST $BASE/api/ingest -H 'Content-Type: application/json' -d '{
  "source": "smoke.md",
  "section": "BSS › SIM Card Replacement",
  "content": "BSS › SIM Card Replacement\nSwitch to back-office portal. Authenticate the SIM card. Query the number on order entry, choose SIM replacement, enter the new ICCID, set an order reason and remarks, confirm and process the order."
}'; echo; echo

echo "== retrieve (no LLM) — should return the seeded section, kb_hits >= 1 =="
curl -s -X POST $BASE/api/retrieve -H 'Content-Type: application/json' -d '{
  "ticket_text": "Customer lost SIM, needs a SIM replacement with a new ICCID linked to the number."
}' | python3 -m json.tool

echo "== suggest — matched_section should be the SIM procedure; steps verbatim. =="
echo "== (route mode calls the LLM; slow on a CPU model. fallback:true means  =="
echo "==  the LLM was unreachable and the gated closest match was returned.)  =="
curl -s -X POST $BASE/api/suggest -H 'Content-Type: application/json' -d '{
  "ticket_text": "TICKETNO: TT-2026-004187\nTITLE: SIM replacement\nDESCRIPTION: Customer lost SIM card, requesting replacement, new ICCID to be linked to the existing number.",
  "extra_context": "prepaid line",
  "capture_source": "dev-smoke-test"
}' | python3 -m json.tool
