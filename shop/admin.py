from django.contrib import admin

from .models import CartItem, Category, Notification, Order, OrderItem, Product, PromotionBanner, UserProfile

admin.site.register(UserProfile)
admin.site.register(Category)
admin.site.register(Product)
admin.site.register(CartItem)
admin.site.register(Notification)
admin.site.register(PromotionBanner)
admin.site.register(Order)
admin.site.register(OrderItem)
