from django.db import transaction
from django.shortcuts import render

from rest_framework import generics, viewsets, status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import AllowAny, IsAuthenticated, SAFE_METHODS
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError, PermissionDenied
from rest_framework.views import APIView

from .models import (
    User,
    VendorProfile,
    Category,
    Product,
    Order,
    UserProfile,
    Cart,
    CartItem,
)
from .serializers import (
    RegisterSerializer,
    CategorySerializer,
    ProductSerializer,
    OrderSerializer,
    UserProfileSerializer,
    CartSerializer,
)


# 1. User Registration View
class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer


# 2. Category ViewSet (Publicly viewable)
class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [AllowAny]


# 3. Product ViewSet (Viewable by everyone, editable by authenticated vendors)
class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        if self.request.method in SAFE_METHODS:
            return []
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        user = self.request.user
        if not user or not user.is_authenticated:
            raise PermissionDenied("Please log in first.")
        if getattr(user, "role", None) != "VENDOR":
            raise PermissionDenied("Only vendors can create products.")

        vendor, _ = VendorProfile.objects.get_or_create(
            user=user,
            defaults={"store_name": f"{user.username}'s Store"},
        )
        if not getattr(vendor, "is_approved", False):
            raise PermissionDenied("Your vendor account is pending admin approval before you can add products.")
        try:
            serializer.save(vendor=vendor)
        except Exception as e:
            raise ValidationError({"detail": str(e)})


# 4. Order ViewSet (Supports checking out from DB Cart or explicit item IDs)
class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Order.objects.filter(customer=self.request.user).order_by('-id')

    def create(self, request, *args, **kwargs):
        cart = Cart.objects.filter(user=request.user).prefetch_related('items__product').first()
        product_ids = request.data.get('items', [])

        with transaction.atomic():
            if cart and cart.items.exists() and not product_ids:
                computed_total = 0
                for item in cart.items.all():
                    product = item.product
                    qty = min(item.quantity, product.stock_quantity)
                    if qty > 0:
                        product.stock_quantity -= qty
                        product.save()
                        computed_total += product.price * qty
                order = Order.objects.create(
                    customer=request.user,
                    total_amount=computed_total,
                )
                cart.items.all().delete()
            else:
                total_amount = request.data.get('total_amount', 0)
                for prod_id in product_ids:
                    try:
                        product = Product.objects.get(id=prod_id)
                        if product.stock_quantity > 0:
                            product.stock_quantity -= 1
                            product.save()
                    except Product.DoesNotExist:
                        continue

                order = Order.objects.create(
                    customer=request.user,
                    total_amount=total_amount,
                )
                if cart:
                    cart.items.filter(product_id__in=product_ids).delete()

        serializer = self.get_serializer(order)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


# 5. Logged-in User Profile View (GET, PUT, PATCH)
class UserProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        profile, _ = UserProfile.objects.get_or_create(user=self.request.user)
        return profile


# 6. Persistent Cart View (GET current user's cart)
class CartView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        cart, _ = Cart.objects.get_or_create(user=request.user)
        return Response(CartSerializer(cart).data)


# 7. Add or Increment Item in Persistent Cart (POST)
class AddToCartView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        product_id = request.data.get('product_id')
        try:
            quantity = int(request.data.get('quantity', 1))
        except (TypeError, ValueError):
            raise ValidationError({"detail": "quantity must be a valid integer."})

        if not product_id or quantity < 1:
            raise ValidationError({"detail": "Provide a valid product_id and quantity >= 1."})

        try:
            product = Product.objects.get(id=product_id)
        except Product.DoesNotExist:
            return Response({"detail": "Product not found."}, status=status.HTTP_404_NOT_FOUND)

        if product.stock_quantity < quantity:
            raise ValidationError({"detail": f"Only {product.stock_quantity} item(s) available in stock."})

        cart, _ = Cart.objects.get_or_create(user=request.user)
        item, created = CartItem.objects.get_or_create(
            cart=cart,
            product=product,
            defaults={'quantity': quantity},
        )
        if not created:
            new_qty = item.quantity + quantity
            if new_qty > product.stock_quantity:
                raise ValidationError({"detail": f"Cannot exceed available stock ({product.stock_quantity})."})
            item.quantity = new_qty
            item.save()

        return Response(CartSerializer(cart).data, status=status.HTTP_200_OK)


# 8. Remove Item from Persistent Cart (DELETE)
class RemoveFromCartView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, item_id):
        cart, _ = Cart.objects.get_or_create(user=request.user)
        deleted, _ = CartItem.objects.filter(id=item_id, cart=cart).delete()
        if deleted == 0:
            return Response({"detail": "Item not found in cart."}, status=status.HTTP_404_NOT_FOUND)
        return Response(CartSerializer(cart).data, status=status.HTTP_200_OK)