"""Pydantic types for the Campus Customs chat agent and chat API."""

from typing import Literal

from pydantic import BaseModel, Field


# ---------- What the agent returns ----------


class AgentReply(BaseModel):
    """The agent's structured answer to one shopper message."""

    reply: str = Field(description="The message to show the shopper, in the Campus Customs voice.")
    product_ids: list[str] = Field(
        default_factory=list,
        description=(
            "product_id values of catalogue items this reply recommends or talks about, "
            "copied exactly from tool results. When show_on_page is true, include every "
            "matching product from the search, not just the ones named in `reply`. "
            "Empty if no specific products are mentioned."
        ),
    )
    show_on_page: bool = Field(
        default=False,
        description=(
            "True when the shopper is browsing a type of product (e.g. 'what hoodies do you have?') "
            "and the matches should appear on the Products page as cards. False for a single "
            "item's details, stock checks, store questions, and declines."
        ),
    )


# ---------- What tools return to the agent ----------


LOW_STOCK_THRESHOLD = 5  # at or below this, the agent tells the shopper how many are left

StockStatus = Literal["in_stock", "low_stock", "sold_out"]


class ProductSummary(BaseModel):
    product_id: str
    name: str
    garment_type: str
    price: float
    colors: list[str]
    sizes_in_stock: list[str] = Field(description="Sizes with at least one left, smallest to largest.")


class SearchResults(BaseModel):
    searched_for: str = Field(description="The query actually used, after fixing any misspellings.")
    corrections: dict[str, str] = Field(
        default_factory=dict,
        description="Misspelled words that were corrected, e.g. {'saybrok': 'saybrook'}. Empty if none.",
    )
    total_matches: int = Field(description="How many catalogue items matched, even if not all are listed.")
    products: list[ProductSummary] = Field(description="The matches, cheapest first (up to 40).")


class ProductDetails(ProductSummary):
    description: str
    sizes_sold_out: list[str]


class SizeStock(BaseModel):
    size: str
    status: StockStatus
    quantity_left: int | None = Field(
        default=None,
        description=f"Exact count, given only when {LOW_STOCK_THRESHOLD} or fewer are left (or 0 when sold out).",
    )


class StockCheck(BaseModel):
    """Stock for one product, optionally focused on the size the shopper asked about."""

    product_id: str
    name: str
    price: float
    requested_size: SizeStock | None = Field(
        default=None, description="The size the shopper asked about, if one was given."
    )
    sizes: list[SizeStock] = Field(description="Every size, smallest to largest.")
    sizes_in_stock: list[str]
    sold_out_everywhere: bool


# ---------- Chat API (main.py) ----------


class ProductCard(BaseModel):
    """A product the website can show as a card next to the chat reply."""

    product_id: str
    name: str
    price: float
    image_url: str


class PageContext(BaseModel):
    """Where the shopper is on the website when they send a message."""

    path: str = Field(default="/", max_length=300, description="The page URL path, e.g. /products/basic-hoodie-big-yale.")
    product_id: str | None = Field(
        default=None, max_length=200, description="Set when the shopper is on a single product's page."
    )


class HistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=4000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    page: PageContext | None = None
    history: list[HistoryMessage] = Field(
        default_factory=list,
        max_length=40,
        description="Guests only: this tab's recent messages. Logged-in history is loaded from the database instead.",
    )


class SavedChatMessage(BaseModel):
    """One message from a logged-in shopper's saved history."""

    id: int
    role: Literal["user", "assistant"]
    content: str
    products: list[ProductCard] = Field(default_factory=list)
    created_at: str


# ---------- Agent deps (who is chatting, and where) ----------


class CustomerProfile(BaseModel):
    """The logged-in shopper, from the users table."""

    user_id: int
    first_name: str
    last_name: str
    email: str


class CurrentProduct(BaseModel):
    """The product open on the shopper's screen, looked up in the database."""

    product_id: str
    name: str
    garment_type: str
    price: float
    colors: list[str]


class ChatDeps(BaseModel):
    """Passed to the agent on every run as `ctx.deps`."""

    customer: CustomerProfile | None = Field(default=None, description="None for guests.")
    page_path: str = "/"
    current_product: CurrentProduct | None = None


class ChatResponse(BaseModel):
    reply: str
    products: list[ProductCard] = Field(default_factory=list)
    show_on_page: bool = Field(
        default=False, description="True when `products` should replace the Products page grid."
    )
