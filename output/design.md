# Design

The goal: make the site feel like the real Campus Customs storefront on Broadway, a Yale shop with personality, so shoppers trust it, enjoy browsing, and keep going until they buy.

## Problem 10 redesign

| Change | What I did | Why it should help customers stick around and buy |
|---|---|---|
| **Yale color scheme** | Replaced the black-and-pink theme with Yale colors: a dark navy background, Yale Blue (#00356B) surfaces, white, and light-blue and gray accents. There's no pink anywhere. Primary buttons are white with Yale Blue text, like a varsity jersey. | The site instantly reads as "Yale," which matches what shoppers came for and makes officially licensed gear feel authentic. White buttons stand out sharply on navy, so "Add to cart" and "Shop the catalogue" are the most visible things on the page. |
| **Collegiate type** | Headings use Playfair Display, a classic serif. The "CAMPUS CUSTOMS" wordmark, ticker, and doghouse sign use Graduate, a varsity block font. Body text is Inter. The fonts are bundled with the site, so they load reliably and offline. | Serif headings feel established and trustworthy, like a long-running campus shop; the varsity font adds school spirit. Clear contrast between heading, label, and body text makes pages quick to scan. |
| **Wordmarks and credits** | Text wordmarks for **Campus Customs** and **Yale Bulldog Blue** in the header and footer. The real logo files couldn't be downloaded because the store's site blocked automated requests, so I chose text wordmarks instead. The footer shows an "Officially Licensed Yale Merchandise" badge labeled as the real store's badge, plus a credit line saying the names and marks belong to Campus Customs and Yale and are used for a class project. | Shoppers know whose store this is from the first second. Being honest about licensing and the class project avoids misleading anyone. |
| **Handsome Dan hero** | The homepage features an original cartoon of Handsome Dan as a knight in Yale chainmail, with a Yale Blue tabard showing a white "Y". He floats gently over a soft blue glow, captioned "Sir Handsome Dan, guardian of Broadway". He's drawn in code (SVG), not copied from any photo. AI image generation through Portkey wasn't available, because the course key only allows the text model. | A memorable mascot gives the store a personality that a plain catalogue can't. It's playful, gift-worthy, and very Yale, which makes visitors want to look around. |
| **Scrolling ticker** | A Yale Blue banner under the hero scrolls the store's selling points: officially licensed, screen printing and embroidery next door, college gear, family gifts, 57 Broadway. | Key reasons to buy are visible without reading a paragraph, and the gentle motion draws the eye down the page toward the products. |
| **Storefront product cards** | Product photos sit on white "shelves" and zoom slightly on hover. Prices sit in Yale Blue pill tags. Cards lift with a soft shadow on hover and slide up gently when the page loads. Each page fades in when you open it. | Clean white backgrounds make the clothing look like real store merchandise, the price is easy to spot, and the hover feedback invites clicking into a product. |
| **Handsome Dan's doghouse chat** | The chat is drawn after Dan's real doghouse at the Yale Visitor Center: a white Gothic box with **navy "Y" finials on white bone posts** along the roofline, corner pinnacles, a **round-arched doorway** where Dan peeks out, a **crest shield** (bone band and red X), a band of **pointed navy windows with white bones** and **round windows with paw prints**, and the navy **"YALE" ramp** up the side (hidden on narrow screens). Dan's face appears beside each reply and on the chat button, which has an "Ask Dan" tag. The "Guest · log in to save your chats" line is gone; logged-in shoppers still see "Signed in as …". The design went through three versions: a generic pitched roof, then a stone castle, then this one, matched to the real doghouse's photo. | A help chat is more inviting when a beloved mascot answers it from his own (recognizably Yale) house. Shoppers who ask questions find the right item and size, which turns browsers into buyers. |
| **Handsome Dan's voice** | `prompts/prompt.md` now has the assistant speak as Handsome Dan: warm and playful, with at most one bulldog touch per reply ("Woof!", "sniffed out"). All facts, tools, stock rules, and safety rules are unchanged. Example: "Yes—the Basic Hoodie Big Yale is available in medium, but only 5 are left. Woof!" | Personality makes the chat fun to use, while answers stay accurate and short, so the charm never slows a shopper down. |
| **Motion that respects shoppers** | All animation (Dan's float, the ticker, card and page entrances) turns off for anyone who has "reduce motion" set on their device. Animations never hide content: if they don't run, everything is still visible. | Motion adds polish without making the site harder to use or causing discomfort. |

## Problem 10, round 2: Handsome Dan everywhere

| Change | What I did | Why it should help customers stick around and buy |
|---|---|---|
| **Favicon** | The browser tab icon is now a navy and white "CC" tile (it was the old pink one), and phones tint their browser bar navy. | The store looks consistent even in a crowded row of browser tabs, so shoppers can find their way back to it. |
| **404 page** | A missing page shows Dan sniffing back and forth with a "?" bubble: "Woof! Dan couldn't sniff out this page", with **Back to home** and **Browse products** buttons. | A dead end becomes a smile and two clear ways back into the store instead of a reason to leave. |
| **Empty cart** | The empty cart shows Dan in his chainmail next to "Dan's guarding an empty basket. Let's find something worth fetching." with a **Browse products** button. | It nudges the shopper straight back to products, right when they might otherwise give up. |
| **Dan thinks while he types** | While a reply is loading, Dan's face in the doghouse doorway and next to the typing dots tilts his head back and forth, then settles when the answer arrives. | The wait feels like Dan is working on the answer, which makes a few seconds feel shorter and keeps shoppers in the chat. |
| **About page storefront** | An illustrated storefront, drawn in code: a scalloped Yale Blue and white striped awning, a "Campus Customs · 57 Broadway · New Haven" sign, a shop window with two Y tees, an arched door, and Dan sitting outside. It's captioned "On Broadway since the 1970s", the verified fact; the exact founding year is unconfirmed. | It turns the store's story into a picture, the real shop across from campus, which builds trust that this is an established Yale store. |

All new motion (sniffing, head tilt) also turns off for shoppers who have "reduce motion" on. The speed benchmark was re-run with Dan's personality, and the current numbers are in `output/usability.md` (#4).

## Design work from earlier problems

| Change | What I did | Why it helps |
|---|---|---|
| **Storefront layout** (Problem 3) | A sticky top nav; a large hero with clear calls to action; a "Shop by what you love" card grid; a product grid with consistent cards; and a product page with a large photo on the left and details on the right. | Familiar store layout means no learning curve: shoppers know where to look for products, prices, and the cart. |
| **Clear loading, empty, and error states** (Problems 3–9) | Shimmering card placeholders while products load, friendly "No products match" and "Your cart is empty" messages with a next step, and plain-language error messages. | Shoppers never face a blank or broken-looking page, so they're less likely to leave. |
| **Chat results banner** (Problem 7) | When the chat puts products on the page, a banner shows the question and a **Clear** button. | Shoppers always know why they're seeing these products and how to get back to everything. |
| **Chat history dividers** (Problem 8) | "Earlier conversation" and "Now" dividers separate saved history from new messages. | Returning shoppers can pick up where they left off without confusion. |

These design-related items are documented in `output/usability.md` and are referenced here rather than repeated:
- **#5, mobile-friendly site:** phone layouts everywhere, two cards per row, and a full-screen chat.
- **#7, "Shop by what you love" collections**, with a banner for each collection.
- **#8, removing the Colors section** that looked like selectable colors.
- **#9, "Quarter-Zip" names** instead of "1 4 Zip".
- **#10, the product filter sidebar** with color swatches, counts, and chips.
- **#12, page content moving aside** for the open chat on laptops.
- **#13, bold text instead of asterisks** in chat.
