import axios from 'axios';

const API_BASE_URL = 'https://multi-vendor-e-commerce-platform-1-22mo.onrender.com';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Automatically attach JWT token to requests if available
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export const getProducts = () => api.get('api/products/');
export const getCategories = () => api.get('api/categories/');
export const registerUser = (userData) => api.post('api/register/', userData);
export const loginUser = (credentials) => api.post('api/login/', credentials);
export const createProduct = (productData) => api.post('api/products/', productData);
export const createOrder = (orderData) => api.post('api/orders/', orderData);
export const getOrders = () => api.get('api/orders/');

// User Profile & Persistent Cart endpoints
export const getProfile = () => api.get('api/profile/');
export const updateProfile = (profileData) => api.patch('api/profile/', profileData);
export const getCart = () => api.get('api/cart/');
export const addToCart = (productId, quantity = 1) =>
    api.post('api/cart/add/', { product_id: productId, quantity });
export const removeFromCart = (itemId) => api.delete(`api/cart/remove/${itemId}/`);

export default api;