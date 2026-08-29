# Ecommerce Website (Django + MySQL/XAMPP)

A minimal but complete ecommerce web app built with Django templates, HTML/CSS, and MySQL support for XAMPP.

## Features

- User auth: signup, login, logout
- Attractive responsive landing page with login/signup CTAs
- Product listing + product detail pages
- Protected cart/checkout routes
- Cart actions: add, remove, update quantity
- Checkout using saved profile data (name, email, phone, shipping, billing)
- eSewa-ready payment placeholder (no raw card storage)
- Cash on Delivery flow
- Promotions and sale banners
- New product/promotion popup notifications (admin/data-driven)
- Order confirmation page

## Tech Stack

- Backend: Django 5
- Frontend: Django templates + Bootstrap + custom CSS
- DB: MySQL (XAMPP) or SQLite fallback for quick start

## 1) Setup (Windows/macOS/Linux)

### Clone and enter project
```bash
git clone https://github.com/supriya-sharma1/ecommerce-website.git
cd ecommerce-website
```

### Create virtual environment

**Windows (PowerShell)**
```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
```

**macOS/Linux**
```bash
python3 -m venv .venv
source .venv/bin/activate
```

### Install dependencies
```bash
pip install -r requirements.txt
```

### Configure environment
```bash
cp .env.example .env
```
Edit `.env` values as needed.

## 2) Configure MySQL in XAMPP

1. Start **Apache** and **MySQL** in XAMPP Control Panel.
2. Open phpMyAdmin (`http://localhost/phpmyadmin`).
3. Create database:
   - Name: `ecommerce_db`
   - Collation: `utf8mb4_general_ci`
4. In `.env`, keep:
   - `DB_ENGINE=mysql`
   - `MYSQL_DATABASE=ecommerce_db`
   - `MYSQL_USER=root`
   - `MYSQL_PASSWORD=` (empty unless you set one in XAMPP)
   - `MYSQL_HOST=127.0.0.1`
   - `MYSQL_PORT=3306`

> For quick demo without MySQL, set `DB_ENGINE=sqlite`.

## 3) Run migrations and create admin user

```bash
python manage.py migrate
python manage.py createsuperuser
```

## 4) Load demo data

```bash
python manage.py loaddata shop/fixtures/demo_data.json
```

## 5) Start server

```bash
python manage.py runserver
```

Open: `http://127.0.0.1:8000/`

## eSewa integration notes

This project includes an eSewa-ready placeholder flow and mock success step.

Set these values in `.env` when live credentials are available:

- `ESEWA_MERCHANT_ID`
- `ESEWA_SUCCESS_URL`
- `ESEWA_FAILURE_URL`

You can replace the mock success endpoint with real eSewa callback validation and transaction verification once merchant credentials/API contract are provided.

## Security notes

- Checkout reuses saved user profile metadata only.
- Passwords are managed by Django auth and never reused for payments.
- No raw payment card details are collected or stored.

## Useful commands

```bash
python manage.py test shop
python manage.py check
```
