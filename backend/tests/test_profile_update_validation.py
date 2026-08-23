"""
PATCH /me/profile input validation.

Both fields on this endpoint are written straight to columns with constraints
the endpoint did not know about — `profiles_display_name_len` (2-80) and
`avatar_url varchar(500)`. A value outside either one raised inside the
transaction and reached the caller as a 500, which says "the server is broken"
about a request that was simply wrong.

`avatar_url` carries the sharper edge: it is served to every reader of a review
as the author's avatar, so its contents become a URL in a stranger's browser.
It accepted any string at all. Google sign-in made that reachable a second way,
since the auth trigger now seeds the column from the provider's `picture`
claim, so the same rule is enforced in `handle_new_user()` as well -- these
tests cover the API door.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.modules.auth.router import ProfileUpdate

# --- display_name ----------------------------------------------------------


def test_display_name_is_trimmed() -> None:
    assert ProfileUpdate(display_name="  Jayesh Gavit  ").display_name == "Jayesh Gavit"


@pytest.mark.parametrize(
    "name",
    [
        "",  # empty
        "   ",  # whitespace only, which trims to empty
        "j",  # one character, below the CHECK's floor
        "A" * 81,  # one past the ceiling
    ],
)
def test_display_name_outside_the_check_constraint_is_rejected(name: str) -> None:
    with pytest.raises(ValidationError):
        ProfileUpdate(display_name=name)


@pytest.mark.parametrize("name", ["jo", "A" * 80, "Jayesh Gavit"])
def test_display_name_inside_the_check_constraint_is_accepted(name: str) -> None:
    assert ProfileUpdate(display_name=name).display_name == name


# --- avatar_url ------------------------------------------------------------


@pytest.mark.parametrize(
    "url",
    [
        # Script execution dressed as an image source.
        "javascript:alert(1)",
        "JavaScript:alert(1)",
        # A whole document, inline, from a field the UI treats as a picture.
        "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
        # Passive downgrade / mixed-content block in production.
        "http://example.com/a.png",
        # Not a URL at all.
        "//example.com/a.png",
        "example.com/a.png",
        # Longer than the column, which was its own 500.
        "https://example.com/" + "a" * 500,
        # Leading whitespace is stripped by URL parsers before the scheme is
        # read, so " javascript:" must not be allowed to smuggle itself past a
        # prefix test by arriving pre-trimmed into something else.
        "\tjavascript:alert(1)",
    ],
)
def test_unsafe_avatar_url_is_rejected(url: str) -> None:
    with pytest.raises(ValidationError):
        ProfileUpdate(avatar_url=url)


def test_https_avatar_url_is_accepted() -> None:
    url = "https://lh3.googleusercontent.com/a/ACg8ocK=s96-c"
    assert ProfileUpdate(avatar_url=url).avatar_url == url


def test_empty_avatar_url_clears_the_field() -> None:
    """An empty string means "remove my avatar", not "reject this request"."""
    assert ProfileUpdate(avatar_url="   ").avatar_url is None


def test_omitted_fields_stay_none_so_a_partial_patch_is_partial() -> None:
    payload = ProfileUpdate(display_name="Jayesh Gavit")
    assert payload.avatar_url is None


def test_unknown_fields_are_still_forbidden() -> None:
    """The `extra="forbid"` guard predates these validators; keep it proven.

    This is what stops a crafted payload carrying `role` or `is_active` from
    riding along into a model that only means to accept two display fields.
    """
    with pytest.raises(ValidationError):
        ProfileUpdate(display_name="Jayesh Gavit", role="admin")  # type: ignore[call-arg]
