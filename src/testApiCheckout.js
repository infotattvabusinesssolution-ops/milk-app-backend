import axios from 'axios';

const testApiCheckout = async () => {
  try {
    // 1. Login as customer to get token
    const loginRes = await axios.post('http://localhost:5000/api/v1/public/login', {
      email: 'customer@milkmen.com',
      password: 'password123'
    });
    const token = loginRes.data.token;
    console.log('Got token:', token);
    
    const api = axios.create({
      baseURL: 'http://localhost:5000/api/v1',
      headers: { Authorization: `Bearer ${token}` }
    });

    // 2. Fetch products
    const prodRes = await api.get('/customer/products');
    const product = prodRes.data.data[0];
    
    // 3. Create address
    const addrRes = await api.post('/customer/addresses', {
      street: '123 Test St', city: 'Test City', zip: '12345'
    });
    const addressId = addrRes.data.data._id;
    console.log('Created address:', addressId);
    
    // 4. Checkout
    const cart = [{
      product: product,
      quantity: 1,
      purchaseType: 'onetime',
      price: 150
    }];

    const checkoutRes = await api.post('/customer/checkout', {
      items: cart,
      addressId,
      paymentMethod: 'cod'
    });
    
    console.log('Checkout success:', checkoutRes.data);
    
    // 5. Fetch deliveries
    const delivRes = await api.get('/customer/deliveries');
    console.log('Deliveries:', delivRes.data.data.length);
    
  } catch (error) {
    console.error('API Error:', error.response?.data || error.message);
  }
};

testApiCheckout();
