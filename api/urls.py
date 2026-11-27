from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import (
    AddToCartView,
    CartView,
    CategoryViewSet,
    OrderViewSet,
    ProductViewSet,
    RegisterView,
    RemoveFromCartView,
    UserProfileView,
)

# DefaultRouter automatically generates REST routes (list, retrieve, create, update, delete)
router = DefaultRouter()
router.register(r"categories", CategoryViewSet)
router.register(r"products", ProductViewSet)
router.register(r"orders", OrderViewSet, basename="order")  # basename required since get_queryset is dynamic

urlpatterns = [
    # JWT Authentication & Registration endpoints
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),

    # User Profile & Persistent Cart endpoints
    path("profile/", UserProfileView.as_view(), name="user-profile"),
    path("cart/", CartView.as_view(), name="cart-detail"),
    path("cart/add/", AddToCartView.as_view(), name="cart-add"),
    path("cart/remove/<int:item_id>/", RemoveFromCartView.as_view(), name="cart-remove"),

    # Router-registered REST endpoints (/categories/, /products/, /orders/)
    path("", include(router.urls)),
]