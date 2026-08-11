# Milk Men Backend API Endpoints

This document describes the HTTP API implemented in `src/app.js` and `src/routes/*.routes.js`.

It covers all 88 currently registered HTTP endpoints: 1 general, 3 authentication, 6 public, 23 customer, 3 payment, 6 delivery-partner, 8 farmer, and 38 admin endpoints.

## Base URL and conventions

- Local server: `http://localhost:5000`
- API prefix: `/api/v1`
- Default port: `5000` (override with the `PORT` environment variable).
- JSON request header: `Content-Type: application/json`
- Authenticated request header: `Authorization: Bearer <jwt>`
- Upload endpoints use `multipart/form-data` instead of JSON.
- Dates should be valid JavaScript/ISO-8601 date values, preferably `YYYY-MM-DD` or a full ISO timestamp.
- Money values are in INR. Razorpay order amounts returned as `amount` are in paise; application totals such as `totalAmount` and `payableAmount` are in rupees.

Most successful responses use:

```json
{
  "success": true,
  "data": {}
}
```

Most errors use:

```json
{
  "success": false,
  "message": "Human-readable error message",
  "details": null
}
```

Common error codes are `400` for invalid input, `401` for missing/invalid JWTs, `403` for the wrong role, `404` for missing records/routes, `409` for a wallet balance conflict, and `500` for unexpected failures.

## Roles

| Role | Protected route prefix |
| --- | --- |
| Customer | `/api/v1/customer`, `/api/v1/payments` |
| Delivery partner | `/api/v1/partner` |
| Farmer | `/api/v1/farmer` |
| Admin | `/api/v1/admin` |

`DELETE /api/v1/auth/account` accepts any valid authenticated role. Public and authentication endpoints do not otherwise require a JWT.

## Important status values

- User: `active`, `pending`, `blocked`, `deleted`
- Subscription: `pending_payment`, `active`, `paused`, `expired`, `cancelled`
- Delivery: `pending_payment`, `scheduled`, `assigned`, `picked_up`, `out_for_delivery`, `delivered`, `failed`, `rescheduled`, `cancelled`
- Payment: `created`, `paid`, `failed`, `refunded`
- Farmer KYC: `pending`, `approved`, `rejected`
- Milk collection: `initiated`, `in_progress`, `collected`, `rejected`
- Contact inquiry: `new`, `read`, `resolved`

## Delivery frequency API map

There is currently no standalone `/delivery-frequency` endpoint or separate frequency collection. Delivery frequency is embedded in Product, SubscriptionPlan, and Subscription records and is handled through the following endpoints.

### Read available frequencies

| Endpoint | What it provides |
| --- | --- |
| `GET /api/v1/public/products` | Active products with their embedded `frequencies` arrays. |
| `GET /api/v1/public/products/:id` | One active product and its `frequencies`. |
| `GET /api/v1/customer/products` | Authenticated customer product list with `frequencies`. |
| `GET /api/v1/public/subscription-plans` | Active plans with `frequency`, `selectedWeekdays`, delivery count, and duration. |
| `GET /api/v1/admin/subscription-plans` | All plan frequency configurations for admin. |

A product frequency entry has this shape:

```json
{
  "name": "Daily",
  "subtitle": "Delivered every morning",
  "badge": "Popular",
  "days": 30
}
```

`name` and `days` are required when storing a product frequency. Product frequencies are display/purchase options; the actual generated delivery dates come from the Subscription fields described below.

### Create or update product frequency options

Use these admin product endpoints:

- `POST /api/v1/admin/products`
- `PATCH /api/v1/admin/products/:id`

Both accept a `frequencies` array. With `multipart/form-data`, send it as a JSON-encoded string:

```json
[
  { "name": "Daily", "subtitle": "Every day", "badge": "Best value", "days": 30 },
  { "name": "Weekly", "subtitle": "7-day pack", "days": 7 }
]
```

Updating the product replaces/updates its embedded frequency array; there are no separate create, update, or delete routes for a single frequency entry.

### Create or update subscription-plan frequencies

Use these admin plan endpoints:

- `POST /api/v1/admin/subscription-plans`
- `PATCH /api/v1/admin/subscription-plans/:id`

Frequency-related plan fields:

| Field | Accepted values | Purpose |
| --- | --- | --- |
| `frequency` | `Everyday`, `Selected Weekdays`, `Weekly`, `Monthly` | Required plan frequency label/rule. |
| `selectedWeekdays` | Weekday-name array | Days used when frequency is `Selected Weekdays`. |
| `maxDaysPerWeek` | Number | Plan configuration/display limit; not independently enforced by delivery generation. |
| `billingCycle` | `weekly`, `monthly` | Controls the subscription billing cycle created at checkout. |
| `totalDeliveries` | Positive number | Number of deliveries included in the plan. |
| `durationDays` | Number | Calendar window used to calculate the checkout end date. |

Valid weekday names are `Monday`, `Tuesday`, `Wednesday`, `Thursday`, `Friday`, `Saturday`, and `Sunday`. They are case-sensitive in the Mongoose enum and delivery-generation comparison.

Example:

```json
{
  "frequency": "Selected Weekdays",
  "selectedWeekdays": ["Monday", "Wednesday", "Friday"],
  "maxDaysPerWeek": 3,
  "billingCycle": "monthly",
  "totalDeliveries": 12,
  "durationDays": 28
}
```

### Set frequency during customer checkout

The primary endpoint is `POST /api/v1/customer/checkout`.

For a custom subscription item, send:

```json
{
  "purchaseType": "subscription",
  "product": { "_id": "PRODUCT_ID" },
  "quantity": 1,
  "totalAmount": 720,
  "deliveryFrequency": "selected_days",
  "selectedDays": ["Monday", "Wednesday", "Friday"],
  "startDate": "2026-08-12",
  "endDate": "2026-09-11",
  "plan": {
    "cycle": "monthly",
    "billingCycle": "monthly"
  }
}
```

Subscription frequency values are:

- `everyday`: generate a delivery on every date in the subscription window.
- `selected_days`: generate only when the date's weekday appears in `selectedDays`.

When checkout uses a stored `plan._id`, the server does not trust the submitted frequency. It maps the saved plan automatically:

- Plan `frequency: "Selected Weekdays"` becomes `deliveryFrequency: "selected_days"` and copies `selectedWeekdays` to `selectedDays`.
- Every other plan frequency becomes `deliveryFrequency: "everyday"`.

The lower-level `POST /api/v1/customer/subscriptions` endpoint also accepts `deliveryFrequency` and `selectedDays`, but it only creates a Subscription record and does not independently create a payment or deliveries.

### How delivery dates are generated

Delivery creation occurs after successful wallet/payment/COD checkout and again when a paused subscription is resumed.

1. The subscription window is chosen from `startDate` through `endDate`, inclusive.
2. Without `endDate`, the fallback window is 1 day for `daily`, 7 days for `weekly`, 1 day for `onetime`, and 30 days for other cycles.
3. For `everyday`, each date in that window becomes a delivery.
4. For `selected_days`, dates whose weekday is not in `selectedDays` are skipped.
5. Duplicate deliveries for the same subscription and date are skipped.

Frequency and generated results can be read through:

- `GET /api/v1/customer/subscriptions` for the saved subscription frequency settings.
- `GET /api/v1/customer/all-orders` for all saved subscription/order records.
- `GET /api/v1/customer/deliveries` or `GET /api/v1/customer/orders` for the actual generated dates.
- `GET /api/v1/admin/active-subscriptions` and `GET /api/v1/admin/deliveries` for admin views.

There is currently no endpoint to change `deliveryFrequency` or `selectedDays` on an existing subscription. Adding one would require deciding how already-generated future deliveries should be removed and regenerated.

---

## General

### `GET /health`

Auth: Public.

Checks whether the Express application is responding.

Success `200`:

```json
{
  "success": true,
  "service": "milk-men-api"
}
```

---

## Authentication API

Base path: `/api/v1/auth`

### `POST /api/v1/auth/admin-login`

Auth: Public.

Body:

| Field | Required | Description |
| --- | --- | --- |
| `email` | Yes | Admin email address. |
| `password` | Yes | Plain-text password checked against `passwordHash`. |

Finds a user whose role is `admin`, verifies the bcrypt password, and returns a signed application JWT plus the user document. Invalid credentials return `401`.

### `POST /api/v1/auth/firebase-sync`

Auth: Public.

Body:

| Field | Required | Description |
| --- | --- | --- |
| `email` | Conditional | Either email or phone must be supplied. |
| `phone` | Conditional | Either phone or email must be supplied. |
| `name` | No | Used for a new account or to replace the default customer name. |
| `role` | No | Only `farmer` is honored explicitly; all other new users become customers. |

Finds an existing user by email and then phone, or creates one. It can fill missing email/phone data and upgrade an existing customer to farmer when `role` is `farmer`. Returns `{ success, token, user }`.

### `DELETE /api/v1/auth/account`

Auth: Any valid JWT.

Soft-deletes the authenticated account. It sets `status` to `deleted`, prefixes email and phone with a unique deletion marker, and clears FCM tokens. Related database records are preserved.

Success `200` includes `message: "Account deleted successfully"`.

---

## Public API

Base path: `/api/v1/public`

### `GET /api/v1/public/categories`

Auth: Public.

Returns active categories ordered by `displayOrder` ascending.

### `GET /api/v1/public/products`

Auth: Public.

Returns active products, newest first. Category references are not populated on this list endpoint.

### `GET /api/v1/public/products/:id`

Auth: Public.

Path parameter: `id` is a product MongoDB ObjectId.

Returns one active product with its `category` populated. Returns `404` when the product does not exist or is inactive.

### `GET /api/v1/public/subscription-plans`

Auth: Public.

Returns active subscription plans, newest first, with each plan's `product` populated.

### `POST /api/v1/public/contact`

Auth: Public.

Body:

| Field | Required | Description |
| --- | --- | --- |
| `name` | Yes | Sender name. |
| `email` | Yes | Sender email. |
| `phone` | No | Sender phone. |
| `subject` | Yes | Inquiry subject. |
| `message` | Yes | Inquiry message. |

Creates a contact inquiry with default status `new`. Returns the created inquiry with status `201`.

### `GET /api/v1/public/config/:key`

Auth: Public.

Returns only the `value` of the requested `SystemConfig` record. Returns `404` if the key has not been created.

---

## Customer API

Base path: `/api/v1/customer`

Auth: Every endpoint in this section requires a customer JWT.

### Customer profile and addresses

#### `GET /api/v1/customer/me`

Returns the authenticated user as a plain object, plus:

- `hasActiveSubscription`: whether the customer has an active non-one-time subscription.
- `activeSubscriptionId`: that subscription's ID when present.

#### `PATCH /api/v1/customer/me`

Body: User fields to update, such as `name`, `phone`, `email`, or `profilePic`.

Applies the body with MongoDB `$set` and returns the updated user. The current implementation does not whitelist fields.

#### `POST /api/v1/customer/addresses`

Creates an embedded address on the customer account.

Supported address fields: `fullName`, `phone`, `label`, `line1`, `line2`, `landmark`, `city`, `state`, `pincode`, `lat`, `lng`, and `instructions`.

Returns the created address with status `201`.

#### `PUT /api/v1/customer/addresses/:id`

Path parameter: `id` is the embedded address ObjectId.

Body: Any address fields to replace/update. Returns the updated embedded address or `404` if it does not belong to the current user.

#### `DELETE /api/v1/customer/addresses/:id`

Removes the matching embedded address from the authenticated user. Returns `{ "success": true }`, or `404` if the address is missing.

### Customer product and subscription creation

#### `GET /api/v1/customer/products`

Returns all active products. This authenticated list is similar to the public product list.

#### `POST /api/v1/customer/subscriptions`

Creates a raw subscription record.

Body fields correspond to the Subscription model:

| Field | Required | Description |
| --- | --- | --- |
| `product` | Yes | Product ObjectId. |
| `addressId` | Yes | Must match an address owned by the customer. |
| `cycle` | Yes | `daily`, `weekly`, `monthly`, `onetime`, or `custom`. |
| `quantity` | Yes | Minimum model value is `0.5`. |
| `startDate` | Yes | First delivery date. |
| `endDate` | No | Final delivery date. |
| `slot` | No | Defaults to `Pending Allocation`. |
| `deliveryFrequency` | No | `everyday` or `selected_days`. |
| `selectedDays` | No | Array of weekday names. |
| `totalAmount` | No | Subscription total. |
| `autoRenew` | No | Whether renewal is enabled. |

The server always sets `customer` from the JWT. This endpoint only creates the subscription; the combined checkout endpoint handles payments and delivery generation.

#### `POST /api/v1/customer/checkout`

Creates one or more subscriptions/orders, calculates wallet usage, creates a payment, and either creates deliveries immediately or starts Razorpay payment.

Top-level body:

| Field | Required | Description |
| --- | --- | --- |
| `items` | Yes | Non-empty array of checkout items. |
| `addressId` | Yes | Address owned by the customer. |
| `paymentMethod` | Yes | `wallet`, `cod`, or `card`. |
| `useWallet` | No | When exactly `true`, applies available wallet balance before COD/card payment. |
| `isCartCheckout` | No | When truthy, subscription items are removed from the submitted cart. |

A normal checkout item can contain:

```json
{
  "purchaseType": "onetime",
  "product": { "_id": "PRODUCT_ID" },
  "quantity": 2,
  "price": 60,
  "totalAmount": 120,
  "startDate": "2026-08-12"
}
```

A subscription item may also include `purchaseType: "subscription"`, `plan`, `startDate`, `endDate`, `deliveryFrequency`, and `selectedDays`. If `plan._id` is supplied, pricing, product, delivery count, frequency, and billing cycle are reloaded from the active `SubscriptionPlan` in the database instead of trusting client pricing.

Behavior:

- Rejects a new subscription when the customer already has an active non-one-time subscription.
- Uses tomorrow as the default start date.
- Validates positive finite quantities and totals.
- Calculates `walletDeduction = min(walletBalance, totalAmount)` when `useWallet` is enabled.
- For a full wallet payment, marks payment paid, activates subscriptions, and generates deliveries.
- For COD, activates subscriptions and generates deliveries; any selected wallet amount is debited as a discount.
- For card, creates a Razorpay order for the remaining `payableAmount` and leaves subscriptions pending until verification.

Success `201` returns `payment`, `subscriptions`, `totalAmount`, `walletDeduction`, and `payableAmount`. Card responses additionally return `razorpayOrderId` and `amount` in paise.

### Extra milk and customer payment verification

#### `POST /api/v1/customer/subscriptions/:id/extra-milk`

Orders extra milk against an active subscription for a future date.

Body:

```json
{
  "date": "2026-08-15",
  "productId": "PRODUCT_ID",
  "quantity": 1,
  "paymentMethod": "card",
  "useWallet": true
}
```

Rules:

- The subscription must belong to the customer and have status `active`.
- The date must be later than today.
- Quantity and the product's primary variant price must be positive finite numbers.
- `paymentMethod` must be `wallet`, `cod`, or `card`.
- Wallet/COD creates a `scheduled` extra delivery immediately.
- Card creates a `pending_payment` delivery and Razorpay order; verification changes it to `scheduled`.

Success `201` returns the `payment`, `delivery`, rupee totals, wallet deduction, and payable amount. Card responses also include the Razorpay order ID and paise amount.

#### `POST /api/v1/customer/payment/verify`

Verifies Razorpay payment for the customer checkout or extra-milk flow.

Body:

| Field | Required | Description |
| --- | --- | --- |
| `razorpay_order_id` | Yes | Razorpay order ID. |
| `razorpay_payment_id` | Yes | Razorpay payment ID. |
| `razorpay_signature` | Yes | Razorpay signature. |
| `paymentId` | Yes | Internal Payment ObjectId. |

After signature and ownership checks, it debits any deferred wallet amount once, marks the payment paid, and:

- changes pending extra-milk deliveries to `scheduled`, or
- activates pending subscriptions and generates their deliveries.

Calling it again for an already-paid payment returns success with `Payment already verified`.

### Subscription management

#### `GET /api/v1/customer/subscriptions`

Returns the customer's non-one-time subscriptions except `pending_payment`, with products populated, newest first.

#### `GET /api/v1/customer/all-orders`

Returns all subscription records, including one-time orders, except `pending_payment`. Products are populated and records are newest first.

This is a subscription/order-level endpoint, not a day-by-day delivery endpoint.

#### `PATCH /api/v1/customer/subscriptions/:id/pause`

Body: `{ "pauseFrom": "2026-08-15" }`.

Pauses an active owned subscription starting at midnight on the supplied date. Future `scheduled` or `assigned` deliveries on/after that date are deleted, and their count is added to `remainingDeliveries` for later regeneration.

#### `PATCH /api/v1/customer/subscriptions/:id/resume`

Body: optional `{ "resumeDate": "2026-08-20" }`.

Resumes a paused owned subscription. The default resume date is tomorrow. Saved `remainingDeliveries` are regenerated from the resume date, and pause fields/count are cleared.

#### `PATCH /api/v1/customer/subscriptions/:id/auto-renew`

Body: `{ "autoRenew": true }`.

Updates the owned subscription's `autoRenew` flag and returns the updated record.

#### `POST /api/v1/customer/subscriptions/:id/renew`

Sets the owned subscription to `active` and changes `startDate` to tomorrow. Returns the updated subscription. This route does not create a payment by itself.

#### `DELETE /api/v1/customer/subscriptions/:id`

Permanently deletes the owned subscription, then deletes related deliveries with status `scheduled`, `pending`, or `rescheduled`. Returns `404` when the subscription is not found.

### Deliveries, orders, and payments

#### `GET /api/v1/customer/deliveries`

Returns all delivery records for the customer sorted by `deliveryDate` ascending. Populates `product` and the partner's `name` and `phone`.

#### `GET /api/v1/customer/orders`

Returns all delivery records for the customer sorted by creation time descending. Populates `product`, partner `name`/`phone`, and the subscription's `cycle`.

Use this endpoint for day-by-day or product-by-day order rendering because every record has `deliveryDate`, `product`, `quantity`, `slot`, and delivery `status`.

#### `GET /api/v1/customer/payments`

Returns the customer's payments newest first.

### Milk Wallet

#### `GET /api/v1/customer/wallet/transactions`

Returns the authenticated customer's wallet credits/debits newest first.

#### `POST /api/v1/customer/wallet/topup/order`

Body: `{ "amount": 500 }`, in rupees.

Validates that amount is positive and creates a Razorpay order. Returns `orderId` and `amount` in paise.

#### `POST /api/v1/customer/wallet/topup/verify`

Body:

| Field | Required | Description |
| --- | --- | --- |
| `razorpay_order_id` | Yes | Top-up Razorpay order ID. |
| `razorpay_payment_id` | Yes | Top-up Razorpay payment ID. |
| `razorpay_signature` | Yes | Razorpay signature. |
| `amount` | Yes | Rupee amount to credit. |

Verifies the signature, increments `walletBalance`, creates a successful credit transaction, and returns the new balance and transaction.

---

## Payment API

Base path: `/api/v1/payments`

These are an older/general subscription-payment flow separate from `/customer/checkout`. Every endpoint requires a customer JWT.

### `POST /api/v1/payments/create-order`

Body: `{ "subscriptionId": "SUBSCRIPTION_ID" }`.

Loads an owned subscription and its product, takes the first product variant price (sale price when positive, otherwise regular price, falling back to legacy `pricePerUnit`), and calculates:

- daily cycle: price × quantity × 1
- weekly cycle: price × quantity × 7
- every other cycle: price × quantity × 30

It rejects invalid/NaN/zero amounts, creates an internal payment and Razorpay order, then returns `payment`, `providerOrder`, and `keyId` with status `201`.

### `POST /api/v1/payments/verify`

Body:

```json
{
  "providerOrderId": "order_...",
  "providerPaymentId": "pay_...",
  "signature": "..."
}
```

Finds the customer's payment by provider order ID, verifies the signature, marks it paid, and generates deliveries. Returns the payment and `deliveriesCreated` count.

### `POST /api/v1/payments/demo-success`

Body: `{ "paymentId": "PAYMENT_ID" }`.

Development/demo shortcut that marks an owned payment paid without provider verification, assigns a generated `demo_pay_*` ID, and generates deliveries. Returns the payment and delivery count.

---

## Delivery Partner API

Base path: `/api/v1/partner`

Auth: Every endpoint requires a partner JWT.

### `POST /api/v1/partner/profile-pic`

Content type: `multipart/form-data`.

File field: `image` (one file).

Uploads the image through Cloudinary, saves its URL in the partner User record's `profilePic`, and returns the updated user. Missing file returns `400`.

### `GET /api/v1/partner/profile`

Returns the partner profile. If none exists, it creates a default `PartnerProfile` linked to the authenticated user.

### `PATCH /api/v1/partner/availability`

Body: `{ "online": true }`.

Creates/updates the profile and coerces `online` to a Boolean.

### `GET /api/v1/partner/deliveries`

Optional query: `status`, for example `?status=assigned`.

Returns deliveries assigned to the authenticated partner, sorted by delivery date, with customer and product populated.

### `PATCH /api/v1/partner/deliveries/:id/status`

Body:

| Field | Required | Description |
| --- | --- | --- |
| `status` | Yes | `picked_up`, `out_for_delivery`, `delivered`, `failed`, or `rescheduled`. |
| `failureReason` | No | Reason when a delivery failed. |
| `proofUrl` | No | Delivery proof URL. |

Only updates a delivery assigned to the current partner. `deliveredAt` is set when status becomes `delivered`.

### `GET /api/v1/partner/earnings`

Counts the partner's delivered records. Returns `deliveries`, `total`, and `dailyRatePerDelivery`. The current calculation is a fixed ₹10 per delivered record.

---

## Farmer API

Base path: `/api/v1/farmer`

Auth: Every endpoint requires a farmer JWT.

### `GET /api/v1/farmer/profile`

Returns the FarmerProfile linked to the authenticated user, or `null` if it has not been created.

### `POST /api/v1/farmer/profile`

Creates or updates the farmer profile using the submitted body. Common fields:

- `fullName`, `phone`
- `address.house`, `address.street`, `address.city`, `address.pincode`, `address.state`
- `address.lat`, `address.lng`

The authenticated user ID is always set as the profile owner.

### `POST /api/v1/farmer/profile-photo`

Content type: `multipart/form-data`.

File field: `photo` (one file).

Uploads a profile photo and stores its Cloudinary path in `profilePhotoUrl`. A FarmerProfile must already exist for the update to return a record.

### `POST /api/v1/farmer/kyc`

Content type: `multipart/form-data`.

File fields:

- `aadhaarFront` (maximum one file)
- `aadhaarBack` (maximum one file)

Stores the uploaded Aadhaar document URLs and resets KYC status to `pending`. The farmer must create a profile first.

### `GET /api/v1/farmer/dashboard`

Returns:

- `totalEarningsThisMonth`: total amount from this month's `collected` sales.
- `totalMilkSoldThisMonth`: litres from this month's `collected` sales.
- `recentTransactions`: five most recent milk sales.
- `activeCollection`: the first `in_progress` collection, with vendor `fullName` populated.

### `GET /api/v1/farmer/rate`

Returns the current farmer milk purchase rate from config key `CURRENT_MILK_RATE`. If missing, the route creates it with a default value of ₹34/litre.

### `POST /api/v1/farmer/sell-milk`

Body:

| Field | Required | Description |
| --- | --- | --- |
| `quantity` | Yes | Litres offered for collection. |
| `rateApplied` | Yes | Rate per litre. |
| `totalAmount` | Yes | Submitted total amount. |
| `address` | No | Address values to merge into FarmerProfile. |

Creates a MilkSale with status `initiated`. If an address is supplied, it also updates the farmer profile. Returns the created sale.

### `GET /api/v1/farmer/earnings`

Returns all milk-sale records for the farmer, newest first.

---

## Admin API

Base path: `/api/v1/admin`

Auth: Every endpoint requires an admin JWT.

### Admin identity and dashboard

#### `GET /api/v1/admin/me`

Returns the authenticated admin user without `passwordHash`.

#### `GET /api/v1/admin/dashboard`

Returns dashboard analytics:

- customer and partner counts
- active subscription count
- delivery count from the start of today onward
- all-time paid payment revenue
- seven-day revenue series and maximum revenue
- top three products by active/completed subscription count
- today's delivery completion totals and percentage
- top three customer pincodes as zones, or fallback demo zones when no zone data exists

#### `GET /api/v1/admin/users`

Optional query: `role`, for example `?role=partner`.

Returns all users or only users with that exact role.

### Category management

#### `GET /api/v1/admin/categories`

Returns all categories, including inactive categories, sorted by `displayOrder`.

#### `POST /api/v1/admin/categories`

Content type: `multipart/form-data`.

File field: `image` (optional, one file).

Body supports `name`, `description`, `displayOrder`, `isFeatured`, and `isActive`. Creates and returns the category with status `201`.

#### `PATCH /api/v1/admin/categories/:id`

Content type: `multipart/form-data`.

Accepts category fields plus optional `image`. Saves a new uploaded image URL and returns the updated category.

#### `DELETE /api/v1/admin/categories/:id`

Permanently deletes the category and returns `{ "success": true }`. It does not automatically delete or update linked products.

### Product management

#### `GET /api/v1/admin/products`

Returns all products, including inactive products, newest first, with category populated.

#### `POST /api/v1/admin/products`

Content type: `multipart/form-data`.

File field: `images` (up to five files).

Important fields include `name`, `category`, descriptions, tax/order limits, legacy unit/price fields, plus:

- `variants`: JSON array or JSON-encoded form string with `unit`, `sku`, `regularPrice`, `salePrice`, `stockQuantity`.
- `frequencies`: JSON array or JSON-encoded form string with `name`, `subtitle`, `badge`, `days`.
- Boolean strings normalized by this route: `isFeatured`, `isBestSeller`, `allowSubscription`, `allowCustomBulk`, `isActive`.

An empty category string is omitted. Returns the created product with status `201`.

#### `PATCH /api/v1/admin/products/:id`

Content type: `multipart/form-data`.

Accepts the same product fields and up to five replacement images. Uploaded images replace the `images` array. JSON strings and listed Boolean fields are normalized. An empty category becomes `null`.

#### `DELETE /api/v1/admin/products/:id`

Permanently deletes a product and returns `{ "success": true }`.

### Subscription plan management

#### `GET /api/v1/admin/subscription-plans`

Returns all plans, newest first, with product populated.

#### `POST /api/v1/admin/subscription-plans`

Content type: `multipart/form-data`.

File field: `image` (optional, one file).

Key body fields:

- identity: `name`, `description`, `product`, `variantUnit`
- delivery: `quantityPerDelivery`, `totalDeliveries`, `durationDays`, `frequency`, `selectedWeekdays`, `maxDaysPerWeek`, `billingCycle`
- prices: `originalPrice`, `discountedPrice`, `taxAmount`, `deliveryCharge`, `finalPayableAmount`
- rules/flags: `pauseAllowance`, `skipAllowance`, `cancellationRules`, `isActive`, `isFeatured`, `isRecommended`

`selectedWeekdays` may be a JSON-encoded form string. Boolean strings for the three flags are normalized. Returns the created plan with status `201`.

#### `PATCH /api/v1/admin/subscription-plans/:id`

Content type: `multipart/form-data`.

Updates the same plan fields, optional image, weekdays, and Boolean flags. Returns the updated plan.

#### `DELETE /api/v1/admin/subscription-plans/:id`

Permanently deletes the plan and returns `{ "success": true }`.

### Active subscription operations

#### `GET /api/v1/admin/active-subscriptions`

Despite the name, returns every non-one-time subscription except `pending_payment`, including active, paused, expired, and cancelled records. Populates customer, product, and assigned partner.

#### `PATCH /api/v1/admin/active-subscriptions/:id/assign-partner`

Body: `{ "partnerId": "USER_ID" }`. Send `null`/empty to unassign.

Updates the subscription's permanent assigned partner and cascades to pending/scheduled/rescheduled deliveries. Assigned records become `assigned`; unassigned records become `scheduled`. Emits Socket.IO event `partner:notified` when assigning.

#### `PATCH /api/v1/admin/active-subscriptions/:id/slot`

Body: `{ "slot": "6:00 AM - 8:00 AM" }`.

Updates the subscription and all pending/future delivery slots. Changing a previously allocated slot can change affected delivery status to `rescheduled`.

#### `PATCH /api/v1/admin/active-subscriptions/:id/pause`

Body: `{ "pauseFrom": "2026-08-15" }`.

Pauses an active subscription, deletes `scheduled`/`assigned` deliveries on or after the pause date, and stores their count in `remainingDeliveries`.

#### `PATCH /api/v1/admin/active-subscriptions/:id/resume`

Body: optional `{ "resumeDate": "2026-08-20" }`.

Resumes a paused subscription and regenerates the stored number of remaining deliveries from the requested date or tomorrow.

### Delivery management

#### `GET /api/v1/admin/deliveries`

Optional query: `subscriptionId`.

Returns matching deliveries sorted by `deliveryDate`, with customer, partner, product, subscription, and payment populated.

#### `PATCH /api/v1/admin/deliveries/:id`

General delivery editor. Supported body fields are `status`, `adminNote`, `deliveryDate`, `slot`, and `failureReason`. Setting status to `delivered` also sets `deliveredAt`. Returns the populated updated delivery.

#### `PATCH /api/v1/admin/deliveries/:id/assign`

Body: `{ "partnerId": "USER_ID" }`. Send `null`/empty to unassign.

Sets the partner and changes status to `assigned`, or to `scheduled` when unassigned. Emits `partner:notified` through Socket.IO on assignment.

#### `PATCH /api/v1/admin/deliveries/:id/note`

Body: `{ "adminNote": "Call customer before arrival" }`.

Updates only the administrative note and returns the fully populated delivery.

#### `PATCH /api/v1/admin/deliveries/:id/slot`

Body: `{ "slot": "8:00 AM - 10:00 AM" }`.

Sets the delivery slot. Changing an existing allocated slot while a delivery is scheduled/assigned/in transit changes its status to `rescheduled`.

#### `PATCH /api/v1/admin/deliveries/:id/status`

Body contains `status` and optional `failureReason`.

Allowed statuses are `picked_up`, `out_for_delivery`, `delivered`, `failed`, and `rescheduled`. It clears `adminNote` as the delivery progresses and sets `deliveredAt` for delivered records.

#### `PATCH /api/v1/admin/deliveries/:id/reschedule`

Body: `{ "deliveryDate": "2026-08-15", "slot": "8:00 AM - 10:00 AM" }`.

Changes the date and slot, sets status to `rescheduled`, clears `failureReason`, and unassigns the partner. Missing slot becomes `Pending Allocation`.

### System configuration

#### `GET /api/v1/admin/config/milk-rate`

Returns `CURRENT_MILK_RATE`. Creates it with ₹34/litre if missing.

#### `PUT /api/v1/admin/config/milk-rate`

Body: `{ "rate": 36 }`.

Validates a numeric, truthy rate, then creates or updates `CURRENT_MILK_RATE`. Returns the numeric value.

#### `PUT /api/v1/admin/config/:key`

Body: `{ "value": "any JSON value", "description": "optional description" }`.

Creates or updates an arbitrary system config key and returns its stored value.

### Farmer and KYC administration

#### `GET /api/v1/admin/farmers`

Returns all farmer users without password hashes. Each result receives a `profile` property containing its FarmerProfile or `null`.

#### `GET /api/v1/admin/kyc-requests`

Returns all farmer profiles newest first, with the user's email populated.

#### `PUT /api/v1/admin/kyc-requests/:id`

Body: `{ "status": "approved" }` or `{ "status": "rejected" }`.

Updates `kyc.status` on the FarmerProfile. Invalid status returns `400`; missing profile returns `404`.

### Milk collection administration

#### `GET /api/v1/admin/milk-collections`

Returns all MilkSale records newest first, with farmer name/email/phone populated and the farmer's full profile attached as `farmer.profile`.

#### `PUT /api/v1/admin/milk-collections/:id/assign`

Body: `{ "expectedPickupTime": "2026-08-12T10:30:00.000Z" }`.

Only accepts a sale in `initiated` state. Changes it to `in_progress`, stores the expected pickup time, and assigns the authenticated admin as `vendor`.

#### `PUT /api/v1/admin/milk-collections/:id/verify`

Body: optional `{ "finalQuantity": 12.5 }`.

Only accepts an `in_progress` sale. If a valid truthy final quantity is supplied, recalculates `totalAmount = finalQuantity × rateApplied`, then marks the sale `collected`.

### Contact inquiry administration

#### `GET /api/v1/admin/contacts`

Returns all contact inquiries newest first.

#### `PATCH /api/v1/admin/contacts/:id`

Body: `{ "status": "read" }` where status is `new`, `read`, or `resolved`.

Updates and returns the inquiry. Invalid status returns `400`; missing inquiry returns `404`.

---

## Socket.IO events

The Socket.IO server uses the same host/port as the HTTP API and currently allows all origins during development.

### Client to server: `partner:update_location`

Payload:

```json
{
  "deliveryId": "DELIVERY_ID",
  "lat": 22.7196,
  "lng": 75.8577,
  "partnerId": "PARTNER_USER_ID"
}
```

The server broadcasts the same payload as `delivery:location:<deliveryId>`.

### Server to client: `partner:notified`

Emitted when an admin assigns a delivery or permanently assigns a subscription to a partner. The payload includes `partnerId`, a delivery/subscription ID, and a message.

## Core response entities

| Entity | Key fields |
| --- | --- |
| User | `name`, `phone`, `email`, `role`, `status`, `profilePic`, `addresses`, `walletBalance` |
| Product | `name`, `category`, `images`, `variants`, `frequencies`, pricing/display flags |
| Subscription | `customer`, `product`, `addressId`, `cycle`, `quantity`, dates, `status`, frequency, partner |
| Delivery | `deliveryDate`, `product`, `quantity`, `slot`, `status`, partner, payment, proof/failure data, `isExtra` |
| Payment | `amount`, `currency`, provider IDs, `status`, `paidAt`, `metadata` |
| WalletTransaction | `amount`, `type`, `description`, `status`, `referenceId` |
| FarmerProfile | identity, address, profile photo, Aadhaar URLs, KYC status |
| MilkSale | `quantity`, `rateApplied`, `totalAmount`, pickup status/time, vendor |

## Current implementation notes

These notes document current behavior and are useful before exposing the API publicly:

- `firebase-sync` accepts identity details from the request body; it does not currently verify a Firebase ID token in the backend route.
- Customer Razorpay setup/signature verification currently contains credentials in route source. Move all provider credentials to environment variables and rotate any committed credentials.
- `POST /api/v1/payments/demo-success` bypasses provider verification and should be disabled outside development.
- `PATCH /api/v1/customer/me` does not whitelist fields, so it should be restricted to explicitly editable profile properties.
- `GET /api/v1/admin/users` returns raw user documents and does not explicitly exclude `passwordHash`.
- Wallet top-up verification credits the body-supplied `amount`; a production flow should bind the amount to a server-side top-up record/provider order and enforce idempotency.
- Customer checkout payment verification activates all pending subscriptions for that customer, rather than only subscriptions explicitly linked to that payment.
- Several update/delete routes return success with `data: null` or no not-found error when an ID does not exist.
- CORS and Socket.IO origins are currently unrestricted for development.
