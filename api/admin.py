from django.contrib import admin
from .models import User, VendorProfile, Category, Product, Order

admin.site.register(User)
admin.site.register(VendorProfile)
admin.site.register(Category)
admin.site.register(Product)
admin.site.register(Order)
