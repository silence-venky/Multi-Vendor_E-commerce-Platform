from rest_framework import serializers
from .models import User, VendorProfile, Category, Product, Order, Cart, CartItem


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    store_name = serializers.CharField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = User
        fields = ["id", "username", "email", "password", "role", "store_name"]

    def create(self, validated_data):
        store_name = validated_data.pop("store_name", "")
        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data.get("email", ""),
            password=validated_data["password"],
            role=validated_data.get("role", "CUSTOMER"),
        )
        if user.role == "VENDOR":
            VendorProfile.objects.get_or_create(
                user=user,
                defaults={"store_name": store_name or f"{user.username}'s Store"},
            )
        return user


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        # Only include fields that actually exist on your Category model
        fields = ["id", "name"]


class ProductSerializer(serializers.ModelSerializer):
    vendor_name = serializers.CharField(source="vendor.store_name", read_only=True, default="")
    category_name = serializers.CharField(source="category.name", read_only=True, default="")

    class Meta:
        model = Product
        fields = [
            "id",
            "vendor",
            "vendor_name",
            "category",
            "category_name",
            "name",
            "description",
            "price",
            "stock_quantity",
            "image",
        ]
        read_only_fields = ["vendor"]


class VendorProductSummarySerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True, default="")

    class Meta:
        model = Product
        fields = [
            "id",
            "name",
            "description",
            "price",
            "stock_quantity",
            "category",
            "category_name",
            "image",
        ]


class UserProfileSerializer(serializers.ModelSerializer):
    store_name = serializers.SerializerMethodField()
    is_approved = serializers.SerializerMethodField()
    products = serializers.SerializerMethodField()

    class Meta:
        model = User
        # Remove any of phone/address/city/pincode that are not columns on your User model
        fields = [
            "id",
            "username",
            "email",
            "role",
            "store_name",
            "is_approved",
            "products",
        ]
        read_only_fields = ["id", "username", "role"]

    def _get_vendor(self, obj):
        if getattr(obj, "role", None) != "VENDOR":
            return None
        return getattr(obj, "vendorprofile", None) or VendorProfile.objects.filter(user=obj).first()

    def get_store_name(self, obj):
        vendor = self._get_vendor(obj)
        return vendor.store_name if vendor else None

    def get_is_approved(self, obj):
        vendor = self._get_vendor(obj)
        return vendor.is_approved if vendor else None

    def get_products(self, obj):
        vendor = self._get_vendor(obj)
        if not vendor:
            return []
        qs = Product.objects.filter(vendor=vendor).order_by("-id")
        return VendorProductSummarySerializer(qs, many=True, context=self.context).data


class CartItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_price = serializers.DecimalField(
        source="product.price", max_digits=10, decimal_places=2, read_only=True
    )
    subtotal = serializers.SerializerMethodField()

    class Meta:
        model = CartItem
        fields = ["id", "product", "product_name", "product_price", "quantity", "subtotal"]

    def get_subtotal(self, obj):
        return obj.product.price * obj.quantity


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)
    total_amount = serializers.SerializerMethodField()

    class Meta:
        model = Cart
        fields = ["id", "items", "total_amount"]

    def get_total_amount(self, obj):
        return sum(item.product.price * item.quantity for item in obj.items.all())


class OrderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Order
        fields = ["id", "customer", "items", "total_amount", "status", "created_at"]
        read_only_fields = ["customer", "status", "created_at"]