import React, { useCallback, useEffect, useState } from 'react';
import {
  getProducts,
  getCategories,
  loginUser,
  registerUser,
  createProduct,
  createOrder,
  getOrders,
  getProfile,
  updateProfile,
  getCart,
  addToCart as addToCartApi,
  removeFromCart as removeFromCartApi,
} from './services/api';
import './App.css';

const API_BASE_URL = 'https://multi-vendor-e-commerce-platform-1-22mo.onrender.com';
const emptyCart = { items: [], total_amount: 0 };

const getImageUrl = (imagePath) => {
  if (!imagePath) return '';
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  return `${API_BASE_URL}${imagePath.startsWith('/') ? '' : '/'}${imagePath}`;
};

function App() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [orders, setOrders] = useState([]);
  const [profile, setProfile] = useState(null);
  const [view, setView] = useState('catalog');
  const [token, setToken] = useState(localStorage.getItem('access_token') || '');
  const [cart, setCart] = useState(emptyCart);
  const [statusMessage, setStatusMessage] = useState('');

  // Profile form states
  const [profileEmail, setProfileEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  // Auth form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('CUSTOMER');

  // Product form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [productImage, setProductImage] = useState(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  const syncProfileState = (profileData) => {
    setProfile(profileData);
    setProfileEmail(profileData?.email || '');
    setPhone(profileData?.phone || '');
    setAddress(profileData?.address || '');
    setCity(profileData?.city || '');
    setPincode(profileData?.pincode || '');
  };

  const fetchSessionData = useCallback(async () => {
    const savedToken = localStorage.getItem('access_token');
    if (!savedToken) {
      setProfile(null);
      setCart(emptyCart);
      return;
    }

    try {
      const [profileRes, cartRes] = await Promise.all([getProfile(), getCart()]);
      syncProfileState(profileRes.data);
      setCart(cartRes.data || emptyCart);
      setStatusMessage('');
    } catch (err) {
      console.error('Failed to load session from backend:', err);
      if (err.response?.status === 401) {
        localStorage.removeItem('access_token');
        setToken('');
        setProfile(null);
        setCart(emptyCart);
      } else {
        setStatusMessage('Could not sync cart/profile from server. Check backend deployment & migrations.');
      }
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  useEffect(() => {
    if (token) {
      fetchSessionData();
    } else {
      setProfile(null);
      setCart(emptyCart);
    }
  }, [token, fetchSessionData]);

  const fetchProducts = () => {
    getProducts()
      .then((res) => setProducts(res.data))
      .catch((err) => console.error('Error fetching products:', err));
  };

  const fetchCategories = () => {
    getCategories()
      .then((res) => setCategories(res.data))
      .catch((err) => console.error('Error fetching categories:', err));
  };

  const fetchOrders = () => {
    getOrders()
      .then((res) => setOrders(res.data))
      .catch((err) => console.error('Error fetching orders:', err));
  };

  const handleOpenOrders = () => {
    fetchOrders();
    setView('orders');
  };

  const handleOpenProfile = async () => {
    await fetchSessionData();
    setView('profile');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await loginUser({ username, password });
      localStorage.setItem('access_token', res.data.access);
      setToken(res.data.access);
      setView('catalog');
    } catch (err) {
      alert('Login failed. Check your credentials.');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      await registerUser({ username, email, password, role });
      alert('Registration successful! Please log in.');
      setView('login');
    } catch (err) {
      alert('Registration failed. Username or email might already exist.');
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      const res = await updateProfile({
        email: profileEmail,
        phone,
        address,
        city,
        pincode,
      });
      syncProfileState(res.data);
      alert('Profile saved permanently!');
    } catch (err) {
      console.error('Profile update failed:', err);
      alert('Failed to save profile changes.');
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('description', description);
      formData.append('price', price);
      formData.append('stock_quantity', stock);
      if (categoryId) {
        formData.append('category', parseInt(categoryId, 10));
      }
      if (productImage) {
        formData.append('image', productImage);
      }

      await createProduct(formData);
      alert('Product created successfully!');
      setName('');
      setDescription('');
      setPrice('');
      setStock('');
      setCategoryId('');
      setProductImage(null);
      setFileInputKey((prev) => prev + 1);
      fetchProducts();
      await fetchSessionData();
      setView('catalog');
    } catch (err) {
      console.error('Create product error:', err.response?.data || err);
      const data = err.response?.data;
      const backendMsg =
        data?.detail ||
        (typeof data === 'object' && data !== null ? JSON.stringify(data) : null) ||
        err.message ||
        'Failed to create product.';
      alert(`Error creating product (${err.response?.status || 'Network'}): ${backendMsg}`);
    }
  };

  const addToCart = async (product) => {
    if (product.stock_quantity <= 0) {
      alert('Sorry, this item is out of stock!');
      return;
    }
    if (!token) {
      alert('Please log in first so your cart is saved to your account.');
      setView('login');
      return;
    }
    try {
      const res = await addToCartApi(product.id, 1);
      setCart(res.data || emptyCart);
    } catch (err) {
      console.error('Add to cart failed:', err);
      alert(err.response?.data?.detail || 'Failed to add item to cart.');
    }
  };

  const removeFromCart = async (itemId) => {
    try {
      const res = await removeFromCartApi(itemId);
      setCart(res.data || emptyCart);
    } catch (err) {
      console.error('Remove from cart failed:', err);
      alert('Failed to remove item from cart.');
    }
  };

  const cartItems = cart.items || [];
  const cartCount = cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0);

  const calculateTotal = () => {
    if (cart.total_amount !== undefined && cart.total_amount !== null) {
      return parseFloat(cart.total_amount).toFixed(2);
    }
    return cartItems
      .reduce((total, item) => total + parseFloat(item.subtotal || 0), 0)
      .toFixed(2);
  };

  const handleCheckout = async () => {
    if (!token) {
      alert('Please log in to place an order.');
      setView('login');
      return;
    }
    if (cartItems.length === 0) {
      alert('Your cart is empty.');
      return;
    }

    try {
      const total_amount = calculateTotal();
      const itemIds = cartItems.map((item) => item.product);
      await createOrder({ total_amount, items: itemIds });
      alert('Order placed successfully!');
      await fetchSessionData();
      fetchProducts();
      handleOpenOrders();
    } catch (err) {
      console.error('Order error:', err);
      alert('Failed to place order.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    setToken('');
    setProfile(null);
    setCart(emptyCart);
    setOrders([]);
    setView('catalog');
  };

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === '' || product.category === parseInt(selectedCategory, 10);
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="app-shell">
      <header className="top-header">
        <div className="brand-block">
          <div className="brand-row">
            <h1 className="brand-title">🛒 Multi-Vendor Bazaar</h1>
            <span className="storefront-tag">Best Value &amp; Deals</span>
          </div>
          <p className="brand-subtitle">Django REST + React + MySQL Multi-Vendor Storefront</p>
        </div>

        <nav className="nav-group">
          <button
            onClick={() => setView('catalog')}
            className={`nav-btn ${view === 'catalog' ? 'active' : ''}`}
          >
            Catalog
          </button>
          <button
            onClick={() => setView('cart')}
            className={`nav-btn ${view === 'cart' ? 'active' : ''}`}
          >
            Cart ({cartCount})
          </button>

          {token ? (
            <>
              <button
                onClick={handleOpenOrders}
                className={`nav-btn ${view === 'orders' ? 'active' : ''}`}
              >
                My Orders
              </button>
              <button
                onClick={() => setView('add-product')}
                className={`nav-btn ${view === 'add-product' ? 'active' : ''}`}
              >
                Add Product (Vendor)
              </button>
              <button
                onClick={handleOpenProfile}
                title="View User Profile"
                className="profile-pill-btn"
              >
                <span className="avatar-circle">
                  {(profile?.username?.[0] || 'U').toUpperCase()}
                </span>
                <span>{profile?.username || 'Profile'}</span>
              </button>
              <button onClick={handleLogout} className="logout-btn">
                Logout
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setView('login')}
                className={`nav-btn ${view === 'login' ? 'active' : ''}`}
              >
                Login
              </button>
              <button
                onClick={() => setView('register')}
                className={`nav-btn ${view === 'register' ? 'active' : ''}`}
              >
                Register
              </button>
            </>
          )}
        </nav>
      </header>

      {statusMessage && <div className="status-banner">{statusMessage}</div>}

      {/* VIEW 1: CATALOG */}
      {view === 'catalog' && (
        <section className="section-card">
          <div className="catalog-topbar">
            <h2 className="section-heading">Trending Products</h2>
            <span className="result-count-pill">
              {filteredProducts.length} {filteredProducts.length === 1 ? 'Item' : 'Items'} Available
            </span>
          </div>

          {categories.length > 0 && (
            <div className="category-strip">
              <button
                type="button"
                onClick={() => setSelectedCategory('')}
                className={`category-chip ${selectedCategory === '' ? 'active' : ''}`}
              >
                All Categories
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(String(cat.id))}
                  className={`category-chip ${
                    String(selectedCategory) === String(cat.id) ? 'active' : ''
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}

          <div className="filter-bar">
            <input
              type="text"
              placeholder="Search for products, brands, and descriptions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-control filter-search"
            />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="form-control filter-select"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {filteredProducts.length === 0 ? (
            <p className="empty-state">No products found matching your search or filter.</p>
          ) : (
            <div className="product-grid">
              {filteredProducts.map((product) => (
                <article key={product.id} className="product-card">
                  <div>
                    <div className="product-media-box">
                      {product.image ? (
                        <img
                          src={getImageUrl(product.image)}
                          alt={product.name}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                          className="product-image"
                        />
                      ) : (
                        <span className="product-placeholder">No Image Added</span>
                      )}
                    </div>

                    <h3 className="product-title">{product.name}</h3>
                    <p className="product-desc">{product.description}</p>

                    <div className="price-row">
                      <p className="product-price">₹{product.price}</p>
                      <span className="delivery-tag">Free Delivery</span>
                    </div>

                    <p
                      className={`product-stock ${
                        product.stock_quantity > 0 ? 'in-stock' : 'out-of-stock'
                      }`}
                    >
                      {product.stock_quantity > 0
                        ? `In Stock (${product.stock_quantity} left)`
                        : 'Out of Stock'}
                    </p>
                  </div>

                  <button
                    onClick={() => addToCart(product)}
                    disabled={product.stock_quantity <= 0}
                    className="add-cart-btn"
                  >
                    {product.stock_quantity > 0 ? 'Add to Cart' : 'Sold Out'}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* VIEW 2: CART & CHECKOUT */}
      {view === 'cart' && (
        <section className="section-card">
          <div className="catalog-topbar">
            <h2 className="section-heading">Your Shopping Cart</h2>
            <span className="result-count-pill">{cartCount} Items</span>
          </div>

          {cartItems.length === 0 ? (
            <p className="empty-state">Your cart is empty. Browse the catalog to add items.</p>
          ) : (
            <div>
              {cartItems.map((item) => (
                <div key={item.id} className="cart-item-row">
                  <div>
                    <h4 style={{ margin: '0 0 4px' }}>
                      {item.product_name} (x{item.quantity})
                    </h4>
                    <p style={{ margin: 0, color: '#15803d', fontWeight: 700 }}>
                      ₹{item.product_price} each — Subtotal: ₹{item.subtotal}
                    </p>
                  </div>
                  <button onClick={() => removeFromCart(item.id)} className="remove-btn">
                    Remove
                  </button>
                </div>
              ))}
              <div className="cart-summary">
                <h3 style={{ margin: 0 }}>Total Payable: ₹{calculateTotal()}</h3>
                <button onClick={handleCheckout} className="checkout-btn">
                  Place Order
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* VIEW 3: MY ORDERS */}
      {view === 'orders' && (
        <section className="section-card">
          <div className="catalog-topbar">
            <h2 className="section-heading">My Order History</h2>
            <span className="result-count-pill">{orders.length} Orders</span>
          </div>

          {orders.length === 0 ? (
            <p className="empty-state">You haven't placed any orders yet.</p>
          ) : (
            <div className="orders-list">
              {orders.map((order) => (
                <div key={order.id} className="order-card">
                  <div>
                    <h4 style={{ margin: '0 0 5px' }}>Order #{order.id}</h4>
                    <p style={{ margin: 0, color: '#4b5563' }}>
                      Total Paid: <strong>₹{order.total_amount}</strong>
                    </p>
                  </div>
                  <span className="status-badge">{order.status || 'CONFIRMED'}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* VIEW 4: LOGIN */}
      {view === 'login' && (
        <div className="form-card">
          <h2 className="section-heading">Login to Your Account</h2>
          <form onSubmit={handleLogin} className="styled-form">
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="form-control"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="form-control"
            />
            <button type="submit" className="submit-btn">
              Login
            </button>
          </form>
        </div>
      )}

      {/* VIEW 5: REGISTER */}
      {view === 'register' && (
        <div className="form-card">
          <h2 className="section-heading">Create Account</h2>
          <form onSubmit={handleRegister} className="styled-form">
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="form-control"
            />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="form-control"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="form-control"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="form-control"
            >
              <option value="CUSTOMER">Customer</option>
              <option value="VENDOR">Vendor</option>
            </select>
            <button type="submit" className="submit-btn">
              Register
            </button>
          </form>
        </div>
      )}

      {/* VIEW 6: ADD PRODUCT (VENDOR) */}
      {view === 'add-product' && (
        <div className="form-card">
          <h2 className="section-heading">Add New Product (Vendor Portal)</h2>
          <form onSubmit={handleAddProduct} className="styled-form">
            <input
              type="text"
              placeholder="Product Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="form-control"
            />
            <textarea
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="form-control form-textarea"
            />
            <input
              type="number"
              placeholder="Price (₹)"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
              className="form-control"
            />
            <input
              type="number"
              placeholder="Stock Quantity"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              required
              className="form-control"
            />
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="form-control"
            >
              <option value="">Select Category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            <div>
              <label className="file-label">Product Image (Optional)</label>
              <input
                key={fileInputKey}
                type="file"
                accept="image/*"
                onChange={(e) => setProductImage(e.target.files?.[0] || null)}
                className="form-control"
              />
            </div>
            <button type="submit" className="submit-btn">
              Create Product
            </button>
          </form>
        </div>
      )}

      {/* VIEW 7: USER PROFILE DETAILS */}
      {view === 'profile' && (
        <div className="profile-card">
          <div className="profile-header">
            <div className="profile-avatar-lg">
              {(profile?.username?.[0] || 'U').toUpperCase()}
            </div>
            <div>
              <h2 style={{ margin: 0 }}>{profile?.username || 'User Profile'}</h2>
              <span className="role-badge">{profile?.role || 'USER'}</span>
            </div>
          </div>

          {profile ? (
            <>
              <div className="profile-meta-box">
                <p style={{ margin: 0 }}>
                  <strong>Username:</strong> {profile.username}
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Email:</strong> {profile.email || 'Not set'}
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Role:</strong> {profile.role}
                </p>
                {profile.role === 'VENDOR' && (
                  <>
                    <p style={{ margin: 0 }}>
                      <strong>Store Name:</strong> {profile.store_name || 'Not configured'}
                    </p>
                    <p style={{ margin: 0 }}>
                      <strong>Vendor Status:</strong>{' '}
                      {profile.is_approved ? 'Approved' : 'Pending Approval'}
                    </p>
                  </>
                )}
              </div>

              <form onSubmit={handleSaveProfile} className="styled-form">
                <input
                  type="email"
                  placeholder="Email"
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                  className="form-control"
                />
                <input
                  type="text"
                  placeholder="Phone Number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="form-control"
                />
                <textarea
                  placeholder="Address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="form-control form-textarea"
                />
                <input
                  type="text"
                  placeholder="City"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="form-control"
                />
                <input
                  type="text"
                  placeholder="Pincode"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  className="form-control"
                />
                <button type="submit" className="submit-btn">
                  Save Profile Changes
                </button>
              </form>

              {profile.role === 'VENDOR' && (
                <div className="vendor-products-section">
                  <div className="vendor-products-header">
                    <h3 style={{ margin: 0, fontSize: '16px' }}>My Added Products</h3>
                    <span className="result-count-pill">
                      {(profile.products || []).length}{' '}
                      {(profile.products || []).length === 1 ? 'Product' : 'Products'}
                    </span>
                  </div>

                  {!profile.products || profile.products.length === 0 ? (
                    <p className="empty-state">
                      You haven't added any products yet.{' '}
                      <button
                        type="button"
                        onClick={() => setView('add-product')}
                        className="nav-btn"
                        style={{ marginLeft: '6px' }}
                      >
                        + Add First Product
                      </button>
                    </p>
                  ) : (
                    <div className="vendor-product-list">
                      {profile.products.map((item) => (
                        <div key={item.id} className="vendor-product-item">
                          <div className="vendor-product-left">
                            {item.image && (
                              <img
                                src={getImageUrl(item.image)}
                                alt={item.name}
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                                className="vendor-product-thumb"
                              />
                            )}
                            <div className="vendor-product-info">
                              <h4>{item.name}</h4>
                              <p>
                                ₹{item.price} • Stock: {item.stock_quantity}
                                {item.category_name ? ` • ${item.category_name}` : ''}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`status-badge ${
                              item.stock_quantity > 0 ? '' : 'sold-out-badge'
                            }`}
                          >
                            {item.stock_quantity > 0 ? 'Active' : 'Sold Out'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="empty-state">Loading profile details...</p>
          )}
        </div>
      )}
    </div>
  );
}

export default App;