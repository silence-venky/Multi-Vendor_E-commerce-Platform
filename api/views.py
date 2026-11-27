from django.shortcuts import get_object_or_404
from rest_framework import generics, status
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
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]


class CategoryListCreateView(generics.ListCreateAPIView):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticatedOrReadOnly]


class ProductListCreateView(generics.ListCreateAPIView):
    queryset = Product.objects.all().order_by("-id")
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def perform_create(self, serializer):
        user = self.request.user
        if getattr(user, "role", None) != "VENDOR":
            raise PermissionDenied("Only users registered as VENDOR can add products.")

        vendor, _ = VendorProfile.objects.get_or_create(
            user=user,
            defaults={"store_name": f"{user.username}'s Store", "is_approved": True},
        )
        if not vendor.is_approved:
            raise PermissionDenied("Your vendor profile is pending admin approval.")

        serializer.save(vendor=vendor)


class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserProfileSerializer(request.user, context={"request": request})
        return Response(serializer.data)

    def patch(self, request):
        serializer = UserProfileSerializer(
            request.user,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class CartDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        cart, _ = Cart.objects.get_or_create(user=request.user)
        return Response(CartSerializer(cart).data)


class CartAddItemView(APIView):
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


class CartRemoveItemView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, item_id):
        cart, _ = Cart.objects.get_or_create(user=request.user)
        cart_item = get_object_or_404(CartItem, id=item_id, cart=cart)
        cart_item.delete()
        return Response(CartSerializer(cart).data, status=status.HTTP_200_OK)


class OrderListCreateView(generics.ListCreateAPIView):
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Order.objects.filter(customer=self.request.user).order_by("-id")

    def perform_create(self, serializer):
        order = serializer.save(customer=self.request.user)
        cart = Cart.objects.filter(user=self.request.user).first()
        if cart:
            for item in cart.items.select_related("product"):
                product = item.product
                if product.stock_quantity >= item.quantity:
                    product.stock_quantity -= item.quantity
                    product.save()
            cart.items.all().delete()