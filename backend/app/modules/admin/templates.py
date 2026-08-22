"""Category templates — resolution, validation and normalisation (spec §24, §41).

A mouse is not scored on noise cancellation and does not have a frequency
response. Both facts are properties of the *category*, not of the product, so
the vocabulary lives on `categories.score_criteria` and
`categories.spec_template` and the API refuses anything outside it.

Two rules make that workable across a three-level tree:

  **Inheritance.** An empty array means "ask my parent". Electronics → Audio →
  Headphones lets Headphones state only what makes a headphone different, and
  a category nobody has configured yet still gets something sensible instead of
  nothing. Resolution walks up, never down: a parent must never inherit the
  quirks of one arbitrary child.

  **Closed vocabulary.** Once a category resolves to a non-empty template,
  every key a product submits must appear in it. That is the whole point — an
  open template would let the first product filed under Mice reintroduce
  "Driver" and every mouse after it would copy the mistake.

A category with no template anywhere up its chain stays open. That is the
pre-migration state and the state of a freshly created category, and refusing
all specifications for it would block authoring rather than protect anything.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Any, Iterable, Optional

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Category

# The tree is three levels deep today. The bound is not a limit on the product,
# it is a guarantee that a parent_id cycle that slipped past the database
# trigger cannot spin this loop forever.
MAX_DEPTH = 12

# Ceilings for admin-authored templates. Generous enough that no real category
# hits them, small enough that a JSONB column cannot be used as free storage.
MAX_CRITERIA = 24
MAX_GROUPS = 16
MAX_FIELDS_PER_GROUP = 40
MAX_KEY_LEN = 60
MAX_LABEL_LEN = 80
MAX_VALUE_LEN = 300


@dataclass
class ResolvedTemplate:
    """What a category's products may actually carry.

    `*_source` names the category the template came from — the admin shows
    "inherited from Computers" rather than leaving an editor to wonder why a
    field they never configured is on screen.
    """

    score_criteria: list[dict[str, Any]] = field(default_factory=list)
    spec_template: list[dict[str, Any]] = field(default_factory=list)
    score_source: Optional[str] = None
    spec_source: Optional[str] = None


def _clean(value: Any, limit: int) -> str:
    return str(value).strip()[:limit] if value is not None else ""


# --------------------------------------------------------------------- #
# Resolution                                                             #
# --------------------------------------------------------------------- #


def resolve_from_chain(chain: Iterable[Category]) -> ResolvedTemplate:
    """Resolve against an ancestor chain, nearest category first.

    Each column resolves independently: a category may define its own scoring
    criteria while still inheriting its parent's specification fields, which is
    exactly what Gaming Monitors wants relative to Monitors.
    """
    out = ResolvedTemplate()
    for category in chain:
        if not out.score_criteria and (category.score_criteria or []):
            out.score_criteria = list(category.score_criteria)
            out.score_source = category.name
        if not out.spec_template and (category.spec_template or []):
            out.spec_template = list(category.spec_template)
            out.spec_source = category.name
        if out.score_criteria and out.spec_template:
            break
    return out


def build_chains(categories: Iterable[Category]) -> dict[uuid.UUID, list[Category]]:
    """Ancestor chains for every category, from one already-loaded list.

    `list_categories` reads the whole tree anyway, and resolving 36 categories
    with a query each would be 36 round trips to answer a question the data in
    hand already answers.
    """
    by_id = {c.id: c for c in categories}
    chains: dict[uuid.UUID, list[Category]] = {}

    for category in by_id.values():
        chain: list[Category] = []
        seen: set[uuid.UUID] = set()
        node: Optional[Category] = category
        while node is not None and node.id not in seen and len(chain) < MAX_DEPTH:
            chain.append(node)
            seen.add(node.id)
            node = by_id.get(node.parent_id) if node.parent_id else None
        chains[category.id] = chain

    return chains


async def resolve_for_category(db: AsyncSession, category: Category) -> ResolvedTemplate:
    """Resolve one category, loading ancestors as needed.

    For the single-row paths (create, update, product write) where the tree is
    not already in memory.
    """
    chain: list[Category] = [category]
    seen: set[uuid.UUID] = {category.id}
    parent_id = category.parent_id

    while parent_id and len(chain) < MAX_DEPTH:
        parent = await db.get(Category, parent_id)
        if parent is None or parent.id in seen:
            break
        chain.append(parent)
        seen.add(parent.id)
        parent_id = parent.parent_id

    return resolve_from_chain(chain)


async def resolve_for_product_category(
    db: AsyncSession, category_id: uuid.UUID
) -> ResolvedTemplate:
    category = await db.get(Category, category_id)
    if category is None:
        return ResolvedTemplate()
    return await resolve_for_category(db, category)


# --------------------------------------------------------------------- #
# Template authoring — validation of the template itself                 #
# --------------------------------------------------------------------- #


def _reject(message: str, **extra: Any) -> None:
    raise HTTPException(
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail={"error": "invalid_template", "message": message, **extra},
    )


def normalise_score_criteria(raw: Any) -> list[dict[str, Any]]:
    """Clean and validate admin-authored scoring criteria.

    Normalising on the way in rather than on the way out means the stored JSON
    is already the shape every reader expects — nothing downstream has to
    defend against a criterion with no label or a weight of "heavy".
    """
    if raw is None:
        return []
    if not isinstance(raw, list):
        _reject("Scoring criteria must be a list.")
    if len(raw) > MAX_CRITERIA:
        _reject(f"A category can have at most {MAX_CRITERIA} scoring criteria.")

    out: list[dict[str, Any]] = []
    seen: set[str] = set()

    for entry in raw:
        if not isinstance(entry, dict):
            _reject("Each scoring criterion must be an object.")
        key = _clean(entry.get("key"), MAX_KEY_LEN)
        label = _clean(entry.get("label"), MAX_LABEL_LEN)
        if not key:
            _reject("Every scoring criterion needs a key.")
        if not label:
            _reject(f"Criterion “{key}” needs a label.")
        if key in seen:
            _reject(f"Duplicate criterion key: {key}", duplicate=key)
        seen.add(key)

        item: dict[str, Any] = {"key": key, "label": label}

        weight = entry.get("weight")
        if weight is not None and weight != "":
            try:
                parsed = float(weight)
            except (TypeError, ValueError):
                _reject(f"Weight for “{label}” must be a number.")
            if parsed <= 0 or parsed > 100:
                _reject(f"Weight for “{label}” must be between 0 and 100.")
            item["weight"] = parsed

        out.append(item)

    return out


def normalise_spec_template(raw: Any) -> list[dict[str, Any]]:
    """Clean and validate an admin-authored specification template."""
    if raw is None:
        return []
    if not isinstance(raw, list):
        _reject("The specification template must be a list of groups.")
    if len(raw) > MAX_GROUPS:
        _reject(f"A category can have at most {MAX_GROUPS} specification groups.")

    out: list[dict[str, Any]] = []
    group_keys: set[str] = set()

    for group in raw:
        if not isinstance(group, dict):
            _reject("Each specification group must be an object.")
        group_key = _clean(group.get("key"), MAX_KEY_LEN)
        group_label = _clean(group.get("label"), MAX_LABEL_LEN)
        if not group_key:
            _reject("Every specification group needs a key.")
        if not group_label:
            _reject(f"Group “{group_key}” needs a label.")
        if group_key in group_keys:
            _reject(f"Duplicate group key: {group_key}", duplicate=group_key)
        group_keys.add(group_key)

        raw_fields = group.get("fields") or []
        if not isinstance(raw_fields, list):
            _reject(f"Fields for “{group_label}” must be a list.")
        if len(raw_fields) > MAX_FIELDS_PER_GROUP:
            _reject(
                f"“{group_label}” can have at most {MAX_FIELDS_PER_GROUP} fields."
            )

        fields: list[dict[str, Any]] = []
        # Field keys are unique per group, not globally: "weight" under
        # Physical and "weight" under Capacity are different rows and both
        # read naturally. Qualifying them would only push the group name into
        # every key.
        field_keys: set[str] = set()

        for spec_field in raw_fields:
            if not isinstance(spec_field, dict):
                _reject(f"Each field in “{group_label}” must be an object.")
            key = _clean(spec_field.get("key"), MAX_KEY_LEN)
            label = _clean(spec_field.get("label"), MAX_LABEL_LEN)
            if not key:
                _reject(f"Every field in “{group_label}” needs a key.")
            if not label:
                _reject(f"Field “{key}” needs a label.")
            if key in field_keys:
                _reject(
                    f"Duplicate field key “{key}” in “{group_label}”.",
                    duplicate=f"{group_key}.{key}",
                )
            field_keys.add(key)

            entry: dict[str, Any] = {"key": key, "label": label}
            unit = _clean(spec_field.get("unit"), 20)
            placeholder = _clean(spec_field.get("placeholder"), MAX_VALUE_LEN)
            if unit:
                entry["unit"] = unit
            if placeholder:
                entry["placeholder"] = placeholder
            fields.append(entry)

        out.append({"key": group_key, "label": group_label, "fields": fields})

    return out


# --------------------------------------------------------------------- #
# Product specifications — validation of authored values                 #
# --------------------------------------------------------------------- #


def validate_specifications(
    raw: Any, template: list[dict[str, Any]], category_name: str
) -> list[dict[str, Any]]:
    """Check a product's specifications against its category's template.

    Returns the value to store: normalised, ordered by the template, and with
    blank fields dropped. Ordering here rather than in the frontend means every
    product in a category renders its rows in the same sequence no matter what
    order they were typed in — two mice are comparable at a glance.

    Raises 422 naming the offending keys, mirroring `set_score`, so the admin
    can say which field was refused rather than "could not save".
    """
    if raw is None:
        return []
    if not isinstance(raw, list):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "Specifications must be a list of groups."
        )

    # No template anywhere up the chain: nothing to check against, so accept
    # the legacy free-form shape rather than blocking authoring outright.
    if not template:
        return _passthrough(raw)

    groups_by_key = {g.get("key"): g for g in template if g.get("key")}
    values: dict[str, dict[str, str]] = {}
    unknown: list[str] = []

    for group in raw:
        if not isinstance(group, dict):
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY, "Each specification group must be an object."
            )
        group_key = _clean(group.get("key"), MAX_KEY_LEN)
        template_group = groups_by_key.get(group_key)
        if template_group is None:
            unknown.append(group_key or "(unnamed group)")
            continue

        allowed = {f.get("key") for f in template_group.get("fields") or []}
        bucket = values.setdefault(group_key, {})

        for item in group.get("items") or []:
            if not isinstance(item, dict):
                raise HTTPException(
                    status.HTTP_422_UNPROCESSABLE_ENTITY,
                    f"Each item in “{template_group.get('label')}” must be an object.",
                )
            item_key = _clean(item.get("key"), MAX_KEY_LEN)
            if item_key not in allowed:
                unknown.append(f"{group_key}.{item_key}" if item_key else group_key)
                continue
            value = _clean(item.get("value"), MAX_VALUE_LEN)
            if value:
                bucket[item_key] = value

    if unknown:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "unknown_specifications",
                "message": f"Not specification fields for {category_name}.",
                "unknown": sorted(set(unknown)),
                "allowed": sorted(
                    f"{g.get('key')}.{f.get('key')}"
                    for g in template
                    for f in (g.get("fields") or [])
                ),
            },
        )

    # Rebuild from the template so order is the template's, and drop groups
    # that ended up with nothing in them — an empty "Battery & power" heading
    # on a product page is worse than no heading.
    out: list[dict[str, Any]] = []
    for group in template:
        filled = values.get(group.get("key"), {})
        if not filled:
            continue
        items = [
            {"key": f["key"], "label": f["label"], "value": filled[f["key"]]}
            for f in group.get("fields") or []
            if f.get("key") in filled
        ]
        if items:
            out.append({"key": group["key"], "label": group["label"], "items": items})

    return out


def _passthrough(raw: list[Any]) -> list[dict[str, Any]]:
    """Accept and tidy free-form specifications for an untemplated category."""
    out: list[dict[str, Any]] = []
    for group in raw[:MAX_GROUPS]:
        if not isinstance(group, dict):
            continue
        label = _clean(group.get("label"), MAX_LABEL_LEN)
        if not label:
            continue
        items = []
        for item in (group.get("items") or [])[:MAX_FIELDS_PER_GROUP]:
            if not isinstance(item, dict):
                continue
            item_label = _clean(item.get("label"), MAX_LABEL_LEN)
            value = _clean(item.get("value"), MAX_VALUE_LEN)
            if item_label and value:
                entry = {"label": item_label, "value": value}
                key = _clean(item.get("key"), MAX_KEY_LEN)
                if key:
                    entry["key"] = key
                items.append(entry)
        if items:
            group_out: dict[str, Any] = {"label": label, "items": items}
            key = _clean(group.get("key"), MAX_KEY_LEN)
            if key:
                group_out["key"] = key
            out.append(group_out)
    return out


async def load_category_or_422(db: AsyncSession, category_id: uuid.UUID) -> Category:
    category = await db.get(Category, category_id)
    if category is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown category")
    return category


async def load_all(db: AsyncSession) -> list[Category]:
    return list((await db.execute(select(Category))).scalars().all())
