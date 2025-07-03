# API Documentation

## Base URL
```
https://api.yourdomain.com
```

## Authentication
All API endpoints (except webhooks and health checks) require authentication via Clerk JWT tokens.

Include the token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

## Endpoints

### Health Check
**GET** `/healthz`
- Public endpoint
- Returns system health status

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 12345,
  "services": {
    "database": "ok",
    "redis": "ok"
  }
}
```

### User Management

#### Get User Profile
**GET** `/users/profile`
- Requires authentication
- Returns current user's profile

**Response:**
```json
{
  "id": "user_123",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "role": "CUSTOMER",
  "subscriptionStatus": "ACTIVE",
  "containerCount": 1,
  "storageUsedGB": 45.2,
  "storageQuotaGB": 2048
}
```

#### Update User Profile
**PATCH** `/users/profile`
- Requires authentication
- Updates user profile information

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe"
}
```

### Container Management

#### List User Containers
**GET** `/containers`
- Requires authentication
- Returns user's containers

**Response:**
```json
[
  {
    "id": "container_123",
    "containerName": "media-user123-myserver",
    "mediaServerType": "JELLYFIN",
    "subdomainSlug": "myserver",
    "status": "RUNNING",
    "cpuLimit": 0.25,
    "memoryLimit": 800,
    "storageQuotaGB": 2048,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

#### Create Container
**POST** `/containers`
- Requires authentication
- Creates a new media server container

**Request Body:**
```json
{
  "mediaServerType": "JELLYFIN",
  "subdomainSlug": "myserver"
}
```

#### Get Container Details
**GET** `/containers/:id`
- Requires authentication
- Returns container details with live status

#### Start Container
**POST** `/containers/:id/start`
- Requires authentication
- Starts a stopped container

#### Stop Container
**POST** `/containers/:id/stop`
- Requires authentication
- Stops a running container

#### Get Container Logs
**GET** `/containers/:id/logs?tail=100`
- Requires authentication
- Returns container logs

### Billing Management

#### Get Billing Information
**GET** `/billing`
- Requires authentication
- Returns subscription and billing details

**Response:**
```json
{
  "subscriptionStatus": "ACTIVE",
  "trialEndsAt": null,
  "subscriptionEndsAt": "2024-02-01T00:00:00.000Z",
  "activeSubscription": {
    "id": "sub_123",
    "stripePriceId": "price_123",
    "status": "ACTIVE",
    "currentPeriodEnd": "2024-02-01T00:00:00.000Z"
  },
  "billingHistory": [
    {
      "id": "bill_123",
      "amount": 1500,
      "currency": "usd",
      "status": "PAID",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### Create Subscription
**POST** `/billing/subscribe`
- Requires authentication
- Creates a new subscription

**Request Body:**
```json
{
  "paymentMethodId": "pm_123"
}
```

#### Cancel Subscription
**POST** `/billing/cancel`
- Requires authentication
- Cancels subscription at period end

#### Resume Subscription
**POST** `/billing/resume`
- Requires authentication
- Resumes a cancelled subscription

#### Get Invoices
**GET** `/billing/invoices`
- Requires authentication
- Returns invoice history

### Admin Endpoints
*Requires admin role*

#### Admin Dashboard
**GET** `/admin/dashboard`
- Returns platform statistics

#### List All Users
**GET** `/admin/users?page=1&limit=20&search=query`
- Returns paginated user list

#### Get User Details
**GET** `/admin/users/:id`
- Returns detailed user information

#### Update User Role
**PATCH** `/admin/users/:id/role`
- Updates user role

**Request Body:**
```json
{
  "role": "ADMIN"
}
```

#### Suspend User
**POST** `/admin/users/:id/suspend`
- Suspends user and stops containers

#### List All Containers
**GET** `/admin/containers?page=1&limit=20`
- Returns all containers with status

#### Restart Container (Admin)
**POST** `/admin/containers/:id/restart`
- Force restart any container

#### System Logs
**GET** `/admin/logs?page=1&limit=50&action=filter`
- Returns system activity logs

### Webhooks

#### Stripe Webhook
**POST** `/webhooks/stripe`
- Handles Stripe webhook events
- Signature verification required

#### Clerk Webhook
**POST** `/webhooks/clerk`
- Handles Clerk webhook events
- Signature verification required

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": true,
  "message": "Error description",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `500` - Internal Server Error
- `503` - Service Unavailable

## Rate Limiting
- API endpoints: 100 requests per 15 minutes per IP
- Authentication endpoints: 50 requests per 15 minutes per IP
- Webhook endpoints: 50 requests per 15 minutes per IP

Rate limit headers are included in responses:
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

## Pagination

List endpoints support pagination:
```
GET /api/endpoint?page=1&limit=20
```

Response includes pagination metadata:
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```