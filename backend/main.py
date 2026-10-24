"""Campus Customs API.

Serves the product catalogue, inventory, and product images from
data/campus_customs.db, handles sign-up and login, and answers chat
messages with the PydanticAI agent in agent.py.

Run from the backend folder:
    uvicorn main:app --reload --port 8000
"""

import json
import logging
import re
import secrets
import sqlite3
from datetime import date

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator

from db import DATA_DIR, PROJECT_DIR, SIZE_ORDER, display_name, get_connection, image_url

# Homework 4/.env first; the class folder's .env (one level up) fills in anything missing.
load_dotenv(PROJECT_DIR / ".env")
load_dotenv(PROJECT_DIR.parent / ".env")

import audit  # noqa: E402
import auth  # noqa: E402  (reads SESSION_SECRET, so load .env first)
from agent import AgentConfigError, run_agent  # noqa: E402
from models import (  # noqa: E402
    ChatDeps,
    ChatRequest,
    ChatResponse,
    CurrentProduct,
    CustomerProfile,
    HistoryMessage,
    ProductCard,
    SavedChatMessage,
)

logger = logging.getLogger("campus_customs")

app = FastAPI(title="Campus Customs API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Product photos live at data/products/*.jpg; image_file_path is relative to data/.
app.mount("/media", StaticFiles(directory=DATA_DIR / "products"), name="media")


def product_from_row(row: sqlite3.Row) -> dict:
    return {
        "product_id": row["product_id"],
        "name": row["name"],
        "garment_type": row["garment_type"],
        "description": row["description"],
        "colors": json.loads(row["colors"]),
        "search_tags": json.loads(row["search_tags"]),
        "image_url": image_url(row["image_file_path"]),
        "price": row["price"],
    }


def inventory_for(conn: sqlite3.Connection, product_id: str) -> list[dict]:
    rows = conn.execute(
        "SELECT size, quantity FROM inventory WHERE product_id = ?", (product_id,)
    ).fetchall()
    sizes = [{"size": r["size"], "quantity": r["quantity"]} for r in rows]
    return sorted(
        sizes,
        key=lambda s: SIZE_ORDER.index(s["size"]) if s["size"] in SIZE_ORDER else 99,
    )


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/products")
def list_products() -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute("SELECT * FROM catalogue ORDER BY name").fetchall()
        products = []
        for row in rows:
            inventory = inventory_for(conn, row["product_id"])
            products.append(
                {
                    **product_from_row(row),
                    "inventory": inventory,
                    "total_stock": sum(s["quantity"] for s in inventory),
                }
            )
    return products


@app.get("/api/products/{product_id}")
def get_product(product_id: str) -> dict:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM catalogue WHERE product_id = ?", (product_id,)
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Product not found")
        inventory = inventory_for(conn, product_id)
    return {
        **product_from_row(row),
        "inventory": inventory,
        "total_stock": sum(s["quantity"] for s in inventory),
    }


# ---------- "You may also like" ----------

CATEGORY_RULES = [
    ("quarter-zip", "quarter-zip"),
    ("hood", "hoodie"),
    ("jacket", "jacket"),
    ("fleece", "jacket"),
    ("t-shirt", "t-shirt"),
    ("long-sleeve", "long-sleeve"),
    ("crewneck", "crewneck"),
    ("mockneck", "crewneck"),
    ("sweatshirt", "crewneck"),
]
# Tags shared by almost everything ("Yale", "Campus Customs") say nothing about similarity.
GENERIC_TAGS = {"yale", "campus customs", "college apparel", "college merch", "yale merch", "long sleeve"}
SIMILAR_LIMIT = 4


def _category(garment_type: str) -> str:
    g = garment_type.lower()
    return next((cat for key, cat in CATEGORY_RULES if key in g), "other")


def _tags(row: sqlite3.Row) -> set[str]:
    return {t.lower() for t in json.loads(row["search_tags"])} - GENERIC_TAGS


def _main_color_of(row: sqlite3.Row) -> str:
    colors = json.loads(row["colors"])
    return colors[0].lower() if colors else ""


@app.get("/api/products/{product_id}/similar")
def similar_products(product_id: str) -> list[dict]:
    """Up to 4 in-stock products most like this one: same kind of garment, shared
    school/sport/family tags, same main color, similar price."""
    with get_connection() as conn:
        base = conn.execute("SELECT * FROM catalogue WHERE product_id = ?", (product_id,)).fetchone()
        if base is None:
            raise HTTPException(status_code=404, detail="Product not found")
        in_stock = {
            r["product_id"]
            for r in conn.execute("SELECT product_id FROM inventory GROUP BY product_id HAVING SUM(quantity) > 0")
        }
        rows = conn.execute("SELECT * FROM catalogue WHERE product_id != ?", (product_id,)).fetchall()
    base_cat, base_tags, base_color = _category(base["garment_type"]), _tags(base), _main_color_of(base)
    scored = []
    for r in rows:
        if r["product_id"] not in in_stock:
            continue
        score = 3 * (_category(r["garment_type"]) == base_cat)
        score += 2 * len(base_tags & _tags(r))
        score += 1 * (bool(base_color) and _main_color_of(r) == base_color)
        score += 1 * (abs(r["price"] - base["price"]) <= 10)
        scored.append((score, r["name"], r))
    scored.sort(key=lambda t: (-t[0], t[1]))
    return [product_from_row(r) for _, _, r in scored[:SIMILAR_LIMIT]]


# ---------- Demo checkout (no payment, inventory unchanged) ----------


class DemoOrderItem(BaseModel):
    product_id: str = Field(max_length=200)
    size: str = Field(max_length=5)
    quantity: int = Field(ge=1, le=10)


class DemoOrderRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: str = Field(max_length=254)
    delivery: str = Field(pattern="^(pickup|shipping)$")
    items: list[DemoOrderItem] = Field(min_length=1, max_length=50)

    @field_validator("email")
    @classmethod
    def check_email(cls, v: str) -> str:
        return _clean_email(v)


@app.post("/api/orders/demo")
def place_demo_order(body: DemoOrderRequest) -> dict:
    """Check the cart against live stock and prices and return a confirmation.
    This is a demo: no payment is taken, nothing is saved, and inventory is NOT changed."""
    lines, problems = [], []
    with get_connection() as conn:
        for item in body.items:
            row = conn.execute("SELECT * FROM catalogue WHERE product_id = ?", (item.product_id,)).fetchone()
            if row is None:
                problems.append(f"{item.product_id} is no longer available.")
                continue
            stock = conn.execute(
                "SELECT quantity FROM inventory WHERE product_id = ? AND size = ?", (item.product_id, item.size)
            ).fetchone()
            available = stock["quantity"] if stock else 0
            if item.quantity > available:
                problems.append(
                    f"{row['name']} in {item.size}: only {available} left." if available else f"{row['name']} is sold out in {item.size}."
                )
                continue
            lines.append({"name": row["name"], "size": item.size, "quantity": item.quantity, "price": row["price"]})
    if problems:
        raise HTTPException(status_code=409, detail=" ".join(problems))
    subtotal = round(sum(line["price"] * line["quantity"] for line in lines), 2)
    return {
        "order_number": "DEMO-" + secrets.token_hex(3).upper(),
        "name": body.name.strip(),
        "delivery": body.delivery,
        "items": lines,
        "subtotal": subtotal,
        "note": "Demo store: no payment was taken and inventory was not changed.",
    }


# ---------- Accounts ----------

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _clean_email(value: str) -> str:
    value = value.strip().lower()
    if not EMAIL_RE.match(value):
        raise ValueError("Enter a valid email address.")
    return value


class SignupRequest(BaseModel):
    first_name: str = Field(min_length=1, max_length=50)
    last_name: str = Field(min_length=1, max_length=50)
    email: str = Field(max_length=254)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("first_name", "last_name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("This field is required.")
        return v

    @field_validator("email")
    @classmethod
    def check_email(cls, v: str) -> str:
        return _clean_email(v)


class LoginRequest(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()


class User(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: str


class AuthResponse(BaseModel):
    token: str
    user: User


def user_from_row(row: sqlite3.Row) -> User:
    # Older rows may only have `name`; fall back to splitting it.
    first, _, last = (row["name"] or "").partition(" ")
    return User(
        id=row["id"],
        first_name=row["first_name"] or first,
        last_name=row["last_name"] or last,
        email=row["email"],
    )


def optional_user(authorization: str | None = Header(default=None)) -> User | None:
    """Dependency: the signed-in user from an 'Authorization: Bearer <token>' header, or None for guests."""
    token = authorization.removeprefix("Bearer ").strip() if authorization else ""
    user_id = auth.read_token(token) if token else None
    if user_id is None:
        return None
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return user_from_row(row) if row else None


def current_user(user: User | None = Depends(optional_user)) -> User:
    """Dependency: like optional_user, but requires a login."""
    if user is None:
        raise HTTPException(status_code=401, detail="Please log in.")
    return user


@app.post("/api/auth/signup", response_model=AuthResponse, status_code=201)
def signup(body: SignupRequest) -> AuthResponse:
    password_hash = auth.hash_password(body.password)
    try:
        with get_connection(write=True) as conn:
            cur = conn.execute(
                "INSERT INTO users (name, email, password_hash, first_name, last_name) "
                "VALUES (?, ?, ?, ?, ?)",
                (
                    f"{body.first_name} {body.last_name}",
                    body.email,
                    password_hash,
                    body.first_name,
                    body.last_name,
                ),
            )
            user_id = cur.lastrowid
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    user = User(id=user_id, first_name=body.first_name, last_name=body.last_name, email=body.email)
    return AuthResponse(token=auth.create_token(user_id), user=user)


@app.post("/api/auth/login", response_model=AuthResponse)
def login(body: LoginRequest) -> AuthResponse:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (body.email,)).fetchone()
    stored = row["password_hash"] if row else auth.DUMMY_HASH
    if not auth.verify_password(body.password, stored) or row is None:
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    return AuthResponse(token=auth.create_token(row["id"]), user=user_from_row(row))


@app.get("/api/auth/me", response_model=User)
def me(user: User = Depends(current_user)) -> User:
    return user


# ---------- Chat ----------


def cards_for(product_ids: list[str]) -> list[ProductCard]:
    """Look up the products the agent mentioned. Unknown ids are dropped, so the
    site only ever shows real catalogue items with real prices."""
    cards = []
    with get_connection() as conn:
        for pid in dict.fromkeys(product_ids):  # de-duplicate, keep order
            row = conn.execute("SELECT * FROM catalogue WHERE product_id = ?", (pid,)).fetchone()
            if row:
                cards.append(
                    ProductCard(
                        product_id=row["product_id"],
                        name=display_name(row["name"]),
                        price=row["price"],
                        image_url=image_url(row["image_file_path"]),
                    )
                )
    return cards


HISTORY_FOR_AGENT = 20  # most recent saved messages the agent sees as context
HISTORY_FOR_DISPLAY = 50  # most recent saved messages reloaded into the chat window


def product_ids_from_json(products_json: str | None) -> list[str]:
    """Saved products are a JSON list of objects with a product_id (older rows store more fields)."""
    if not products_json:
        return []
    try:
        return [p["product_id"] for p in json.loads(products_json) if isinstance(p, dict) and "product_id" in p]
    except (ValueError, TypeError):
        return []


def recent_history(user_id: int, limit: int) -> list[sqlite3.Row]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM chat_messages WHERE user_id = ? ORDER BY id DESC LIMIT ?", (user_id, limit)
        ).fetchall()
    return list(reversed(rows))  # oldest first


def save_exchange(user_id: int, message: str, reply: str, cards: list[ProductCard]) -> None:
    products_json = json.dumps([c.model_dump() for c in cards]) if cards else None
    with get_connection(write=True) as conn:
        conn.execute(
            "INSERT INTO chat_messages (user_id, role, content, products_json) VALUES (?, 'user', ?, NULL)",
            # Mask emails and card/phone numbers so they're never stored in chat history.
            (user_id, audit.redact(message)),
        )
        conn.execute(
            "INSERT INTO chat_messages (user_id, role, content, products_json) VALUES (?, 'assistant', ?, ?)",
            (user_id, reply, products_json),
        )


def current_product_for(product_id: str | None) -> CurrentProduct | None:
    """Look up the product on the shopper's screen in the database (never trust names sent by the browser)."""
    if not product_id:
        return None
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM catalogue WHERE product_id = ?", (product_id,)).fetchone()
    if row is None:
        return None
    return CurrentProduct(
        product_id=row["product_id"],
        name=row["name"],
        garment_type=row["garment_type"],
        price=row["price"],
        colors=json.loads(row["colors"]),
    )


@app.get("/api/chat/history", response_model=list[SavedChatMessage])
def chat_history(user: User = Depends(current_user)) -> list[SavedChatMessage]:
    """The logged-in shopper's saved conversation, oldest first."""
    return [
        SavedChatMessage(
            id=row["id"],
            role=row["role"],
            content=row["content"],
            products=cards_for(product_ids_from_json(row["products_json"])),
            created_at=row["created_at"],
        )
        for row in recent_history(user.id, HISTORY_FOR_DISPLAY)
        if row["role"] in ("user", "assistant")
    ]


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, user: User | None = Depends(optional_user)) -> ChatResponse:
    message = request.message.strip()
    if not message:
        raise HTTPException(status_code=422, detail="Message can't be empty.")

    page = request.page
    deps = ChatDeps(
        customer=(
            CustomerProfile(user_id=user.id, first_name=user.first_name, last_name=user.last_name, email=user.email)
            if user
            else None
        ),
        page_path=page.path if page else "/",
        current_product=current_product_for(page.product_id if page else None),
    )
    if user:
        # Logged in: context comes from the saved history in the database.
        history = [
            HistoryMessage(role=r["role"], content=r["content"])
            for r in recent_history(user.id, HISTORY_FOR_AGENT)
            if r["role"] in ("user", "assistant")
        ]
    else:
        # Guest: nothing is saved, so the browser sends this tab's recent messages.
        history = request.history[-HISTORY_FOR_AGENT:]

    try:
        result = await run_agent(message, deps, history)
    except AgentConfigError as e:
        logger.error("Agent not configured: %s", e)
        raise HTTPException(status_code=503, detail="The shopping assistant isn't set up yet. Please try again later.")
    except Exception:
        logger.exception("Agent run failed")
        raise HTTPException(
            status_code=502, detail="The shopping assistant ran into a problem. Please try again in a moment."
        )
    cards = cards_for(result.product_ids)
    if user:
        save_exchange(user.id, message, display_name(result.reply), cards)
    return ChatResponse(reply=display_name(result.reply), products=cards, show_on_page=result.show_on_page and bool(cards))


# ---------- Custom order requests ----------

CUSTOM_CATEGORIES = ["T-shirt", "Long-sleeve shirt", "Crewneck", "Hoodie", "Quarter-Zip", "Jacket or fleece", "Other"]
CUSTOM_MAX_QUANTITY = 10_000


def ensure_custom_requests_table() -> None:
    """Create the custom_requests table the first time the app starts (existing rows are kept)."""
    with get_connection(write=True) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS custom_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                request_number TEXT NOT NULL UNIQUE,
                user_id INTEGER,
                first_name TEXT NOT NULL,
                last_name TEXT NOT NULL,
                email TEXT NOT NULL,
                garment_category TEXT NOT NULL,
                quantity INTEGER NOT NULL CHECK (quantity >= 1),
                needed_by TEXT NOT NULL,
                customization TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'new',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
            """
        )


ensure_custom_requests_table()


class CustomRequestIn(BaseModel):
    first_name: str = Field(min_length=1, max_length=50)
    last_name: str = Field(min_length=1, max_length=50)
    email: str = Field(max_length=254)
    garment_category: str
    quantity: int = Field(ge=1, le=CUSTOM_MAX_QUANTITY)
    needed_by: date
    customization: str = Field(min_length=5, max_length=2000)

    @field_validator("first_name", "last_name", "customization")
    @classmethod
    def not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("This field is required.")
        return v

    @field_validator("email")
    @classmethod
    def check_email(cls, v: str) -> str:
        return _clean_email(v)

    @field_validator("garment_category")
    @classmethod
    def check_category(cls, v: str) -> str:
        if v not in CUSTOM_CATEGORIES:
            raise ValueError(f"Choose one of: {', '.join(CUSTOM_CATEGORIES)}.")
        return v

    @field_validator("needed_by")
    @classmethod
    def in_future(cls, v: date) -> date:
        if v <= date.today():
            raise ValueError("Choose a date after today.")
        return v


@app.get("/api/custom-requests/categories")
def custom_categories() -> list[str]:
    return CUSTOM_CATEGORIES


@app.post("/api/custom-requests", status_code=201)
def create_custom_request(body: CustomRequestIn, user: User | None = Depends(optional_user)) -> dict:
    """Save a custom order request. Linked to the user if they're logged in."""
    request_number = "CC-" + secrets.token_hex(3).upper()
    with get_connection(write=True) as conn:
        conn.execute(
            "INSERT INTO custom_requests (request_number, user_id, first_name, last_name, email, "
            "garment_category, quantity, needed_by, customization) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                request_number,
                user.id if user else None,
                body.first_name,
                body.last_name,
                body.email,
                body.garment_category,
                body.quantity,
                body.needed_by.isoformat(),
                body.customization,
            ),
        )
    return {
        "request_number": request_number,
        "first_name": body.first_name,
        "garment_category": body.garment_category,
        "quantity": body.quantity,
        "needed_by": body.needed_by.isoformat(),
    }
