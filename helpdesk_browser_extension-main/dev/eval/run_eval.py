#!/usr/bin/env python3
"""
Eval harness for the ZSmart Ticket Copilot.

Two modes:

  python run_eval.py           RETRIEVAL ONLY (supporting metric). Runs each
                               golden case through /api/retrieve — semantic
                               search, no LLM, fast and deterministic. Skips
                               `route_only` cases (known pure-retrieval misses
                               that only LLM routing fixes).

  python run_eval.py --route   END-TO-END (the GATING metric). Runs /api/suggest
                               — the real shipping path including the LLM's
                               procedure pick — and checks `matched_section`
                               against every case, including the noisy
                               `route_only` ones. Slow (one LLM call per case).

Metrics (retrieval mode):
  recall@K   fraction of "answerable" cases where an expected section appears
             in the top-K retrieved excerpts
  MRR        mean reciprocal rank of the first expected section
  no-match   fraction of expect_no_match cases that correctly returned nothing

Usage:
  # backend must be running and the KB ingested first
  python run_eval.py [--route] [--base http://localhost:8080]
                     [--golden golden.jsonl] [--min-recall 0.8] [--min-nomatch 0.5]

Exits non-zero below thresholds (CI-gateable). Stdlib only.
"""

import argparse
import json
import os
import sys
import urllib.error
import urllib.request


def load_golden(path):
    cases = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                cases.append(json.loads(line))
    return cases


def _post(base, path, payload, timeout):
    req = urllib.request.Request(
        f"{base.rstrip('/')}{path}",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read())


def retrieve(base, ticket_text):
    return _post(base, "/api/retrieve", {"ticket_text": ticket_text}, 60)


def suggest(base, ticket_text):
    # End-to-end (route mode): runs the LLM selection, so allow a long timeout.
    return _post(base, "/api/suggest", {"ticket_text": ticket_text}, 600)


def section_matches(expected, section):
    section = (section or "").lower()
    return any(w.lower() in section for w in expected)


def first_match_rank(expected, sources):
    """1-based rank of the first source whose section contains any expected
    string (case-insensitive); 0 if none match."""
    wants = [e.lower() for e in expected]
    for i, s in enumerate(sources, 1):
        section = (s.get("section") or "").lower()
        if any(w in section for w in wants):
            return i
    return 0


def run_route_eval(args, answerable, nomatch):
    """End-to-end routing accuracy: did /api/suggest pick the right procedure?"""
    print(f"{'id':22} {'result':8}  chosen procedure")
    print("-" * 70)
    correct = 0
    for c in answerable:
        try:
            d = suggest(args.base, c["ticket_text"])
        except urllib.error.URLError as e:
            sys.exit(f"\nCannot reach backend at {args.base}: {e}")
        ok = section_matches(c["expected_sections"], d.get("matched_section"))
        correct += 1 if ok else 0
        print(f"{c['id']:22} {'PASS' if ok else 'WRONG':8}  {d.get('matched_section') or '(none)'}")

    correct_nm = 0
    for c in nomatch:
        d = suggest(args.base, c["ticket_text"])
        ok = not d.get("matched_section")
        correct_nm += 1 if ok else 0
        print(f"{c['id']:22} {'PASS' if ok else 'FP':8}  {d.get('matched_section') or '(none)'}")

    n = len(answerable)
    acc = correct / n if n else 1.0
    nm = correct_nm / len(nomatch) if nomatch else 1.0
    print("-" * 70)
    print(f"route accuracy : {acc:.2f}  ({correct}/{n})")
    print(f"no-match       : {nm:.2f}  ({correct_nm}/{len(nomatch)})")
    if acc < args.min_recall or nm < args.min_nomatch:
        sys.exit("FAIL")
    print("OK")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--base", default=os.getenv("BASE", "http://localhost:8080"))
    p.add_argument("--golden", default=os.path.join(os.path.dirname(__file__), "golden.jsonl"))
    p.add_argument("--min-recall", type=float, default=0.8)
    p.add_argument("--min-nomatch", type=float, default=0.5)
    p.add_argument("--route", action="store_true",
                   help="end-to-end: check the ROUTED procedure via /api/suggest "
                        "(runs the LLM per case — slower)")
    args = p.parse_args()

    cases = load_golden(args.golden)
    answerable = [c for c in cases if not c.get("expect_no_match")]
    nomatch = [c for c in cases if c.get("expect_no_match")]

    if args.route:
        run_route_eval(args, answerable, nomatch)
        return

    # Recall mode uses pure retrieval (/api/retrieve); skip cases flagged
    # route_only (known pure-retrieval misses that only LLM routing fixes).
    answerable = [c for c in answerable if not c.get("route_only")]

    hits = 0
    rr_sum = 0.0
    print(f"{'id':22} {'result':8} {'rank':>4}  hits")
    print("-" * 50)
    for c in answerable:
        try:
            r = retrieve(args.base, c["ticket_text"])
        except urllib.error.URLError as e:
            sys.exit(f"\nCannot reach backend at {args.base}: {e}\n"
                     "Start it (uvicorn main:app --port 8080) and ingest the KB first.")
        rank = first_match_rank(c["expected_sections"], r.get("sources", []))
        if rank:
            hits += 1
            rr_sum += 1.0 / rank
        verdict = "PASS" if rank else "MISS"
        print(f"{c['id']:22} {verdict:8} {rank if rank else '-':>4}  {r.get('kb_hits', 0)}")

    correct_nomatch = 0
    for c in nomatch:
        r = retrieve(args.base, c["ticket_text"])
        ok = r.get("kb_hits", 0) == 0
        correct_nomatch += 1 if ok else 0
        print(f"{c['id']:22} {'PASS' if ok else 'FP':8} {'-':>4}  {r.get('kb_hits', 0)}")

    n = len(answerable)
    recall = hits / n if n else 1.0
    mrr = rr_sum / n if n else 1.0
    nm_acc = correct_nomatch / len(nomatch) if nomatch else 1.0

    print("-" * 50)
    print(f"recall@K : {recall:.2f}  ({hits}/{n})")
    print(f"MRR      : {mrr:.2f}")
    print(f"no-match : {nm_acc:.2f}  ({correct_nomatch}/{len(nomatch)})")

    failed = []
    if recall < args.min_recall:
        failed.append(f"recall {recall:.2f} < {args.min_recall}")
    if nm_acc < args.min_nomatch:
        failed.append(f"no-match {nm_acc:.2f} < {args.min_nomatch}")
    if failed:
        sys.exit("FAIL: " + "; ".join(failed))
    print("OK")


if __name__ == "__main__":
    main()
