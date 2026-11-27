from django.shortcuts import get_object_or_404
from rest_framework import generics, status, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Cart, CartItem, Category, Order, Product, User, VendorProfile
from .serializers import (
    CartSerializer,
    CategorySerializer,
    OrderSerializer,
    ProductSerializer,
    RegisterSerializer,
    UserProfileSerializer,
)


class RegisterView(generics.CreateAPIView):
    """Handles new user registration (Customer or Vendor)."""
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]  # Open to unauthenticated new visitors


class CategoryViewSet(viewsets.ModelViewSet):
    """Provides list/retrieve for everyone and create/update/delete for authenticated users."""
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticatedOrReadOnly]


class ProductViewSet(viewsets.ModelViewSet):
    """Manages catalog products, including multipart image uploads and vendor ownership."""
    queryset = Product.objects.all().order_by("-id")  # Newest products appear first
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    parser_classes = [MultiPartParser, FormParser, JSONParser]  # Supports FormData image uploads

    def perform_create(self, serializer):
        """Attach the logged-in vendor's profile automatically when creating a product."""
        user = self.request.user
        if getattr(user, "role", None) != "VENDOR":
            raise PermissionDenied("Only users registered as VENDOR can add products.")

        # Ensure a VendorProfile exists for this vendor user
        vendor, _ = VendorProfile.objects.get_or_create(
            user=user,
            defaults={"store_name": f"{user.username}'s Store", "is_approved": True},
        )
        if not vendor.is_approved:
            raise PermissionDenied("Your vendor profile is pending admin approval.")

        serializer.save(vendor=vendor)


class UserProfileView(APIView):
    """Retrieves and updates the authenticated user's profile (plus vendor's products)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Pass `request` in context so image URLs resolve properly when serialized
        serializer = UserProfileSerializer(request.user, context={"request": request})
        return Response(serializer.data)

    def patch(self, request):
        serializer = UserProfileSerializer(
            request.user,
            data=request.data,
            partial=True,  # Allows updating only changed profile fields
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class CartView(APIView):
    """Fetches the authenticated user's persistent shopping cart."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        cart, _ = Cart.objects.get_or_create(user=request.user)
        return Response(CartSerializer(cart).data)


class AddToCartView(APIView):
    """Adds a product (or increments quantity) in the user's persistent cart."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        product_id = request.data.get("product_id")
        quantity = int(request.data.get("quantity", 1))
        product = get_object_or_404(Product, id=product_id)

        if product.stock_quantity < quantity:
            return Response(
                {"detail": "Insufficient stock available."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cart, _ = Cart.objects.get_or_create(user=request.user)
        cart_item, created = CartItem.objects.get_or_create(
            cart=cart, product=product, defaults={"quantity": quantity}
        )
        if not created:
            cart_item.quantity += quantity
            cart_item.save()

        return Response(CartSerializer(cart).data, status=status.HTTP_200_OK)


class RemoveFromCartView(APIView):
    """Removes a specific item from the authenticated user's cart."""
    permission_classes = [IsAuthenticated]

    def delete(self, request, item_id):
        cart, _ = Cart.objects.get_or_create(user=request.user)
        cart_item = get_object_or_404(CartItem, id=item_id, cart=cart)
        cart_item.delete()
        return Response(CartSerializer(cart).data, status=status.HTTP_200_OK)


class OrderViewSet(viewsets.ModelViewSet):
    """Handles customer order history and checkout stock deduction."""
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Return only orders belonging to the logged-in customer."""
        return Order.objects.filter(customer=self.request.user).order_by("-id")

    def perform_create(self, serializer):
        """Create order, decrement product stock, and clear the user's cart."""
        order = serializer.save(customer=self.request.user)
        cart = Cart.objects.filter(user=self.request.user).first()
        if cart:
            for item in cart.items.select_related("product"):
                product = item.product
                if product.stock_quantity >= item.quantity:
                    product.stock_quantity -= item.quantity
                    product.save()
            cart.items.all().delete()