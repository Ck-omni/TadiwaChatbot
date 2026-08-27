"""Unit tests for the pure, correctness-critical functions. No DB or LLM needed.

Run from backend/:  python -m pytest tests -q
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ingest import parse_markdown, _body_is_real
from main import scrub, _parse_choice, _extract_chunk_text


# ---- scrub (PII redaction) --------------------------------------------------

def test_scrub_email():
    assert scrub("mail t.ncube@example.com now") == "mail [EMAIL] now"


def test_scrub_phone():
    assert "[PHONE]" in scrub("call +263 77 123 4567 today")


def test_scrub_long_digits():
    assert scrub("ICCID 8926301234567890123") == "ICCID [NUMBER]"


def test_scrub_leaves_short_numbers():
    assert scrub("step 3 of 10 on port 8080") == "step 3 of 10 on port 8080"


# ---- parse_markdown (hierarchy-aware chunker) -------------------------------

FIXTURE_MD = """# Category A
Category intro line.

## Simple Procedure
1. Do the thing.
2. Confirm the thing.

## Parent With Variants
Shared preamble that children must inherit.

### Variant One
1. Step for variant one.

### Variant Two
1. Step for variant two.

## Empty Placeholder
*(No steps were provided for this section in the source document.)*
"""


def _chunks():
    return parse_markdown(FIXTURE_MD)


def test_leaf_count():
    # Simple Procedure, Variant One, Variant Two, Empty Placeholder = 4 leaves
    assert len(_chunks()) == 4


def test_heading_paths():
    paths = [" › ".join(c["path"]) for c in _chunks()]
    assert "Category A › Simple Procedure" in paths
    assert "Category A › Parent With Variants › Variant One" in paths
    assert "Category A › Parent With Variants › Variant Two" in paths


def test_variant_leaves_inherit_parent_preamble():
    by_path = {" › ".join(c["path"]): c for c in _chunks()}
    v1 = by_path["Category A › Parent With Variants › Variant One"]
    assert "Shared preamble" in v1["body"]
    assert "Step for variant one" in v1["body"]
    # sibling's steps must NOT leak in
    assert "variant two" not in v1["body"].lower()


def test_parent_with_children_is_not_a_leaf():
    paths = [" › ".join(c["path"]) for c in _chunks()]
    assert "Category A › Parent With Variants" not in paths


def test_placeholder_body_is_not_real():
    by_path = {" › ".join(c["path"]): c for c in _chunks()}
    assert not _body_is_real(by_path["Category A › Empty Placeholder"]["body"])
    assert _body_is_real(by_path["Category A › Simple Procedure"]["body"])


def test_body_is_real_rejects_tiny_bodies():
    assert not _body_is_real("ok")
    assert not _body_is_real("   \n---\n   ")


# ---- _parse_choice (LLM routing reply parser) -------------------------------

def test_parse_choice_number_dash_reason():
    assert _parse_choice("2 - customer wants a replacement", 5) == (
        2, "customer wants a replacement")


def test_parse_choice_bare_number():
    assert _parse_choice("2", 5) == (2, "")


def test_parse_choice_number_with_period():
    choice, _ = _parse_choice("2.", 5)
    assert choice == 2


def test_parse_choice_reason_before_number():
    choice, reason = _parse_choice("The best match is 2 because of the SIM", 5)
    assert choice == 2
    assert "because of the SIM" in reason


def test_parse_choice_zero_none_apply():
    assert _parse_choice("0 - none of these apply", 5)[0] == 0


def test_parse_choice_out_of_range_clamps_to_zero():
    assert _parse_choice("7 - out of range", 5)[0] == 0


def test_parse_choice_no_number_at_all():
    choice, _ = _parse_choice("I cannot decide, sorry.", 5)
    assert choice == 0


def test_parse_choice_em_dash_separator():
    choice, reason = _parse_choice("3 — hanging order", 5)
    assert choice == 3
    assert reason == "hanging order"


# ---- _extract_chunk_text (LLM stream chunk parser) --------------------------

def test_extract_openai_delta():
    raw = '{"choices":[{"delta":{"content":"Hel"}}]}'
    assert _extract_chunk_text(raw) == "Hel"


def test_extract_openai_message():
    raw = '{"choices":[{"message":{"content":"full answer"}}]}'
    assert _extract_chunk_text(raw) == "full answer"


def test_extract_custom_token():
    assert _extract_chunk_text('{"token": " Hello"}') == " Hello"


def test_extract_plain_text_chunk():
    assert _extract_chunk_text("just plain text") == "just plain text"


def test_extract_bare_json_string():
    assert _extract_chunk_text('"quoted chunk"') == "quoted chunk"


def test_extract_done_marker_and_empty():
    assert _extract_chunk_text("[DONE]") == ""
    assert _extract_chunk_text("   ") == ""


def test_extract_unrecognised_json_object():
    assert _extract_chunk_text('{"usage": {"tokens": 5}}') == ""
