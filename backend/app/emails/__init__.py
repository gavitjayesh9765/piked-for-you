"""Branded email bodies that this API sends itself.

The `.html` beside this module is GENERATED — by `supabase/templates/build.mjs`,
the same script that builds the thirteen Supabase auth templates, from the same
layout and the same palette. Do not hand-edit it; run

    node supabase/templates/build.mjs

and commit the result. `--check` fails the build on drift.

WHY THE FILE LIVES IN THE PYTHON PACKAGE
----------------------------------------
`render.yaml` sets `rootDir: backend`, so the deployed service is this subtree.
Reading `../../supabase/templates/` at runtime would be a bet on the deploy
shipping a sibling directory it otherwise has no use for, and the failure mode
is the worst kind: fine in development, `FileNotFoundError` on the first real
signup. Generating into the package means `pip install .` carries the file —
see the `package-data` entry in pyproject.toml, without which setuptools drops
every non-`.py` file and reintroduces exactly that failure.
"""

from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path

HERE = Path(__file__).resolve().parent

# The subject is NOT in the generated HTML — Supabase keeps subjects in its own
# config keys, so the builder has nowhere to put one for a template it does not
# push. It is duplicated from the `newsletter_confirmation` entry in
# build.mjs; change it in both places.
NEWSLETTER_CONFIRMATION_SUBJECT = "Confirm your SortedChoice newsletter subscription"

# Go template syntax, because the builder's verifier greps for exactly this
# form to enforce the per-template variable whitelist. Keeping the same syntax
# in a template Python renders means one checker covers all fourteen.
_VAR = re.compile(r"\{\{\s*\.([A-Za-z]+)\s*\}\}")


class TemplateError(RuntimeError):
    """A template is missing, or was asked to render an unknown variable."""


@lru_cache
def _load(name: str) -> str:
    path = HERE / f"{name}.html"
    try:
        return path.read_text(encoding="utf8")
    except FileNotFoundError as exc:  # pragma: no cover - packaging failure
        raise TemplateError(
            f"{path} is missing. It is generated: run "
            "`node supabase/templates/build.mjs`. If this is a deployed "
            "instance, the wheel was built without package-data."
        ) from exc


def _escape(value: str) -> str:
    """Escape for both HTML text and a double-quoted attribute.

    Every substitution site in these templates is one or the other — the
    confirm URL appears in an `href="..."` and again as visible fallback text —
    so one escaper has to be safe in both. `&` goes first or it double-escapes
    the entities the later replacements produce.
    """
    return (
        value.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def render(name: str, *, raw: dict[str, str] | None = None, **values: str) -> str:
    """Substitute `{{ .Name }}` placeholders in a generated template.

    Raises rather than leaving a placeholder in place. An unsubstituted
    `{{ .ConfirmURL }}` is not a cosmetic defect: it ships a dead link to a
    real person and the only signal is a subscriber who never confirms.

    ---------------------------------------------------------------------------
    `raw` — AND WHY IT IS A SEPARATE ARGUMENT

    Everything in `**values` is escaped, which is right: they are single fields
    going into text or an attribute. The newsletter digest needs one thing that
    cannot work that way — a repeated block, one row per product, which no fixed
    set of placeholders can express.

    So `raw` exists, and it is deliberately awkward to reach: a distinct
    keyword-only argument rather than a flag on a value, so that passing markup
    through unescaped is always a visible decision at the call site and never
    something a refactor can do by accident. **The caller escapes every
    interpolated field itself** — see `escape` below, which is exported for
    exactly that.

    A name may appear in `values` or in `raw`, never both.
    """
    html = _load(name)
    raw = raw or {}

    both = set(values) & set(raw)
    if both:
        raise TemplateError(f"{name}: {', '.join(sorted(both))} given as both escaped and raw")

    supplied = set(values) | set(raw)
    used = {m.group(1) for m in _VAR.finditer(html)}

    missing = used - supplied
    if missing:
        raise TemplateError(f"{name}: no value given for {', '.join(sorted(missing))}")

    unused = supplied - used
    if unused:
        raise TemplateError(f"{name}: does not use {', '.join(sorted(unused))}")

    def _sub(m: "re.Match[str]") -> str:
        key = m.group(1)
        return raw[key] if key in raw else _escape(values[key])

    return _VAR.sub(_sub, html)


#: Exported so a caller building a `raw` block can escape the fields it
#: interpolates with the same escaper the rest of this module uses.
escape = _escape
