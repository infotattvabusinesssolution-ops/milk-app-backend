# API Endpoints

A comprehensive list of all the API endpoints for the backend, organized by their core modules, along with their functional descriptions.

All endpoints are prefixed with the base path: `/api/v1`

## 1. Authentication (`/api/v1/auth`)
- `POST /admin-login` - Authenticate an admin user and return a JWT token.
- `POST /firebase-sync` - Sync or create a user in the MongoDB database using their Firebase phone/email Authentication details.

## 2. Public (`/api/v1/public`) - *No authentication required*
- `GET /categories` - Retrieve a list of all active product categories.
- `GET /products` - Retrieve a list of all active products for the catalog.
- `GET /products/:id` - Fetch detailed information about a specific product.
- `GET /subscription-plans` - List available subscription plans and their configurations.

## 3. Customer (`/api/v1/customer`) - *Requires Customer Auth (`role: customer`)*

### Profile & Addresses
- `GET /me` - Retrieve the currently logged-in customer's profile.
- `PATCH /me` - Update the customer's personal details (name, email, phone).
- `POST /addresses` - Add a new delivery address to the customer's profile.
- `PUT /addresses/:id` - Update an existing delivery address.
- `DELETE /addresses/:id` - Remove a delivery address from the customer's profile.

### Products & Subscriptions
- `GET /products` - Browse the catalog of active products.
- `GET /subscriptions` - Retrieve a list of the customer's active subscriptions (excluding pending/one-time).
- `POST /subscriptions` - Create a new subscription for a product.
- `PATCH /subscriptions/:id/pause` - Pause an active subscription starting from a specific date.
- `PATCH /subscriptions/:id/resume` - Resume a paused subscription and regenerate missing deliveries.
- `PATCH /subscriptions/:id/auto-renew` - Toggle the auto-renewal status for a subscription.
- `POST /subscriptions/:id/renew` - Manually trigger a renewal for an expiring subscription.
- `DELETE /subscriptions/:id` - Cancel and delete a subscription along with upcoming scheduled deliveries.

### Deliveries & Orders
- `GET /deliveries` - View a chronological list of upcoming and past scheduled deliveries.
- `GET /orders` - Retrieve the customer's order history.

### Wallet & Payments
- `GET /payments` - Retrieve the customer's payment history.
- `GET /wallet/transactions` - View wallet transaction history (credits and debits).
- `POST /wallet/topup` - Initiate a Razorpay payment to add money to the digital wallet.

## 4. Payments (`/api/v1/payments`) - *Requires Customer Auth*
- `POST /create-order` - Generate a Razorpay order ID for a new subscription or top-up.
- `POST /verify` - Verify the Razorpay payment signature and activate the associated subscription/order.
- `POST /demo-success` - Mock a successful payment (used strictly in development/test mode).

## 5. Delivery Partner (`/api/v1/partner`) - *Requires Partner Auth (`role: partner`)*
- `GET /profile` - Retrieve the delivery partner's profile information.
- `POST /profile-pic` - Upload or update the partner's profile picture.
- `PATCH /availability` - Toggle the partner's online/offline status for receiving assignments.
- `GET /deliveries` - Get a list of assigned deliveries (can be filtered by status like `pending`, `delivered`).
- `PATCH /deliveries/:id/status` - Update the status of a delivery (e.g. `picked_up`, `delivered`, `failed`).
- `GET /earnings` - View the partner's delivery earnings and statistics for the period.

## 6. Admin (`/api/v1/admin`) - *Requires Admin Auth (`role: admin`)*

### Dashboard & Users
- `GET /dashboard` - Retrieve overall metrics (revenue, active subscriptions, total users, delivery success rate).
- `GET /users` - List all registered users (can be filtered by `customer`, `partner`, or `admin` role).

### Catalog Management
- `GET /categories` - List all categories including inactive ones.
- `POST /categories` - Create a new product category.
- `PATCH /categories/:id` - Update an existing product category.
- `DELETE /categories/:id` - Delete a product category.
- `GET /products` - List all products including inactive ones.
- `POST /products` - Create a new product.
- `PATCH /products/:id` - Update an existing product.
- `DELETE /products/:id` - Delete a product.
- `GET /subscription-plans` - List all subscription plans.
- `POST /subscription-plans` - Create a new subscription plan.
- `PATCH /subscription-plans/:id` - Update an existing subscription plan.
- `DELETE /subscription-plans/:id` - Delete a subscription plan.

### Subscriptions Management
- `GET /active-subscriptions` - Retrieve a list of all active subscriptions for administrative monitoring.
- `PATCH /active-subscriptions/:id/assign-partner` - Manually assign a delivery partner to a specific subscription's route.
- `PATCH /active-subscriptions/:id/slot` - Update the preferred delivery time slot for a subscription.
- `PATCH /active-subscriptions/:id/pause` - Administrative override to pause a customer's subscription.
- `PATCH /active-subscriptions/:id/resume` - Administrative override to resume a customer's subscription.

### Delivery Logistics
- `GET /deliveries` - View a master list of all global deliveries for the day.
- `PATCH /deliveries/:id` - Update the payload of a specific delivery record.
- `PATCH /deliveries/:id/assign` - Re-assign a specific delivery to a different delivery partner.
- `PATCH /deliveries/:id/note` - Attach internal administrative notes to a delivery record.
- `PATCH /deliveries/:id/slot` - Override the time slot for a specific delivery.
- `PATCH /deliveries/:id/status` - Force-update a delivery status manually.
- `PATCH /deliveries/:id/reschedule` - Reschedule a failed or missed delivery for a later date.
