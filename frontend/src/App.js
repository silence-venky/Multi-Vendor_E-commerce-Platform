import React, { useEffect, useState } from 'react';
import { getProducts, getCategories, loginUser, registerUser, createProduct, createOrder, getOrders } from './services/api';
import './App.css';

function App() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [orders, setOrders] = useState([]);
  const [view, setView] = useState('catalog'); 
  const [token, setToken] = useState(localStorage.getItem('access-token') || '');
  const [cart, setCart] = useState([]);

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

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  const fetchProducts = () => {
    getProducts()
      .then(res => setProducts(res.data))
      .catch(err => console.error("Error fetching products:", err));
  };

  const fetchCategories = () => {
    getCategories()
      .then(res => setCategories(res.data))
      .catch(err => console.error("Error fetching categories:", err));
  };

  const fetchOrders = () => {
    getOrders()
      .then(res => setOrders(res.data))
      .catch(err => console.error("Error fetching orders:", err));
  };

  const handleOpenOrders = () => {
    fetchOrders();
    setView('orders');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await loginUser({ username, password });
      localStorage.setItem('access_token', res.data.access);
      setToken(res.data.access);
      alert('Login successful!');
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

  const handleAddProduct = async (e) => {
    e.preventDefault();
    try {
      await createProduct({ 
        name, 
        description, 
        price, 
        stock_quantity: stock, 
        category: categoryId ? parseInt(categoryId) : null 
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

  const addToCart = (product) => {
    if (product.stock_quantity <= 0) {
      alert('Sorry, this item is out of stock!');
      return;
    }
    setCart([...cart, product]);
    alert(`${product.name} added to cart!`);
  };

  const removeFromCart = (index) => {
    const newCart = cart.filter((_, i) => i !== index);
    setCart(newCart);
  };

  const calculateTotal = () => {
    return cart.reduce((total, item) => total + parseFloat(item.price), 0).toFixed(2);
  };

  const handleCheckout = async () => {
    if (!token) {
      alert('Please log in to place an order.');
      setView('login');
      return;
    }
    if (cart.length === 0) {
      alert('Your cart is empty.');
      return;
    }

    try {
      const total_amount = calculateTotal();
      const itemIds = cart.map(item => item.id);
      await createOrder({ total_amount, items: itemIds });
      alert('Order placed successfully!');
      setCart([]);
      fetchProducts(); 
      handleOpenOrders(); 
    } catch (err) {
      console.error("Order error:", err);
      alert('Failed to place order.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    setToken('');
    setCart([]);
    setOrders([]);
    setView('catalog');
    alert('Logged out successfully.');
  };

  // Filter logic for search and category
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          product.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === '' || product.category === parseInt(selectedCategory);
    return matchesSearch && matchesCategory;
  });

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eaeaea', paddingBottom: '10px', marginBottom: '20px' }}>
        <div>
          <h1>🛒 Multi-Vendor E-Commerce Platform</h1>
          <p style={{ margin: 0, color: '#666' }}>Django REST + React + MySQL Full-Stack App</p>
        </div>
        <div>
          <button onClick={() => setView('catalog')} style={navBtnStyle}>Catalog</button>
          <button onClick={() => setView('cart')} style={navBtnStyle}>Cart ({cart.length})</button>
          {token ? (
            <>
              <button onClick={handleOpenOrders} style={navBtnStyle}>My Orders</button>
              <button onClick={() => setView('add-product')} style={navBtnStyle}>Add Product (Vendor)</button>
              <button onClick={handleLogout} style={{ ...navBtnStyle, backgroundColor: '#e74c3c', color: 'white' }}>Logout</button>
            </>
          ) : (
            <>
              <button onClick={() => setView('login')} style={navBtnStyle}>Login</button>
              <button onClick={() => setView('register')} style={navBtnStyle}>Register</button>
            </>
          )}
        </div>
      </header>

      {/* VIEW 1: CATALOG */}
      {view === 'catalog' && (
        <div>
          <h2>Product Catalog</h2>

          {/* Search & Filter Bar */}
          <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
            <input 
              type="text" 
              placeholder="Search products..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
              style={{ ...inputStyle, flex: 2 }} 
            />
            <select 
              value={selectedCategory} 
              onChange={e => setSelectedCategory(e.target.value)} 
              style={{ ...inputStyle, flex: 1 }}
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          {filteredProducts.length === 0 ? (
            <p>No products found matching your search or filter.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
              {filteredProducts.map(product => (
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
          {cart.length === 0 ? (
            <p>Your cart is empty. Browse the catalog to add items.</p>
          ) : (
            <div>
              {cart.map((item, index) => (
                <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', padding: '10px 0' }}>
                  <div>
                    <h4>{item.name}</h4>
                    <p style={{ margin: 0, color: '#2ecc71' }}>₹{item.price}</p>
                  </div>
                  <button onClick={() => removeFromCart(index)} style={{ backgroundColor: '#e74c3c', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>Remove</button>
                </div>
              ))}
              <div style={{ marginTop: '20px', textAlign: 'right' }}>
                <h3>Total Amount: ₹{calculateTotal()}</h3>
                <button onClick={handleCheckout} style={{ padding: '10px 20px', backgroundColor: '#2ecc71', color: 'white', border: 'none', borderRadius: '4px', fontSize: '16px', cursor: 'pointer' }}>Place Order</button>
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
              {orders.map(order => (
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
            <input type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} required style={inputStyle} />
            <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required style={inputStyle} />
            <button type="submit" style={submitBtnStyle}>Login</button>
          </form>
        </div>
      )}

      {/* VIEW 5: REGISTER */}
      {view === 'register' && (
        <div style={formContainerStyle}>
          <h2>Register</h2>
          <form onSubmit={handleRegister} style={formStyle}>
            <input type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} required style={inputStyle} />
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} />
            <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required style={inputStyle} />
            <select value={role} onChange={e => setRole(e.target.value)} style={inputStyle}>
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
            <input type="text" placeholder="Product Name" value={name} onChange={e => setName(e.target.value)} required style={inputStyle} />
            <textarea placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} required style={{ ...inputStyle, height: '80px' }} />
            <input type="number" placeholder="Price (₹)" value={price} onChange={e => setPrice(e.target.value)} required style={inputStyle} />
            <input type="number" placeholder="Stock Quantity" value={stock} onChange={e => setStock(e.target.value)} required style={inputStyle} />
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)} style={inputStyle}>
              <option value="">Select Category</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            <button type="submit" style={submitBtnStyle}>Create Product</button>
          </form>
        </div>
      )}
    </div>
  );
}

// Styling helpers
const navBtnStyle = { marginLeft: '10px', padding: '8px 15px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: '#f9f9f9' };
const formContainerStyle = { maxWidth: '400px', margin: '40px auto', padding: '20px', border: '1px solid #ddd', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' };
const formStyle = { display: 'flex', flexDirection: 'column', gap: '15px' };
const inputStyle = { padding: '10px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '14px' };
const submitBtnStyle = { padding: '10px', backgroundColor: '#3498db', color: 'white', border: 'none', borderRadius: '4px', fontSize: '16px', cursor: 'pointer' };
const addCartBtnStyle = { padding: '8px', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '10px' };

export default App;