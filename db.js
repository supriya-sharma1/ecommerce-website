const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, 'db', 'ecommerce.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run('PRAGMA foreign_keys = ON');
});

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function runCallback(err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

async function initDb() {
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      phone TEXT,
      shipping_address TEXT,
      billing_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      image_url TEXT NOT NULL,
      price_cents INTEGER NOT NULL CHECK(price_cents >= 0),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, product_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      total_amount_cents INTEGER NOT NULL CHECK(total_amount_cents >= 0),
      stripe_session_id TEXT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      shipping_address TEXT NOT NULL,
      billing_address TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      unit_price_cents INTEGER NOT NULL CHECK(unit_price_cents >= 0),
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
    )
  `);

  const existingProducts = await get('SELECT COUNT(*) AS count FROM products');
  if (!existingProducts || existingProducts.count === 0) {
    const products = [
      {
        name: 'Wireless Headphones',
        description: 'Noise-cancelling over-ear headphones with 30-hour battery life.',
        imageUrl: 'https://images.unsplash.com/photo-1545127398-14699f92334b?auto=format&fit=crop&w=800&q=80',
        priceCents: 7999,
      },
      {
        name: 'Smart Fitness Watch',
        description: 'Track workouts, sleep, and heart rate with this lightweight smartwatch.',
        imageUrl: 'https://images.unsplash.com/photo-1434494878577-86c23bcb06b9?auto=format&fit=crop&w=800&q=80',
        priceCents: 12999,
      },
      {
        name: 'Eco Water Bottle',
        description: 'Insulated stainless steel bottle keeps drinks cold for 24 hours.',
        imageUrl: 'https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&w=800&q=80',
        priceCents: 2499,
      },
      {
        name: 'Minimal Backpack',
        description: 'Water-resistant backpack with laptop sleeve and hidden zip pocket.',
        imageUrl: 'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=800&q=80',
        priceCents: 5999,
      },
    ];

    for (const product of products) {
      await run(
        'INSERT INTO products (name, description, image_url, price_cents) VALUES (?, ?, ?, ?)',
        [product.name, product.description, product.imageUrl, product.priceCents],
      );
    }
  }
}

module.exports = {
  db,
  run,
  get,
  all,
  initDb,
};
