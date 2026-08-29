const path = require('path');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const Stripe = require('stripe');
const dotenv = require('dotenv');
const { initDb, get, all, run } = require('./db');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    req.session.message = 'Please log in to continue.';
    return res.redirect('/login');
  }
  return next();
}

function formatPrice(cents) {
  return (cents / 100).toFixed(2);
}

async function getCartRows(userId) {
  return all(
    `SELECT cart_items.product_id, cart_items.quantity, products.name, products.image_url, products.price_cents
     FROM cart_items
     JOIN products ON products.id = cart_items.product_id
     WHERE cart_items.user_id = ?
     ORDER BY cart_items.created_at DESC`,
    [userId],
  );
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-only-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24,
    },
  }),
);

app.use(async (req, res, next) => {
  res.locals.currentUser = null;
  if (req.session.userId) {
    res.locals.currentUser = await get('SELECT id, name, email FROM users WHERE id = ?', [req.session.userId]);
  }

  res.locals.flashMessage = req.session.message || null;
  req.session.message = null;
  res.locals.formatPrice = formatPrice;
  next();
});

app.get('/', async (req, res) => {
  const products = await all('SELECT * FROM products ORDER BY created_at DESC');
  res.render('catalog', { products });
});

app.get('/products/:id', async (req, res) => {
  const product = await get('SELECT * FROM products WHERE id = ?', [req.params.id]);
  if (!product) {
    return res.status(404).render('error', { title: 'Product not found', message: 'This product does not exist.' });
  }
  return res.render('product-detail', { product });
});

app.get('/signup', (req, res) => {
  res.render('signup');
});

app.post('/signup', async (req, res) => {
  const { name, email, password, phone, shippingAddress, billingAddress } = req.body || {};
  if (!name || !email || !password || password.length < 6) {
    req.session.message = 'Name, valid email, and password (min 6 chars) are required.';
    return res.redirect('/signup');
  }

  const existing = await get('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
  if (existing) {
    req.session.message = 'An account already exists for that email.';
    return res.redirect('/login');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const created = await run(
    `INSERT INTO users (name, email, password_hash, phone, shipping_address, billing_address)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [name.trim(), email.trim().toLowerCase(), passwordHash, phone?.trim() || '', shippingAddress?.trim() || '', billingAddress?.trim() || ''],
  );

  req.session.userId = created.lastID;
  req.session.message = 'Account created successfully.';
  return res.redirect('/');
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  const user = await get('SELECT * FROM users WHERE email = ?', [email?.trim().toLowerCase()]);
  if (!user) {
    req.session.message = 'Invalid email or password.';
    return res.redirect('/login');
  }

  const validPassword = await bcrypt.compare(password || '', user.password_hash);
  if (!validPassword) {
    req.session.message = 'Invalid email or password.';
    return res.redirect('/login');
  }

  req.session.userId = user.id;
  req.session.message = `Welcome back, ${user.name}.`;
  return res.redirect('/');
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

app.get('/profile', requireAuth, async (req, res) => {
  const user = await get('SELECT id, name, email, phone, shipping_address, billing_address FROM users WHERE id = ?', [req.session.userId]);
  res.render('profile', { user });
});

app.post('/profile', requireAuth, async (req, res) => {
  const { name, email, phone, shippingAddress, billingAddress } = req.body || {};
  if (!name || !email) {
    req.session.message = 'Name and email are required.';
    return res.redirect('/profile');
  }

  await run(
    `UPDATE users SET name = ?, email = ?, phone = ?, shipping_address = ?, billing_address = ?
     WHERE id = ?`,
    [name.trim(), email.trim().toLowerCase(), phone?.trim() || '', shippingAddress?.trim() || '', billingAddress?.trim() || '', req.session.userId],
  );

  req.session.message = 'Profile updated.';
  return res.redirect('/profile');
});

app.get('/cart', requireAuth, async (req, res) => {
  const items = await getCartRows(req.session.userId);
  const subtotalCents = items.reduce((sum, item) => sum + item.price_cents * item.quantity, 0);
  res.render('cart', { items, subtotalCents });
});

app.post('/cart/add', requireAuth, async (req, res) => {
  const productId = Number(req.body.productId);
  const quantity = Math.max(1, Number(req.body.quantity) || 1);

  const product = await get('SELECT id FROM products WHERE id = ?', [productId]);
  if (!product) {
    req.session.message = 'Product not found.';
    return res.redirect('/');
  }

  await run(
    `INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)
     ON CONFLICT(user_id, product_id)
     DO UPDATE SET quantity = cart_items.quantity + excluded.quantity`,
    [req.session.userId, productId, quantity],
  );

  req.session.message = 'Added to cart.';
  return res.redirect('/cart');
});

app.post('/cart/update', requireAuth, async (req, res) => {
  const productId = Number(req.body.productId);
  const quantity = Number(req.body.quantity);

  if (!Number.isInteger(quantity) || quantity < 1) {
    req.session.message = 'Quantity must be at least 1.';
    return res.redirect('/cart');
  }

  await run('UPDATE cart_items SET quantity = ? WHERE user_id = ? AND product_id = ?', [quantity, req.session.userId, productId]);
  req.session.message = 'Cart updated.';
  return res.redirect('/cart');
});

app.post('/cart/remove', requireAuth, async (req, res) => {
  await run('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?', [req.session.userId, Number(req.body.productId)]);
  req.session.message = 'Item removed from cart.';
  return res.redirect('/cart');
});

app.get('/checkout', requireAuth, async (req, res) => {
  const items = await getCartRows(req.session.userId);
  if (items.length === 0) {
    req.session.message = 'Your cart is empty.';
    return res.redirect('/cart');
  }

  const user = await get('SELECT id, name, email, phone, shipping_address, billing_address FROM users WHERE id = ?', [req.session.userId]);
  const subtotalCents = items.reduce((sum, item) => sum + item.price_cents * item.quantity, 0);
  return res.render('checkout', {
    items,
    subtotalCents,
    user,
    stripeConfigured: Boolean(stripe),
  });
});

app.post('/checkout/create-session', requireAuth, async (req, res) => {
  const items = await getCartRows(req.session.userId);
  if (items.length === 0) {
    req.session.message = 'Your cart is empty.';
    return res.redirect('/cart');
  }

  const { name, email, phone, shippingAddress, billingAddress } = req.body || {};
  if (!name || !email || !shippingAddress || !billingAddress) {
    req.session.message = 'Name, email, shipping, and billing address are required.';
    return res.redirect('/checkout');
  }

  await run(
    `UPDATE users SET name = ?, email = ?, phone = ?, shipping_address = ?, billing_address = ?
     WHERE id = ?`,
    [name.trim(), email.trim().toLowerCase(), phone?.trim() || '', shippingAddress.trim(), billingAddress.trim(), req.session.userId],
  );

  if (!stripe) {
    req.session.message = 'Stripe is not configured. Add STRIPE_SECRET_KEY to continue.';
    return res.redirect('/checkout');
  }

  const totalAmountCents = items.reduce((sum, item) => sum + item.price_cents * item.quantity, 0);
  const order = await run(
    `INSERT INTO orders (user_id, status, total_amount_cents, name, email, phone, shipping_address, billing_address)
     VALUES (?, 'pending', ?, ?, ?, ?, ?, ?)`,
    [req.session.userId, totalAmountCents, name.trim(), email.trim().toLowerCase(), phone?.trim() || '', shippingAddress.trim(), billingAddress.trim()],
  );

  for (const item of items) {
    await run(
      'INSERT INTO order_items (order_id, product_id, quantity, unit_price_cents) VALUES (?, ?, ?, ?)',
      [order.lastID, item.product_id, item.quantity, item.price_cents],
    );
  }

  const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: items.map((item) => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.name,
          images: [item.image_url],
        },
        unit_amount: item.price_cents,
      },
      quantity: item.quantity,
    })),
    customer_email: email.trim().toLowerCase(),
    metadata: {
      orderId: String(order.lastID),
      userId: String(req.session.userId),
      name: name.trim(),
      phone: phone?.trim() || '',
      shippingAddress: shippingAddress.trim(),
      billingAddress: billingAddress.trim(),
    },
    success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}&order_id=${order.lastID}`,
    cancel_url: `${baseUrl}/checkout`,
  });

  await run('UPDATE orders SET stripe_session_id = ? WHERE id = ?', [session.id, order.lastID]);
  return res.redirect(session.url);
});

app.get('/checkout/success', requireAuth, async (req, res) => {
  const orderId = Number(req.query.order_id);
  const sessionId = String(req.query.session_id || '');

  const order = await get('SELECT * FROM orders WHERE id = ? AND user_id = ?', [orderId, req.session.userId]);
  if (!order) {
    return res.status(404).render('error', { title: 'Order not found', message: 'Unable to find your order.' });
  }

  if (order.status !== 'paid') {
    if (!stripe || !sessionId) {
      return res.status(400).render('error', {
        title: 'Payment verification failed',
        message: 'Missing payment session verification details.',
      });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') {
      return res.status(400).render('error', { title: 'Payment not completed', message: 'Your payment has not been completed yet.' });
    }

    await run("UPDATE orders SET status = 'paid' WHERE id = ?", [order.id]);
    await run('DELETE FROM cart_items WHERE user_id = ?', [req.session.userId]);
  }

  const orderItems = await all(
    `SELECT order_items.quantity, order_items.unit_price_cents, products.name
     FROM order_items
     JOIN products ON products.id = order_items.product_id
     WHERE order_items.order_id = ?`,
    [order.id],
  );

  const paidOrder = await get('SELECT * FROM orders WHERE id = ?', [order.id]);
  return res.render('order-success', { order: paidOrder, orderItems });
});

app.get('/orders', requireAuth, async (req, res) => {
  const orders = await all('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [req.session.userId]);
  res.render('orders', { orders });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', {
    title: 'Unexpected error',
    message: 'Something went wrong. Please try again.',
  });
});

initDb()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
