# 🛒 Multi-Vendor E-Commerce Platform

A production-ready, full-stack multi-vendor e-commerce web application built for developer portfolios.


Live Demo: https://multi-vendor-e-commerce-platform-km.vercel.app/ 

## 🚀 Tech Stack
* **Backend:** Python, Django 5.x, Django REST Framework (DRF)
* **Database:** MySQL 8.0.x
* **Frontend:** React.js, Axios, React Router
* **Authentication:** JSON Web Tokens (JWT via `djangorestframework-simplejwt`)

## 🌟 Features
* **Role-Based Access Control (RBAC):** Distinct permissions for Customers and Vendors.
* **Vendor Portal:** Vendors can securely create and manage products mapped to their profiles.
* **Dynamic Search & Filtering:** Real-time product search and category filtering on the frontend catalog.
* **Smart Cart & Inventory Management:** Secure checkout that automatically syncs and deducts stock quantities in real-time from the MySQL database.
* **Order Tracking:** Customers can view their complete order history.

## 🛠️ Local Setup & Installation
1. Clone the repository and set up the virtual environment:
   ```bash
   python -m venv venv
   source venv/Scripts/activate  # On Windows PowerShell
