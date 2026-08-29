from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse

from .models import CartItem, Category, Order, Product, UserProfile


class EcommerceFlowTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="alice", email="alice@example.com")
        self.profile = UserProfile.objects.create(
            user=self.user,
            full_name="Alice Sharma",
            phone="9800000000",
            shipping_address="Kathmandu",
            billing_address="Kathmandu",
        )
        category = Category.objects.create(name="Electronics", slug="electronics")
        self.product = Product.objects.create(
            category=category,
            name="Speaker",
            slug="speaker",
            description="Bluetooth speaker",
            price="1000.00",
            discount_percent=10,
            is_active=True,
        )

    def test_checkout_requires_login(self):
        response = self.client.get(reverse("checkout"))
        self.assertEqual(response.status_code, 302)
        self.assertIn(reverse("login"), response.url)

    def test_add_to_cart_and_cod_checkout(self):
        self.client.force_login(self.user)
        self.client.post(reverse("add_to_cart", args=[self.product.id]))
        self.assertEqual(CartItem.objects.count(), 1)

        response = self.client.post(
            reverse("checkout"),
            {
                "full_name": self.profile.full_name,
                "phone": self.profile.phone,
                "shipping_address": self.profile.shipping_address,
                "billing_address": self.profile.billing_address,
                "email": self.user.email,
                "payment_method": Order.COD,
            },
        )
        order = Order.objects.first()
        self.assertRedirects(response, reverse("order_confirmation", args=[order.id]))
        self.assertEqual(order.payment_status, Order.PAID)
        self.assertEqual(order.status, Order.CONFIRMED)
        self.assertEqual(CartItem.objects.count(), 0)

    def test_esewa_checkout_redirects_to_placeholder(self):
        self.client.force_login(self.user)
        self.client.post(reverse("add_to_cart", args=[self.product.id]))

        response = self.client.post(
            reverse("checkout"),
            {
                "full_name": self.profile.full_name,
                "phone": self.profile.phone,
                "shipping_address": self.profile.shipping_address,
                "billing_address": self.profile.billing_address,
                "email": self.user.email,
                "payment_method": Order.ESEWA,
            },
        )
        order = Order.objects.first()
        self.assertRedirects(response, reverse("esewa_payment", args=[order.id]))
        self.assertEqual(order.payment_status, Order.PENDING)
