from rest_framework import serializers
from .models import User, VendorProfile, Category, Product, Order

# 1. User Registration Serializer
class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'role']

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            role=validated_data.get('role', 'CUSTOMER')
        )
        return user

# 2. Category Serializer
class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'
        

# 3. Product Serializer
class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = '__all__'
        read_only_fields=['vendor']

# 4. Order Serializer
class OrderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Order
        fields = '__all__'
        read_only_fields = ['customer', 'total_amount', 'status', 'razorpay_order_id']

from .models import UserProfile, Cart, CartItem


# 5. User Profile Serializer (GET & PATCH/PUT)
class UserProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.EmailField(source='user.email', required=False)
    role = serializers.CharField(source='user.role', read_only=True)
    store_name = serializers.SerializerMethodField()
    is_approved = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = [
            'id', 'username', 'email', 'role',
            'store_name', 'is_approved',
            'phone', 'address', 'city', 'pincode'
        ]

    def get_store_name(self, obj):
        vendor = getattr(obj.user, 'vendor_profile', None)
        return vendor.store_name if vendor else None

    def get_is_approved(self, obj):
        vendor = getattr(obj.user, 'vendor_profile', None)
        return vendor.is_approved if vendor else None

    def update(self, instance, validated_data):
        user_data = validated_data.pop('user', {})
        if 'email' in user_data:
            instance.user.email = user_data['email']
            instance.user.save()
        return super().update(instance, validated_data)


# 6. Cart Item Serializer
class CartItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_price = serializers.DecimalField(source='product.price', max_digits=10, decimal_places=2, read_only=True)
    subtotal = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = CartItem
        fields = ['id', 'product', 'product_name', 'product_price', 'quantity', 'subtotal']


# 7. Persistent Cart Serializer
class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)
    total_amount = serializers.SerializerMethodField()

    class Meta:
        model = Cart
        fields = ['id', 'items', 'total_amount', 'updated_at']

    def get_total_amount(self, obj):
        return sum(item.subtotal() for item in obj.items.select_related('product'))