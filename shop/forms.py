from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User

from .models import Order, UserProfile


class SignUpForm(UserCreationForm):
    email = forms.EmailField(required=True)

    class Meta:
        model = User
        fields = ("username", "email", "password1", "password2")


class ProfileCheckoutForm(forms.ModelForm):
    email = forms.EmailField(required=True)
    payment_method = forms.ChoiceField(choices=Order.PAYMENT_CHOICES)

    class Meta:
        model = UserProfile
        fields = ("full_name", "phone", "shipping_address", "billing_address")

    def __init__(self, *args, **kwargs):
        user = kwargs.pop("user", None)
        super().__init__(*args, **kwargs)
        if user and not self.initial.get("email"):
            self.initial["email"] = user.email


class CartQuantityForm(forms.Form):
    quantity = forms.IntegerField(min_value=1, max_value=99)
