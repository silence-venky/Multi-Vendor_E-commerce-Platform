from django.contrib import admin
from .models import User, VendorProfile, Category, Product, Order, Cart, CartItem


class ProductInline(admin.TabularInline):
    model = Product
    extra = 0
    fields = ("name", "category", "price", "stock_quantity", "image")
    show_change_link = True


@admin.register(VendorProfile)
class VendorProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "store_name", "is_approved", "product_count")
    list_filter = ("is_approved",)
    search_fields = ("user__username", "user__email", "store_name")
    list_editable = ("is_approved",)
    inlines = [ProductInline]

    @admin.display(description="Products Added")
    def product_count(self, obj):
        return Product.objects.filter(vendor=obj).count()


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("name", "vendor", "category", "price", "stock_quantity")
    list_filter = ("vendor", "category")
    search_fields = ("name", "description", "vendor__store_name", "vendor__user__username")


admin.site.register(User)
admin.site.register(Category)
admin.site.register(Order)
admin.site.register(Cart)
admin.site.register(CartItem)