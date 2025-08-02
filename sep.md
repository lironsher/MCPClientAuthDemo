---
title: "SEP‑XXX: Client Identity Verification in MCP via JWT and Public Keys"
labels: ["SEP", "proposal"]
assignees: []
---

# SEP‑XXX  
**Title:** Client Identity Verification in MCP via JWT and Public Keys  
**Authors:** Liron Sher (@lironsher)  
**Status:** Proposal  
**Type:** Standards‑Track  
**Base Spec Version:** 2025‑06‑18

---

## Abstract

This SEP introduces cryptographic client identity verification to the Model Context Protocol (MCP), enabling servers to distinguish between trusted client applications (e.g., `com.claude.desktop`) and arbitrary clients. 

Clients include a reverse-domain `clientId` and a short-lived `clientAuth` JWT in the `initialize` request. 

Servers validate this token using public keys retrieved from configurable trust anchors (`.well-known` endpoints, DNS TXT records, GitHub repositories, or local configuration), respond with a `client_verified` boolean flag, and can apply client-specific policies. This extension is fully backward-compatible and opt-in for both clients and servers.

---

## Motivation

MCP v2025‑06‑18 provides a robust lifecycle and authorization framework but lacks a mechanism to verify **which client software** is making requests—only **what operations** it is authorized to perform. This gap allows potentially misbehaving or unauthorized tools to masquerade as legitimate agents when accessing sensitive APIs.

### Use Cases

**Enterprise Security:**
- Cloud MCP Servers need to restrict access to verified clients like `com.claude.desktop`, preventing unauthorized forks or custom implementations
- Enterprises want to limit their private MCP servers to internally-signed tools (e.g., `org.company.assistant`)
- Organizations need audit trails showing which specific client implementations accessed which resources

**Developer Control:**
- API providers want to enforce different rate limits or feature access based on client identity
- Server operators need to implement gradual rollouts of new features to specific client versions
- Debugging and support teams require clear identification of client implementations in logs

This proposal adds cryptographic identity verification while maintaining full compatibility with existing MCP implementations.

---

## Specification

### Client Identifier Format

The `clientId` MUST be a reverse-domain name uniquely identifying the client implementation and reflecting clear ownership.

**Format:**
```
domain.vendor.application[.variant]
```

**Requirements:**
- Must be globally unique
- Should reflect DNS ownership or organizational control
- Must exactly match the `sub` field in the corresponding JWT
- Should follow semantic versioning in variant (optional)

**Examples:**
- `com.claude.desktop` - Anthropic's Claude Desktop client
- `com.microsoft.vscode.mcp` - Microsoft's VS Code MCP extension  
- `org.example.debugger.beta` - Example organization's beta debugger
- `io.github.username.tool` - Open source tool by GitHub user

### JWT Token Requirements

The `clientAuth` JWT MUST contain:
- **`sub`** (Subject): Exactly matches the provided `clientId`
- **`exp`** (Expiry): Maximum 5 minutes from issue time
- **`iat`** (Issued At): Token creation timestamp
- **`aud`** (Audience): Optional - target server identifier or hostname

**Optional Claims:**
- **`client_version`**: Semantic version of the client
- **`features`**: Array of client feature flags
- **`jti`**: Unique token identifier for replay attack prevention

**Example JWT payload:**
```json
{
  "sub": "com.claude.desktop",
  "exp": 1735689900,
  "iat": 1735689600,
  "aud": "myserver.example.com",
  "client_version": "1.2.3",
  "features": ["streaming", "tools"],
  "jti": "unique-token-id-123"
}
```

### Protocol Extension

#### Initialize Request Enhancement

Clients MAY include these additional fields in the `initialize` request parameters:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2025‑06‑18",
    "capabilities": { /* existing capabilities */ },
    "clientInfo": { 
      "name": "Claude Desktop", 
      "version": "1.2.3" 
    },
    // NEW: Optional client identity fields
    "clientId": "com.claude.desktop",
    "clientAuth": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### Initialize Result Enhancement

Servers MUST include the verification result when `clientAuth` was provided:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2025‑06‑18",
    "capabilities": { /* server capabilities */ },
    "serverInfo": { 
      "name": "Example Server", 
      "version": "2.1.0" 
    },
    // NEW: Client verification status
    "client_verified": true,
    "verification_details": {
      "method": "dns_txt",
      "timestamp": "2025-01-01T12:00:00Z"
    }
  }
}
```

### Public Key Resolution

Servers resolve public keys for client verification through a configurable chain of trust anchors:

#### 1. Well-Known Endpoint
using a reverse client id as hostname.
```
GET https://desktop.claude.com/.well-known/mcp-client-keys/com.claude.desktop
```
Response:
```json
{
  "clientId": "com.claude.desktop",
  "publicKey": "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...",
  "keyId": "2025-01",
  "validFrom": "2025-01-01T00:00:00Z",
  "validUntil": "2026-01-01T00:00:00Z"
}
```

#### 2. DNS TXT Record
```
_keys.desktop.claude.com TXT "v=mcp1; client=com.claude.desktop; key=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A..."
```

#### 3. GitHub Repository
TBA

### Verification Process

1. **Parse JWT**: Extract header and payload, verify structure
2. **Validate Claims**: Check `sub` matches `clientId`, `exp` is future, `iat` is reasonable
3. **Resolve Public Key**: Query configured trust anchors for `clientId`
4. **Verify Signature**: Validate JWT signature using resolved public key
5. **Set Status**: Mark connection as `client_verified: true/false`
6. **Apply Policy**: Enforce any client-specific access controls

### Error Handling

Servers SHOULD handle verification failures gracefully:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2025‑06‑18",
    "capabilities": {},
    "serverInfo": {},
    "client_verified": false,
    "verification_error": {
      "code": "key_not_found",
      "message": "Unable to resolve public key for client ID",
      "details": "Checked: well-known, DNS TXT"
    }
  }
}
```

**Error Codes:**
- `invalid_jwt` - Malformed or invalid JWT structure
- `expired_token` - Token past expiration time
- `key_not_found` - No public key found for clientId
- `signature_invalid` - JWT signature verification failed
- `claim_mismatch` - JWT claims don't match expected values

---

## Server Configuration

Servers implementing this specification SHOULD accept a `clientAuth` configuration object:

```typescript
interface ClientAuthConfig {
  // Validation strategy
  validationMode: 'allow_all' | 'allowlist' | 'blocklist';
  
  // Failure handling
  onVerificationFailure: 'reject' | 'allow_unverified';
  
  // Client filtering
  allowedClients?: string[];
  blockedClients?: string[];
  
  // Key resolution chain
  keyResolvers: KeyResolver[];
  
  // Policy enforcement  
  clientPolicies?: Record<string, ClientPolicy>;
}

interface KeyResolver {
  resolve(clientId: string): Promise<PublicKeyInfo | null>;
}

interface ClientPolicy {
  maxRequestsPerMinute?: number;
  allowedCapabilities?: string[];
  requiredFeatures?: string[];
}
```

### Built-in Key Resolvers

The MCP SDK SHOULD provide standard key resolver implementations:

```typescript
// DNS TXT record resolver
const dnsResolver = new DnsKeyResolver({
  recordPrefix: '_mcp-client-keys',
  timeout: 5000
});

// Well-known endpoint resolver  
const wellKnownResolver = new WellKnownKeyResolver({
  timeout: 10000,
  cacheTtl: 3600
});

// Local file resolver
const localResolver = new LocalKeyResolver({
  keyDirectory: '/etc/mcp/keys',
  watchForChanges: true
});

// Composite resolver with fallback chain
const compositeResolver = new CompositeKeyResolver([
  wellKnownResolver,
  dnsResolver,
  githubResolver,
  localResolver
]);
```

---

## Security Considerations

**Key Management:**
- Private keys MUST be stored securely and never transmitted
- Key rotation SHOULD be supported with overlapping validity periods
- Compromised keys enable client impersonation until revocation

**Network Security:**
- Well-known endpoints MUST be served over HTTPS with valid certificates
- DNS TXT lookups SHOULD use DNSSEC where available
- GitHub API access SHOULD verify repository authenticity

**Token Security:**
- Short expiration times (≤5 minutes) limit replay attack windows
- Unique `jti` claims can prevent token reuse
- Audience claims (`aud`) SHOULD specify the target server

**Server Implementation:**
- Servers MUST handle unverified clients gracefully
- Rate limiting SHOULD consider client verification status
- Audit logs SHOULD include client identity information

**Privacy:**
- Client telemetry SHOULD NOT include sensitive verification details
- Public key resolution MAY leak client existence to DNS/HTTP logs

---

## Backward Compatibility

This specification maintains full backward compatibility:

- **Existing Clients**: Continue to work without modification; `client_verified` defaults to `false`  
- **Existing Servers**: Can ignore new fields; no breaking changes to core protocol
- **Gradual Adoption**: Servers may implement verification incrementally
- **Fallback Behavior**: Unverified clients can still access public APIs unless explicitly restricted

---

## Implementation Examples

### Client Implementation (Python)

```python
import jwt
import json
from datetime import datetime, timedelta

class MCPClient:
    def __init__(self, client_id: str, private_key: str):
        self.client_id = client_id
        self.private_key = private_key
    
    def create_auth_token(self, audience: str = None) -> str:
        payload = {
            'sub': self.client_id,
            'iat': datetime.utcnow(),
            'exp': datetime.utcnow() + timedelta(minutes=5),
            'jti': f"{self.client_id}-{int(datetime.utcnow().timestamp())}"
        }
        if audience:
            payload['aud'] = audience
            
        return jwt.encode(payload, self.private_key, algorithm='RS256')
    
    async def initialize(self, transport):
        auth_token = self.create_auth_token()
        request = {
            'jsonrpc': '2.0',
            'id': 1,
            'method': 'initialize',
            'params': {
                'protocolVersion': '2025-06-18',
                'clientInfo': {'name': 'PyMCP', 'version': '1.0.0'},
                'clientId': self.client_id,
                'clientAuth': auth_token
            }
        }
        return await transport.send(request)
```

### Server Implementation (Node.js)

```javascript
class MCPServer {
    constructor(config) {
        this.clientAuthConfig = config.clientAuth || {};
        this.keyResolvers = config.keyResolvers || [];
    }
    
    async handleInitialize(params) {
        let clientVerified = false;
        let verificationError = null;
        
        if (params.clientId && params.clientAuth) {
            try {
                clientVerified = await this.verifyClient(
                    params.clientId, 
                    params.clientAuth
                );
            } catch (error) {
                verificationError = {
                    code: error.code || 'verification_failed',
                    message: error.message
                };
            }
        }
        
        // Apply client-specific policies
        if (clientVerified) {
            this.applyClientPolicy(params.clientId);
        }
        
        return {
            protocolVersion: '2025-06-18',
            serverInfo: { name: 'NodeMCP', version: '2.0.0' },
            capabilities: this.getCapabilities(clientVerified),
            client_verified: clientVerified,
            ...(verificationError && { verification_error: verificationError })
        };
    }
    
    async verifyClient(clientId, clientAuth) {
        // Decode JWT without verification to get claims
        const decoded = jwt.decode(clientAuth, { complete: true });
        
        // Validate basic claims
        if (decoded.payload.sub !== clientId) {
            throw new Error('Client ID mismatch');
        }
        
        if (decoded.payload.exp < Date.now() / 1000) {
            throw new Error('Token expired');
        }
        
        // Resolve public key
        const publicKey = await this.resolvePublicKey(clientId);
        if (!publicKey) {
            throw new Error('Public key not found');
        }
        
        // Verify signature
        return jwt.verify(clientAuth, publicKey, { 
            algorithms: ['RS256'],
            subject: clientId,
            maxAge: '5m'
        });
    }
}
```

---

## Demo Repository

A reference implementation and demo are available at [https://github.com/lironsher/MCPClientAuthDemo](https://github.com/lironsher/MCPClientAuthDemo).

## Future Considerations

**Enhanced Trust Models:**
- Certificate chain validation for enterprise deployments
- Hardware security module (HSM) integration for key storage
- Multi-signature schemes for high-security environments

**Advanced Features:**
- Client capability attestation beyond identity
- Dynamic policy updates based on client behavior
- Revocation lists for compromised clients

**Ecosystem Integration:**
- Standard client registry for popular MCP implementations  
- Automated key distribution for CI/CD environments
- Integration with existing PKI infrastructure

---

## Acknowledgments

Special thanks to the MCP community for feedback on early drafts, and to the maintainers for guidance on specification structure and security considerations.

---

## Changelog

- **v1.0**: Initial proposal with basic JWT verification
- **v1.1**: Added detailed error handling and key resolver specifications
- **v1.2**: Enhanced security considerations and implementation examples