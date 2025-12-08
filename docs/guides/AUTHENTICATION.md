# Authentication Guide

## 🔐 Security System

The API includes privileged endpoints that require Bearer token authentication to execute. This adds an additional layer of security for sensitive commands.

## 🔑 Token Configuration

### Secure Token (Recommended)
Generate a secure random 64-character token:

```bash
openssl rand -hex 32
# Result: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

Copy to `.env`:
```bash
API_TOKEN=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

### Token Validation
The server validates the token using `crypto.timingSafeEqual()` to prevent timing attacks:

```typescript
const providedToken = Buffer.from(token, 'utf-8');
const validToken = Buffer.from(API_TOKEN, 'utf-8');
crypto.timingSafeEqual(providedToken, validToken);
```

## 📡 Using Token in Requests

### Bearer Format (Recommended)
```bash
curl -X POST http://127.0.0.1:3000/api/privileged/execute \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"command": "whoami"}'
```

More curl samples for each endpoint: [Endpoint usage examples](/docs/examples/ENDPOINT_EXAMPLES.md).

### Successful Response (200)
```json
{
  "success": true,
  "result": {
    "stdout": "root",
    "stderr": "",
    "exitCode": 0,
    "duration": 45
  }
}
```

### Without Token (401)
```json
{
  "success": false,
  "error": "Unauthorized",
  "message": "Valid API token required for privileged operations"
}
```

### Invalid Token (401)
```json
{
  "success": false,
  "error": "Unauthorized",
  "message": "Valid API token required for privileged operations"
}
```

## 🔐 Commands That Require Token

The following commands require authentication:

```typescript
[
  /^sudo\s+/,           # Any command with sudo
  /^systemctl\s+/,      # systemctl (services)
  /^service\s+/,        # service (services)
  /^rm\s+-rf/,          # rm -rf (recursive deletion)
  /^shutdown/,          # shutdown
  /^reboot/,            # reboot
  /^poweroff/,          # poweroff
  /^halt/,              # halt
  /^kill\s+-9/,         # kill -9 (force)
  /^pkill/,             # pkill
  /^dd\s+/,             # dd (low-level)
  /^mkfs/,              # mkfs (format)
  /^fdisk/,             # fdisk (partitions)
  /^parted/,            # parted (partitions)
  /^chmod\s+/,          # chmod (permissions)
  /^chown\s+/,          # chown (owner)
  /^passwd/,            # passwd (change password)
  /^userdel/,           # userdel (delete user)
  /^useradd/            # useradd (create user)
]
```

## 🚀 Practical Examples

### Execute privileged command
```bash
curl -X POST http://127.0.0.1:3000/api/privileged/execute \
  -H "Authorization: Bearer $(cat api/.env | grep API_TOKEN | cut -d'=' -f2)" \
  -H "Content-Type: application/json" \
  -d '{
    "command": "systemctl status nginx",
    "timeout": 5000
  }'
```

### Batch of privileged commands
```bash
curl -X POST http://127.0.0.1:3000/api/privileged/batch \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "commands": [
      "systemctl stop nginx",
      "sleep 2",
      "systemctl start nginx",
      "systemctl status nginx"
    ]
  }'
```

### Manage services
```bash
curl -X POST http://127.0.0.1:3000/api/privileged/service \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "service": "nginx",
    "action": "restart"
  }'
```

Available actions: `start`, `stop`, `restart`, `status`, `enable`, `disable`

## 🛡️ Security Best Practices

1. **Secure token**: Use `openssl rand -hex 32` to generate
2. **Never commit**: The token in `.env` should never go to git
3. **Rotate regularly**: Change the token every 3-6 months
4. **Unique per server**: Don't reuse tokens between servers
5. **Separate environments**: Different tokens for dev/staging/prod
6. **Secure logs**: Never log the full token
7. **Localhost only**: The API automatically rejects external IPs

## 🔒 Node.js Programmatic Example

```javascript
const axios = require('axios');

const API_TOKEN = process.env.API_TOKEN;

async function executePrivileged(command) {
  try {
    const response = await axios.post(
      'http://127.0.0.1:3000/api/privileged/execute',
      { command },
      {
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data;
  } catch (error) {
    if (error.response?.status === 401) {
      console.error('Invalid or expired token');
    }
    throw error;
  }
}

// Usage
executePrivileged('systemctl restart myapp')
  .then(result => console.log(result))
  .catch(error => console.error(error));
```

## 🐍 Python Example

```python
import requests
import os

API_TOKEN = os.getenv('API_TOKEN')
API_URL = 'http://127.0.0.1:3000'

def execute_privileged(command):
    headers = {
        'Authorization': f'Bearer {API_TOKEN}',
        'Content-Type': 'application/json'
    }
    
    response = requests.post(
        f'{API_URL}/api/privileged/execute',
        json={'command': command},
        headers=headers
    )
    
    if response.status_code == 401:
        raise Exception('Invalid token')
    
    response.raise_for_status()
    return response.json()

# Usage
result = execute_privileged('systemctl status nginx')
print(result)
```

## 🆘 Troubleshooting

**Error: "Valid API token required"**
- Verify that the token is in `.env`
- Verify that you're using `Authorization: Bearer TOKEN`
- Verify that the token has no extra spaces

**Error: "This API is only accessible from localhost"**
- The request must come from 127.0.0.1 or localhost
- Verify that your calling application runs on the same host

**Token expired or revealed**
- Generate new token: `openssl rand -hex 32`
- Update in `.env`
- Restart server
- No need to add to repository
