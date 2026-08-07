# API endpoints

## Authentication
- POST `/api/v1/auth/request-otp`
- POST `/api/v1/auth/verify-otp`
- POST `/api/v1/auth/admin-login`

## Customer
- GET/PATCH `/api/v1/customer/me`
- POST `/api/v1/customer/addresses`
- GET `/api/v1/customer/products`
- POST/GET `/api/v1/customer/subscriptions`
- PATCH `/api/v1/customer/subscriptions/:id/pause`
- PATCH `/api/v1/customer/subscriptions/:id/resume`
- GET `/api/v1/customer/deliveries`
- GET `/api/v1/customer/payments`

## Payment
- POST `/api/v1/payments/create-order`
- POST `/api/v1/payments/verify`
- POST `/api/v1/payments/demo-success` (development only)

## Partner
- GET `/api/v1/partner/profile`
- PATCH `/api/v1/partner/availability`
- GET `/api/v1/partner/deliveries`
- PATCH `/api/v1/partner/deliveries/:id/status`
- GET `/api/v1/partner/earnings`

## Admin
- GET `/api/v1/admin/dashboard`
- GET `/api/v1/admin/users`
- GET/POST/PATCH `/api/v1/admin/products`
- GET `/api/v1/admin/deliveries`
- PATCH `/api/v1/admin/deliveries/:id/assign`
