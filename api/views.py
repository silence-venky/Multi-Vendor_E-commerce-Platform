from django.shortcuts import render

from rest_framework import generics, viewsets, permissions
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

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

    def perform_create(self, serializer):
        # Automatically link the product to the logged-in vendor's profile
        vendor = self.request.user.vendor_profile
        serializer.save(vendor=vendor)

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
