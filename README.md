# ecommerce-website

A minimal full-stack ecommerce app with authentication, product catalog, cart, and Stripe checkout.

## Features

- Sign up, log in, log out
- Product catalog and product detail pages
- Auth-protected cart (add, update quantity, remove)
- Auth-protected checkout flow
- Profile data capture and reuse during checkout (name, email, phone, shipping and billing addresses)
- Stripe Checkout integration (no raw card data stored by this app)
- Order confirmation + order history
- SQLite schema for users, products, cart items, orders, and order items
- Seeded demo products

## Tech stack

- Node.js + Express
- EJS templates + CSS
- SQLite (`sqlite3`) for data
- Session auth (`express-session` + `connect-sqlite3`)
- Stripe Checkout for payments

## Local setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy environment file:
   ```bash
   cp .env.example .env
   ```
3. Set `SESSION_SECRET` and `STRIPE_SECRET_KEY` in `.env`.
   - Use Stripe test keys for development.
4. Start the app:
   ```bash
   npm run dev
   ```
5. Open http://localhost:3000

## Notes

- Database files are created automatically in `db/` on first run.
- Demo products are seeded automatically when the products table is empty.
- Checkout requires login and a configured `STRIPE_SECRET_KEY`.
