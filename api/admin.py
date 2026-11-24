from django.contrib import admin
from .models import User, VendorProfile, Category, Product, Order

admin.site.register(User)
class VendorProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'store_name', 'is_approved')

admin.site.register(VendorProfile, VendorProfileAdmin)
admin.site.register(Category)
admin.site.register(Product)
admin.site.register(Order)
