"""Tools the Campus Customs agent can call. Every one of them reads
campus_customs.db, so the agent quotes real names, prices, descriptions and
stock instead of guessing."""

import difflib
import json
import re
import sqlite3
import time
from functools import lru_cache

from db import SIZE_ORDER, display_name, get_connection
from models import LOW_STOCK_THRESHOLD, ProductDetails, ProductSummary, SearchResults, SizeStock, StockCheck

MAX_RESULTS = 40
SEARCH_CACHE_SECONDS = 300  # identical searches within 5 minutes reuse the last result

SIZE_ALIASES = {
    "xs": "XS", "extra small": "XS", "x-small": "XS",
    "s": "S", "small": "S",
    "m": "M", "medium": "M", "med": "M",
    "l": "L", "large": "L",
    "xl": "XL", "extra large": "XL", "x-large": "XL",
    "xxl": "XXL", "2xl": "XXL", "xx-large": "XXL", "extra extra large": "XXL",
}


# Color words in a search are matched against the main garment color only.
# Each maps to the color names that count as a match, grouped the same way as
# the Products page color filter ("white" also finds cream and ivory).
COLOR_WORDS = {
    "navy": ("navy",), "blue": ("blue",), "white": ("white", "cream", "ivory"),
    "cream": ("cream",), "ivory": ("ivory",), "gray": ("gray", "charcoal"), "grey": ("gray", "charcoal"),
    "charcoal": ("charcoal",), "heather": ("heather",), "black": ("black",),
    "red": ("red", "coral"), "pink": ("pink", "coral"), "coral": ("coral",),
    "yellow": ("yellow", "gold"), "gold": ("gold",), "green": ("green",),
}

# The first entry in `colors` is the garment's own color; the rest are logo and
# trim colors. These products have no colors in the database, so the main color
# comes from their photos.
MAIN_COLOR_OVERRIDES = {
    "benjamin-franklin-t-shirt": "heather gray",
    "berkeley-sweater-fleece-jacket": "heather gray",
    "timothy-dwight-college-crewneck": "heather gray",
}


def _main_color(row: sqlite3.Row) -> str:
    colors = json.loads(row["colors"])
    return (colors[0] if colors else MAIN_COLOR_OVERRIDES.get(row["product_id"], "")).lower()


def _normalize_size(size: str) -> str | None:
    return SIZE_ALIASES.get(size.strip().lower())


def _inventory(conn: sqlite3.Connection, product_id: str) -> dict[str, int]:
    rows = conn.execute("SELECT size, quantity FROM inventory WHERE product_id = ?", (product_id,)).fetchall()
    stock = {r["size"]: r["quantity"] for r in rows}
    return {s: stock[s] for s in SIZE_ORDER if s in stock}


def _size_stock(size: str, quantity: int) -> SizeStock:
    if quantity <= 0:
        return SizeStock(size=size, status="sold_out", quantity_left=0)
    if quantity <= LOW_STOCK_THRESHOLD:
        return SizeStock(size=size, status="low_stock", quantity_left=quantity)
    return SizeStock(size=size, status="in_stock")


def _summary(row: sqlite3.Row, stock: dict[str, int]) -> ProductSummary:
    return ProductSummary(
        product_id=row["product_id"],
        name=display_name(row["name"]),
        garment_type=row["garment_type"],
        price=row["price"],
        colors=json.loads(row["colors"]),
        sizes_in_stock=[s for s, q in stock.items() if q > 0],
    )


# Filler words that describe "something" rather than a product feature.
STOPWORDS = {
    "the", "and", "for", "with", "any", "some", "stuff", "gear", "item", "items", "merch", "thing",
    "things", "something", "anything", "clothes", "clothing", "apparel", "you", "have", "show", "what",
}

# Common spellings that aren't close enough for automatic correction.
SPELLING_ALIASES = {"hoody": "hoodie", "hoodys": "hoodie", "tee": "shirt", "tees": "shirt", "tshirt": "shirt"}


@lru_cache(maxsize=1)
def _vocabulary() -> tuple[list[str], list[str]]:
    """Words that appear in the catalogue (names, types, tags, colors), and each product's search text."""
    with get_connection() as conn:
        rows = conn.execute("SELECT name, garment_type, description, colors, search_tags FROM catalogue").fetchall()
    vocab: set[str] = set(COLOR_WORDS)
    haystacks = []
    for r in rows:
        vocab.update(re.findall(r"[a-z]{4,}", " ".join([r["name"], r["garment_type"], r["colors"], r["search_tags"]]).lower()))
        haystacks.append(" ".join([r["name"], r["garment_type"], r["description"], r["colors"], r["search_tags"]]).lower())
    return sorted(vocab), haystacks


def _correct_spelling(words: list[str]) -> tuple[list[str], dict[str, str]]:
    """Replace words that match nothing in the catalogue with the closest catalogue word."""
    vocab, haystacks = _vocabulary()
    fixed, corrections = [], {}
    for w in words:
        if w in SPELLING_ALIASES:
            fixed.append(SPELLING_ALIASES[w])
            corrections[w] = SPELLING_ALIASES[w]
            continue
        if w in COLOR_WORDS or w.isdigit() or any(w in h or w.rstrip("s") in h for h in haystacks):
            fixed.append(w)
            continue
        match = difflib.get_close_matches(w, vocab, n=1, cutoff=0.75)
        if match:
            fixed.append(match[0])
            corrections[w] = match[0]
        else:
            fixed.append(w)
    return fixed, corrections


_search_cache: dict[tuple, tuple[float, SearchResults | str]] = {}


def search_products(
    query: str = "", max_price: float | None = None, in_stock_size: str | None = None
) -> SearchResults | str:
    """Search the Campus Customs catalogue for products. Only for finding products:
    never use it for store hours, location, history, or policies, and skip it when the
    shopper already named one specific item (call check_stock or get_product_details directly).

    Matches every word of `query` against each product's name, garment type,
    description, colors and search tags (for example "navy hoodie" or "saybrook").
    Misspelled words are corrected automatically ("hoody" -> "hoodie", "saybrok" ->
    "saybrook"); see `searched_for` and `corrections` in the result.
    Returns how many products matched and up to 40 of them, cheapest first, each
    with its price and the sizes currently in stock.

    Args:
        query: Words describing what the shopper wants. Required unless max_price or in_stock_size is given.
        max_price: Only include products at or below this price in US dollars.
        in_stock_size: Only include products with this size in stock (XS, S, M, L, XL or XXL).
    """
    key = (query.strip().lower(), max_price, (in_stock_size or "").strip().lower())
    cached = _search_cache.get(key)
    if cached and time.monotonic() - cached[0] < SEARCH_CACHE_SECONDS:
        return cached[1]
    result = _search(query, max_price, in_stock_size)
    _search_cache[key] = (time.monotonic(), result)
    return result


def _search(query: str, max_price: float | None, in_stock_size: str | None) -> SearchResults | str:
    size = None
    if in_stock_size:
        size = _normalize_size(in_stock_size)
        if size is None:
            return f"Unknown size '{in_stock_size}'. Sizes are {', '.join(SIZE_ORDER)}."
    words = [w for w in re.findall(r"[a-z0-9]+", query.lower()) if len(w) > 1 and w not in STOPWORDS]
    if not words and max_price is None and size is None:
        return (
            "Give a keyword (like 'hoodie' or 'saybrook'), a max_price, or an in_stock_size. "
            "Don't search the whole catalogue for store questions, greetings, or off-topic messages."
        )
    words, corrections = _correct_spelling(words)
    color_words = [w for w in words if w in COLOR_WORDS]
    if "navy" in color_words:  # "navy blue" means navy, which the catalogue also writes as just "navy"
        color_words = [w for w in color_words if w != "blue"]
    other_words = [w for w in words if w not in COLOR_WORDS]
    results = []
    total = 0
    with get_connection() as conn:
        rows = conn.execute("SELECT * FROM catalogue ORDER BY price, name").fetchall()
        for row in rows:
            if max_price is not None and row["price"] > max_price:
                continue
            # Color words must match the garment's main color, not logo or trim colors.
            main = _main_color(row)
            if not all(any(c in main for c in COLOR_WORDS[w]) for w in color_words):
                continue
            haystack = " ".join(
                [row["name"], row["garment_type"], row["description"], row["colors"], row["search_tags"]]
            ).lower()
            # Allow simple plurals ("hoodies" matches "hoodie").
            if not all(w in haystack or w.rstrip("s") in haystack for w in other_words):
                continue
            stock = _inventory(conn, row["product_id"])
            if size and stock.get(size, 0) <= 0:
                continue
            total += 1
            if len(results) < MAX_RESULTS:
                results.append(_summary(row, stock))
    return SearchResults(
        searched_for=" ".join(words), corrections=corrections, total_matches=total, products=results
    )


def _slug(text: str) -> str:
    return "-".join(re.findall(r"[a-z0-9]+", text.lower()))


def _find_product(conn: sqlite3.Connection, product: str) -> sqlite3.Row | str:
    """Find one product by product_id or by (possibly misspelled) name, so the agent
    can look up a named item directly without a separate search call."""
    row = conn.execute("SELECT * FROM catalogue WHERE product_id = ?", (product,)).fetchone()
    if row:
        return row
    # Shoppers see "Quarter-Zip"; the catalogue says "1 4 Zip".
    slug = re.sub(r"quarter-?zip", "1-4-zip", _slug(product))
    rows = conn.execute("SELECT * FROM catalogue").fetchall()
    by_slug = {_slug(r["name"]): r for r in rows} | {r["product_id"]: r for r in rows}
    if slug in by_slug:
        return by_slug[slug]
    close = difflib.get_close_matches(slug, list(by_slug), n=3, cutoff=0.6)
    if close:
        return by_slug[close[0]]
    return f"No product matching '{product}'. Use search_products to find it."


def get_product_details(product: str) -> ProductDetails | str:
    """Get the full description, price, colors, and which sizes are in stock or sold out for one product.

    Args:
        product: The product's name as the shopper said it (e.g. "Yale Dad Crewneck") or its exact product_id.
    """
    with get_connection() as conn:
        row = _find_product(conn, product)
        if isinstance(row, str):
            return row
        stock = _inventory(conn, row["product_id"])
    return ProductDetails(
        **_summary(row, stock).model_dump(),
        description=row["description"],
        sizes_sold_out=[s for s, q in stock.items() if q <= 0],
    )


def check_stock(product: str, size: str | None = None) -> StockCheck | str:
    """Check live stock for one product, size by size.

    Use this for any "do you have it in M?", "is it in stock?" or "how many are left?"
    question. Each size comes back as in_stock, low_stock (with quantity_left, 5 or
    fewer) or sold_out.

    Args:
        product: The product's name as the shopper said it (e.g. "Basic Hoodie Big Yale") or its exact product_id.
        size: The size the shopper asked about (XS, S, M, L, XL, XXL; words like "medium" work too).
            Leave empty to get every size.
    """
    wanted = None
    if size:
        wanted = _normalize_size(size)
        if wanted is None:
            return f"Unknown size '{size}'. Sizes are {', '.join(SIZE_ORDER)}."
    with get_connection() as conn:
        row = _find_product(conn, product)
        if isinstance(row, str):
            return row
        stock = _inventory(conn, row["product_id"])
    sizes = [_size_stock(s, q) for s, q in stock.items()]
    requested = None
    if wanted:
        requested = next((s for s in sizes if s.size == wanted), None)
        if requested is None:
            return f"{display_name(row['name'])} doesn't come in size {wanted}. Available sizes: {', '.join(stock)}."
    in_stock = [s.size for s in sizes if s.status != "sold_out"]
    return StockCheck(
        product_id=row["product_id"],
        name=display_name(row["name"]),
        price=row["price"],
        requested_size=requested,
        sizes=sizes,
        sizes_in_stock=in_stock,
        sold_out_everywhere=not in_stock,
    )


TOOLS = [search_products, get_product_details, check_stock]
