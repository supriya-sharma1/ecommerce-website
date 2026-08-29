from django.utils import timezone
from django.db.models import Q

from .models import Notification, PromotionBanner


def site_promotions(_request):
    now = timezone.now()
    notifications = Notification.objects.filter(is_active=True, starts_at__lte=now).filter(
        Q(ends_at__isnull=True) | Q(ends_at__gte=now)
    )
    return {
        "site_notifications": notifications.order_by("-created_at")[:3],
        "site_banners": PromotionBanner.objects.filter(is_active=True)[:2],
    }
