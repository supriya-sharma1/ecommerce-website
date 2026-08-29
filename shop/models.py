from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone


class UserProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    full_name = models.CharField(max_length=120, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    shipping_address = models.TextField(blank=True)
    billing_address = models.TextField(blank=True)

    def __str__(self):
        return self.full_name or self.user.username


class Category(models.Model):
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(unique=True)

    def __str__(self):
        return self.name


class Product(models.Model):
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True)
    name = models.CharField(max_length=200)
    slug = models.SlugField(unique=True)
    description = models.TextField()
    image_url = models.URLField(blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    discount_percent = models.PositiveSmallIntegerField(default=0)
    is_new = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    @property
    def sale_price(self):
        if self.discount_percent > 0:
            return self.price * (Decimal("100") - Decimal(str(self.discount_percent))) / Decimal("100")
        return self.price

    def __str__(self):
        return self.name


class CartItem(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "product")

    @property
    def subtotal(self):
        return self.product.sale_price * self.quantity


class Notification(models.Model):
    NEW_PRODUCT = "new_product"
    PROMOTION = "promotion"
    SALE = "sale"

    KIND_CHOICES = [
        (NEW_PRODUCT, "New Product"),
        (PROMOTION, "Promotion"),
        (SALE, "Sale"),
    ]

    title = models.CharField(max_length=150)
    message = models.CharField(max_length=255)
    kind = models.CharField(max_length=20, choices=KIND_CHOICES, default=PROMOTION)
    is_active = models.BooleanField(default=True)
    starts_at = models.DateTimeField(default=timezone.now)
    ends_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class PromotionBanner(models.Model):
    title = models.CharField(max_length=150)
    subtitle = models.CharField(max_length=255, blank=True)
    discount_text = models.CharField(max_length=50, blank=True)
    cta_text = models.CharField(max_length=50, default="Shop Now")
    cta_link = models.CharField(max_length=200, default="/products/")
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.title


class Order(models.Model):
    ESEWA = "esewa"
    COD = "cod"
    PAYMENT_CHOICES = [(ESEWA, "eSewa"), (COD, "Cash on Delivery")]

    PENDING = "pending"
    PAID = "paid"
    FAILED = "failed"
    PAYMENT_STATUS_CHOICES = [(PENDING, "Pending"), (PAID, "Paid"), (FAILED, "Failed")]

    PLACED = "placed"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
    STATUS_CHOICES = [(PLACED, "Placed"), (CONFIRMED, "Confirmed"), (CANCELLED, "Cancelled")]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    full_name = models.CharField(max_length=120)
    email = models.EmailField()
    phone = models.CharField(max_length=20)
    shipping_address = models.TextField()
    billing_address = models.TextField()
    payment_method = models.CharField(max_length=20, choices=PAYMENT_CHOICES, default=ESEWA)
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default=PENDING)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=PLACED)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True)
    product_name = models.CharField(max_length=200)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.PositiveIntegerField(default=1)

    @property
    def subtotal(self):
        return self.unit_price * self.quantity
