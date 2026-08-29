from django.urls import path

from . import views

urlpatterns = [
    path("", views.landing, name="landing"),
    path("signup/", views.signup_view, name="signup"),
    path("products/", views.product_list, name="product_list"),
    path("products/<slug:slug>/", views.product_detail, name="product_detail"),
    path("cart/", views.cart, name="cart"),
    path("cart/add/<int:product_id>/", views.add_to_cart, name="add_to_cart"),
    path("checkout/", views.checkout, name="checkout"),
    path("payment/esewa/<int:order_id>/", views.esewa_payment, name="esewa_payment"),
    path("payment/esewa/success/<int:order_id>/", views.esewa_success, name="esewa_success"),
    path("orders/<int:order_id>/confirmation/", views.order_confirmation, name="order_confirmation"),
]
