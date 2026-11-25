import React, { useEffect, useState } from 'react';
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

const emptyCart = { items: [], total_amount: 0 };

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

  const syncProfileState = (profileData) => {
    setProfile(profileData);
    setProfileEmail(profileData?.email || '');
    setPhone(profileData?.phone || '');
    setAddress(profileData?.address || '');
    setCity(profileData?.city || '');
    setPincode(profileData?.pincode || '');
  };

  const fetchSessionData = async () => {
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
  };

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  // Runs on initial page load / refresh and whenever login token changes
  useEffect(() => {
    if (token) {
      fetchSessionData();
    } else {
      setProfile(null);
      setCart(emptyCart);
    }
  }, [token]);

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
      await createProduct({
        name,
        description,
        price,
        stock_quantity: stock,
        category: categoryId ? parseInt(categoryId) : null,
      });
      alert('Product created successfully!');
      setName('');
      setDescription('');
      setPrice('');
      setStock('');
      setCategoryId('');
      fetchProducts();
      setView('catalog');
    } catch (err) {
      alert('Failed to create product. Ensure you are logged in as a Vendor with an approved profile.');
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
      selectedCategory === '' || product.category === parseInt(selectedCategory);
    return matchesSearch && matchesCategory;
  });

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eaeaea', paddingBottom: '12px', marginBottom: '20px', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0 }}>🛒 Multi-Vendor E-Commerce Platform</h1>
          <p style={{ margin: '4px 0 0 0', color: '#666' }}>Django REST + React + MySQL Full-Stack App</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <button onClick={() => setView('catalog')} style={navBtnStyle}>Catalog</button>
          <button onClick={() => setView('cart')} style={navBtnStyle}>Cart ({cartCount})</button>
          {token ? (
            <>
              <button onClick={handleOpenOrders} style={navBtnStyle}>My Orders</button>
              <button onClick={() => setView('add-product')} style={navBtnStyle}>Add Product (Vendor)</button>
              <button
                onClick={handleOpenProfile}
                title="View User Profile"
                style={profileIconBtnStyle}
              >
                <span style={avatarCircleStyle}>
                  {(profile?.username?.[0] || 'U').toUpperCase()}
                </span>
                <span>{profile?.username || 'Profile'}</span>
              </button>
              <button onClick={handleLogout} style={{ ...navBtnStyle, backgroundColor: '#e74c3c', color: 'white', borderColor: '#e74c3c' }}>
                Logout
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setView('login')} style={navBtnStyle}>Login</button>
              <button onClick={() => setView('register')} style={navBtnStyle}>Register</button>
            </>
          )}
        </div>
      </header>

      {statusMessage && (
        <div style={{ backgroundColor: '#fff3cd', color: '#856404', padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', border: '1px solid #ffeeba' }}>
          {statusMessage}
        </div>
      )}

      {/* VIEW 1: CATALOG */}
      {view === 'catalog' && (
        <div>
          <h2>Product Catalog</h2>

          <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ ...inputStyle, flex: 2 }}
            />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          {filteredProducts.length === 0 ? (
            <p>No products found matching your search or filter.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
              {filteredProducts.map((product) => (
                <div key={product.id} style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '15px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <h3>{product.name}</h3>
                    <p style={{ color: '#555', fontSize: '14px' }}>{product.description}</p>
                    <p style={{ fontWeight: 'bold', color: '#2ecc71', fontSize: '18px' }}>₹{product.price}</p>
                    <p style={{ fontSize: '12px', color: product.stock_quantity > 0 ? '#888' : 'red' }}>
                      {product.stock_quantity > 0 ? `Stock: ${product.stock_quantity}` : 'Out of Stock'}
                    </p>
                  </div>
                  <button
                    onClick={() => addToCart(product)}
                    disabled={product.stock_quantity <= 0}
                    style={{ ...addCartBtnStyle, backgroundColor: product.stock_quantity > 0 ? '#f39c12' : '#ccc' }}
                  >
                    {product.stock_quantity > 0 ? 'Add to Cart' : 'Sold Out'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: CART & CHECKOUT */}
      {view === 'cart' && (
        <div>
          <h2>Your Shopping Cart</h2>
          {cartItems.length === 0 ? (
            <p>Your cart is empty. Browse the catalog to add items.</p>
          ) : (
            <div>
              {cartItems.map((item) => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', padding: '10px 0' }}>
                  <div>
                    <h4>{item.product_name} (x{item.quantity})</h4>
                    <p style={{ margin: 0, color: '#2ecc71' }}>
                      ₹{item.product_price} each — Subtotal: ₹{item.subtotal}
                    </p>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    style={{ backgroundColor: '#e74c3c', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <div style={{ marginTop: '20px', textAlign: 'right' }}>
                <h3>Total Amount: ₹{calculateTotal()}</h3>
                <button
                  onClick={handleCheckout}
                  style={{ padding: '10px 20px', backgroundColor: '#2ecc71', color: 'white', border: 'none', borderRadius: '4px', fontSize: '16px', cursor: 'pointer' }}
                >
                  Place Order
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: MY ORDERS */}
      {view === 'orders' && (
        <div>
          <h2>My Order History</h2>
          {orders.length === 0 ? (
            <p>You haven't placed any orders yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {orders.map((order) => (
                <div key={order.id} style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ margin: '0 0 5px 0' }}>Order #{order.id}</h4>
                    <p style={{ margin: 0, color: '#555' }}>Total Paid: <strong>₹{order.total_amount}</strong></p>
                  </div>
                  <span style={{ padding: '5px 12px', borderRadius: '12px', backgroundColor: '#eafaf1', color: '#2ecc71', fontWeight: 'bold', fontSize: '12px' }}>
                    {order.status || 'CONFIRMED'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW 4: LOGIN */}
      {view === 'login' && (
        <div style={formContainerStyle}>
          <h2>Login</h2>
          <form onSubmit={handleLogin} style={formStyle}>
            <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required style={inputStyle} />
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required style={inputStyle} />
            <button type="submit" style={submitBtnStyle}>Login</button>
          </form>
        </div>
      )}

      {/* VIEW 5: REGISTER */}
      {view === 'register' && (
        <div style={formContainerStyle}>
          <h2>Register</h2>
          <form onSubmit={handleRegister} style={formStyle}>
            <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required style={inputStyle} />
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required style={inputStyle} />
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required style={inputStyle} />
            <select value={role} onChange={(e) => setRole(e.target.value)} style={inputStyle}>
              <option value="CUSTOMER">Customer</option>
              <option value="VENDOR">Vendor</option>
            </select>
            <button type="submit" style={submitBtnStyle}>Register</button>
          </form>
        </div>
      )}

      {/* VIEW 6: ADD PRODUCT (VENDOR) */}
      {view === 'add-product' && (
        <div style={formContainerStyle}>
          <h2>Add New Product (Vendor Portal)</h2>
          <form onSubmit={handleAddProduct} style={formStyle}>
            <input type="text" placeholder="Product Name" value={name} onChange={(e) => setName(e.target.value)} required style={inputStyle} />
            <textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} required style={{ ...inputStyle, height: '80px' }} />
            <input type="number" placeholder="Price (₹)" value={price} onChange={(e) => setPrice(e.target.value)} required style={inputStyle} />
            <input type="number" placeholder="Stock Quantity" value={stock} onChange={(e) => setStock(e.target.value)} required style={inputStyle} />
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={inputStyle}>
              <option value="">Select Category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            <button type="submit" style={submitBtnStyle}>Create Product</button>
          </form>
        </div>
      )}

      {/* VIEW 7: USER PROFILE DETAILS */}
      {view === 'profile' && (
        <div style={profileCardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px', borderBottom: '1px solid #eee', paddingBottom: '14px' }}>
            <div style={largeAvatarStyle}>
              {(profile?.username?.[0] || 'U').toUpperCase()}
            </div>
            <div>
              <h2 style={{ margin: 0 }}>{profile?.username || 'User Profile'}</h2>
              <span style={roleBadgeStyle}>{profile?.role || 'USER'}</span>
            </div>
          </div>

          {profile ? (
            <>
              <div style={{ marginBottom: '16px', lineHeight: '1.7', fontSize: '14px' }}>
                <p style={{ margin: 0 }}><strong>Username:</strong> {profile.username}</p>
                <p style={{ margin: 0 }}><strong>Email:</strong> {profile.email || 'Not set'}</p>
                <p style={{ margin: 0 }}><strong>Role:</strong> {profile.role}</p>
                {profile.role === 'VENDOR' && (
                  <>
                    <p style={{ margin: 0 }}><strong>Store Name:</strong> {profile.store_name || 'Not configured'}</p>
                    <p style={{ margin: 0 }}>
                      <strong>Vendor Status:</strong> {profile.is_approved ? 'Approved' : 'Pending Approval'}
                    </p>
                  </>
                )}
              </div>

              <form onSubmit={handleSaveProfile} style={formStyle}>
                <input type="email" placeholder="Email" value={profileEmail} onChange={(e) => setProfileEmail(e.target.value)} style={inputStyle} />
                <input type="text" placeholder="Phone Number" value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} />
                <textarea placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} style={{ ...inputStyle, height: '70px' }} />
                <input type="text" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} style={inputStyle} />
                <input type="text" placeholder="Pincode" value={pincode} onChange={(e) => setPincode(e.target.value)} style={inputStyle} />
                <button type="submit" style={submitBtnStyle}>Save Profile Changes</button>
              </form>
            </>
          ) : (
            <p>Loading profile details...</p>
          )}
        </div>
      )}
    </div>
  );
}

// Styling helpers
const navBtnStyle = { padding: '8px 14px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: '#f9f9f9' };
const profileIconBtnStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  padding: '6px 12px',
  cursor: 'pointer',
  borderRadius: '20px',
  border: '1px solid #3498db',
  backgroundColor: '#eef7fd',
  color: '#1f5f8b',
  fontWeight: 'bold',
};
const avatarCircleStyle = {
  width: '24px',
  height: '24px',
  borderRadius: '50%',
  backgroundColor: '#3498db',
  color: 'white',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '12px',
};
const largeAvatarStyle = {
  width: '52px',
  height: '52px',
  borderRadius: '50%',
  backgroundColor: '#3498db',
  color: 'white',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '22px',
  fontWeight: 'bold',
};
const roleBadgeStyle = {
  display: 'inline-block',
  marginTop: '4px',
  padding: '2px 10px',
  borderRadius: '12px',
  backgroundColor: '#eafaf1',
  color: '#2ecc71',
  fontSize: '12px',
  fontWeight: 'bold',
};
const profileCardStyle = { maxWidth: '460px', margin: '30px auto', padding: '24px', border: '1px solid #ddd', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', backgroundColor: '#fff' };
const formContainerStyle = { maxWidth: '400px', margin: '40px auto', padding: '20px', border: '1px solid #ddd', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' };
const formStyle = { display: 'flex', flexDirection: 'column', gap: '15px' };
const inputStyle = { padding: '10px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '14px' };
const submitBtnStyle = { padding: '10px', backgroundColor: '#3498db', color: 'white', border: 'none', borderRadius: '4px', fontSize: '16px', cursor: 'pointer' };
const addCartBtnStyle = { padding: '8px', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '10px' };

export default App;