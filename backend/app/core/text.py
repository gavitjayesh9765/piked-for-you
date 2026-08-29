"""
Search-term handling shared by every `ilike` in the codebase.

The parameter is always bound by SQLAlchemy, so none of this is about SQL
injection — it was never possible here. It is about the two things that are:

  1. **A user's literal `_` or `%` acting as a wildcard.** Searching for
     `wh_1000` should find `WH_1000`, not every five-character string in that
     position. That is a correctness bug, and it is the one
     `modules/search/router.py` already fixed for the public search.

  2. **A pattern built to be expensive.** `%%%%%%%%%%a%%%%%%%%%%` is a legal
     search term and a pathological ILIKE across joined tables. The public
     search escaped it; `products/repository.py` and `admin/curation.py` built
     their patterns with a bare f-string and did not.

One helper, used by all of them, so the next `ilike` added anywhere inherits
the behaviour instead of re-deciding it.

Every call site pairs this with `escape="\\\\"` on the `ilike()` itself — the
escape character is not implied, and without it Postgres reads the backslashes
this function inserts as literal backslashes and the wildcards keep working.
"""

from __future__ import annotations

#: Longest term we will build a pattern from. A search box is capped at the
#: route (`Query(max_length=200)`); this is the backstop for the call sites
#: that take a term from somewhere else.
MAX_TERM_LENGTH = 200


def like_contains(raw: str) -> str:
    """Wrap a term as a `%term%` pattern with LIKE metacharacters escaped.

    The backslash escaping is written as chained `.replace()` calls rather than
    inline in an f-string because a backslash inside an f-string expression is
    a SyntaxError before Python 3.12, and `pyproject.toml` declares
    `requires-python = ">=3.11"`.
    """
    escaped = raw.strip()[:MAX_TERM_LENGTH]
    # The escape character itself goes first, or it double-escapes the
    # backslashes the next two lines introduce.
    escaped = escaped.replace("\\", "\\\\")
    escaped = escaped.replace("%", "\\%")
    escaped = escaped.replace("_", "\\_")
    return f"%{escaped}%"
