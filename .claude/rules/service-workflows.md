# Service Workflows

## Authentication & Authorization Flow

This diagram shows how a user logs in and how subsequent requests are validated.

```mermaid
sequenceDiagram
    participant User
    participant Auth_Service
    participant DB
    participant Other_Service

    Note over User, DB: Login Phase
    User->>Auth_Service: POST /auth/login (email, pass)
    Auth_Service->>DB: Fetch user & permissions
    DB-->>Auth_Service: User Data
    Auth_Service->>Auth_Service: Verify Argon2 Hash
    Auth_Service-->>User: Return JWT (contains permissions)

    Note over User, Other_Service: Authenticated Request
    User->>Other_Service: GET /data (Header: Bearer JWT)
    Other_Service->>Other_Service: Validate JWT Signature
    Other_Service->>Other_Service: Check if 'data:read' in JWT
    Other_Service-->>User: 200 OK / Data Payload
```

## Password Change Workflow

This ensures that security is maintained even if a session is hijacked.

```mermaid
sequenceDiagram
    participant User
    participant Auth_Service
    participant DB

    User->>Auth_Service: POST /auth/change-password (old, new)
    Auth_Service->>DB: Fetch current hash
    Auth_Service->>Auth_Service: Validate old password
    Auth_Service->>Auth_Service: Hash new password
    Auth_Service->>DB: Update password_hash
    Auth_Service->>DB: Revoke all active Refresh Tokens
    Auth_Service-->>User: 200 OK (User must re-login)
```
