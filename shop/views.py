from decimal import Decimal

from django.conf import settings
from django.contrib import messages
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import AuthenticationForm
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_POST

from .forms import CartQuantityForm, ProfileCheckoutForm, SignUpForm
from .models import CartItem, Notification, Order, OrderItem, Product, PromotionBanner, UserProfile


def landing(request):
    return render(
        request,
        "shop/landing.html",
        {
            "signup_form": SignUpForm(),
            "login_form": AuthenticationForm(request=request),
            "promotions": PromotionBanner.objects.filter(is_active=True)[:2],
            "notifications": Notification.objects.filter(is_active=True)[:3],
        },
    )


def signup_view(request):
    if request.method == "POST":
        form = SignUpForm(request.POST)
        if form.is_valid():
            user = form.save()
            UserProfile.objects.get_or_create(user=user)
            login(request, user)
            messages.success(request, "Welcome! Your account has been created.")
            return redirect("product_list")
    else:
        form = SignUpForm()
    return render(request, "registration/signup.html", {"form": form})


def product_list(request):
    products = Product.objects.filter(is_active=True)
    return render(request, "shop/product_list.html", {"products": products})


def product_detail(request, slug):
    product = get_object_or_404(Product, slug=slug, is_active=True)
    return render(request, "shop/product_detail.html", {"product": product})


@login_required
@require_POST
def add_to_cart(request, product_id):
    product = get_object_or_404(Product, id=product_id, is_active=True)
    item, created = CartItem.objects.get_or_create(user=request.user, product=product)
    if not created:
        item.quantity += 1
        item.save()
    messages.success(request, f"{product.name} added to cart.")
    return redirect("cart")


@login_required
def cart(request):
    cart_items = CartItem.objects.filter(user=request.user).select_related("product")
    if request.method == "POST":
        remove_item_id = request.POST.get("remove_item")
        if remove_item_id:
            CartItem.objects.filter(id=remove_item_id, user=request.user).delete()
            messages.info(request, "Item removed from cart.")
            return redirect("cart")
        for item in cart_items:
            field_name = f"qty_{item.id}"
            if field_name in request.POST:
                form = CartQuantityForm({"quantity": request.POST.get(field_name)})
                if form.is_valid():
                    item.quantity = form.cleaned_data["quantity"]
                    item.save()
        messages.success(request, "Cart updated successfully.")
        return redirect("cart")

    total = sum((item.subtotal for item in cart_items), Decimal("0"))
    return render(request, "shop/cart.html", {"cart_items": cart_items, "total": total})


@login_required
def checkout(request):
    cart_items = CartItem.objects.filter(user=request.user).select_related("product")
    if not cart_items.exists():
        messages.warning(request, "Your cart is empty.")
        return redirect("product_list")

    profile, _ = UserProfile.objects.get_or_create(user=request.user)
    form = ProfileCheckoutForm(
        request.POST or None,
        instance=profile,
        user=request.user,
        initial={"email": request.user.email},
    )
    total = sum((item.subtotal for item in cart_items), Decimal("0"))

    if request.method == "POST" and form.is_valid():
        profile = form.save()
        request.user.email = form.cleaned_data["email"]
        request.user.save(update_fields=["email"])

        order = Order.objects.create(
            user=request.user,
            full_name=profile.full_name or request.user.username,
            email=request.user.email,
            phone=profile.phone,
            shipping_address=profile.shipping_address,
            billing_address=profile.billing_address,
            payment_method=form.cleaned_data["payment_method"],
            total_amount=total,
        )

        for item in cart_items:
            OrderItem.objects.create(
                order=order,
                product=item.product,
                product_name=item.product.name,
                unit_price=item.product.sale_price,
                quantity=item.quantity,
            )

        cart_items.delete()

        if order.payment_method == Order.ESEWA:
            messages.info(request, "Proceed with eSewa payment.")
            return redirect("esewa_payment", order_id=order.id)

        order.payment_status = Order.PAID
        order.status = Order.CONFIRMED
        order.save(update_fields=["payment_status", "status"])
        messages.success(request, "Order placed successfully with Cash on Delivery.")
        return redirect("order_confirmation", order_id=order.id)

    return render(request, "shop/checkout.html", {"form": form, "cart_items": cart_items, "total": total})


@login_required
def esewa_payment(request, order_id):
    order = get_object_or_404(Order, id=order_id, user=request.user)
    return render(
        request,
        "shop/esewa_payment.html",
        {
            "order": order,
            "merchant_id": settings.ESEWA_MERCHANT_ID,
            "success_url": settings.ESEWA_SUCCESS_URL,
            "failure_url": settings.ESEWA_FAILURE_URL,
        },
    )


@login_required
@require_POST
def esewa_success(request, order_id):
    order = get_object_or_404(Order, id=order_id, user=request.user)
    order.payment_status = Order.PAID
    order.status = Order.CONFIRMED
    order.save(update_fields=["payment_status", "status"])
    messages.success(request, "Payment successful via eSewa (mock).")
    return redirect("order_confirmation", order_id=order.id)


@login_required
def order_confirmation(request, order_id):
    order = get_object_or_404(Order.objects.prefetch_related("items"), id=order_id, user=request.user)
    return render(request, "shop/order_confirmation.html", {"order": order})
