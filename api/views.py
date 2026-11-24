from django.shortcuts import render

from rest_framework import generics, viewsets, permissions
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from rest_framework.exceptions import PermissionDenied

from rest_framework.permissions import SAFE_METHODS, IsAuthenticated
from .models import User, VendorProfile, Category, Product, Order
from .serializers import RegisterSerializer, CategorySerializer, ProductSerializer, OrderSerializer

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
    permission_classes=[IsAuthenticated]
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
        try:
            serializer.save(vendor=vendor)
        except Exception as e:
            raise ValidationError({"detail": str(e)})

# 4. Order ViewSet
class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Customers only see their own orders, newest first
        return Order.objects.filter(customer=self.request.user).order_by('-id')

    def create(self, request, *args, **kwargs):
        product_ids = request.data.get('items', [])
        total_amount = request.data.get('total_amount', 0)

        # Deduct stock for each item purchased
        for prod_id in product_ids:
            try:
                product = Product.objects.get(id=prod_id)
                if product.stock_quantity > 0:
                    product.stock_quantity -= 1
                    product.save()
            except Product.DoesNotExist:
                continue

        # Save the order
        order = Order.objects.create(
            customer=request.user,
            total_amount=total_amount
        )
        serializer = self.get_serializer(order)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
