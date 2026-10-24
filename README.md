# Campus Customs: Yale storefront + Handsome Dan chatbot

MGT 409, Homework 4. A storefront for Campus Customs (57 Broadway, New Haven) with a React + TypeScript + Vite front end, a FastAPI back end, and **Handsome Dan**, a PydanticAI shopping assistant (`gpt-5.6-luna` through Portkey) that answers questions with real prices and stock from the store's database.

## What's in this repo

```
hw4/
├── AI_prompts.md            # every prompt I gave the AI, by problem
├── requirements.txt         # Python packages for the back end
├── .env.example             # names of the settings to put in .env (no real values)
├── frontend/                # Vite + React + TypeScript site
├── backend/
│   ├── main.py              # FastAPI app: products, accounts, chat, demo checkout, custom orders
│   ├── agent.py             # the PydanticAI agent: model, tools, limits, caching
│   ├── tools.py             # search_products, get_product_details, check_stock
│   ├── models.py            # typed inputs and outputs
│   ├── prompts/prompt.md    # Handsome Dan's instructions and safety rules
│   ├── auth.py              # password hashing and login tokens
│   ├── audit.py             # append-only audit trail
│   ├── db.py                # database paths and connections
│   └── benchmark.py         # speed and cost benchmark for the agent
└── output/
    ├── harness.md           # how the whole system works
    ├── design.md            # design choices
    ├── usability.md         # usability improvements
    ├── app_check.html       # tested features with screenshots
    ├── app_check_images/    # screenshots used by app_check.html
    └── audit_trail.json     # log of agent activity (one JSON object per line)
```

**Not in the repo (on purpose):** your `.env` with real keys, the database, and the product images. These stay on your computer.

## 1. Place the data pack

Download `data.zip` from the course site (HW4 → Scenarios and data) and unzip it inside this folder, so you have:

```
hw4/
└── data/
    ├── campus_customs.db    # SQLite: catalogue, inventory, users, chat_messages
    └── products/            # product photos referenced by the catalogue
```

The back end creates one extra table (`custom_requests`) automatically the first time it starts.

## 2. One-time setup

You need Python 3.12+ and Node.js 22+.

**Back end packages** (from the `hw4` folder):

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

(On a Mac with iCloud syncing this folder, create the environment as `.venv.nosync` and link it with `ln -s .venv.nosync .venv`, so iCloud doesn't sync it.)

**Front end packages:**

```bash
cd frontend && npm install
```

**Settings:** copy `.env.example` to `.env` and fill it in:

- `PORTKEY_API_KEY`: your Portkey key, used for all AI calls. If it's missing here, the back end also checks a `.env` one folder up.
- `OPENAI_MODEL` (optional): defaults to `gpt-5.6-luna`.
- `SESSION_SECRET`: any long random string. It signs login tokens.

## 3. Run it

**Back end** (terminal 1), from the `backend` folder:

```bash
cd backend
../.venv/bin/uvicorn main:app --reload --port 8000
```

**Front end** (terminal 2), from the `frontend` folder:

```bash
cd frontend
npm run dev
```

Then open **http://localhost:5173**. The front end forwards `/api` and `/media` requests to the back end on port 8000.

To try logging in, use the seeded test account `test@campuscustoms.yale.edu` (its password is on the assignment's Problem 4 page), or create your own account.

## What you can do on the site

- Browse 102 products with filters (category, main color, price, size in stock), collections, and "You may also like".
- Add to cart and check out in a **demo store**: no payment is taken and stock doesn't change.
- Request a custom order (saved to the database).
- Chat with Handsome Dan from his doghouse: real stock and prices, typo-tolerant search, results shown on the Products page, "this" understood as the product on screen, and saved history when logged in.

See `output/harness.md` for how everything works and `output/app_check.html` for tested features with screenshots.

## Optional: agent benchmark

```bash
cd backend
../.venv/bin/python benchmark.py run
```

This asks the agent 6 fixed questions and saves timing, model calls, and tokens to `output/benchmark_run.json`.
