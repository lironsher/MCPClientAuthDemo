# MCP Client Authentication Demo

This project demonstrates client authentication in Model Context Protocol (MCP) with a Python server and TypeScript client.

## Motivation

Out of the box, **MCP v2025‑06‑18 provides no mechanism to verify which application** is acting as the client. That leaves deployments vulnerable to misuse or malicious client implementations. Common use cases include:

- Only Claude‑signed “com.claude.desktop” is authorized on Claude.ai servers.
- Internal MCP servers only accept enterprise‑distributed tools.
- Local MCP instances restrict API access to approved tooling.

---

## Project Structure

```
demo/
├── PyMcpServer/          # Python MCP Server with authentication
│   ├── server.py         # Main server implementation
│   ├── clientAuth.py     # Authentication logic
│   ├── public.pem        # Public key for JWT verification
│   └── pyproject.toml    # Python dependencies
└── TSMcpClient/          # TypeScript MCP Client
    ├── src/
    │   ├── index.ts      # Client entry point
    │   ├── mcpClient.ts  # Main client implementation
    │   ├── clientAuth.ts # Client authentication logic
    │   └── private.pem   # Private key for JWT signing
    └── package.json      # Node.js dependencies
```

## Prerequisites

- **Python 3.10+** with `uv` package manager
- **Node.js 16+** with `npm`
- **Git** (optional, for cloning)

## Quick Start

### 1. Running the Python MCP Server

Navigate to the server directory and start the server:

```bash
cd PyMcpServer
uv run server.py
```

The server will start and listen for MCP connections. You should see output indicating the server is running.

### 2. Running the TypeScript MCP Client

In a new terminal, navigate to the client directory, install dependencies, and run the client:

```bash
cd TSMcpClient
npm install
npm run dev
```

Alternatively, you can build and run the compiled version:

```bash
npm run build
npm start
```

## Development

### Server Development

The Python server uses FastMCP and includes:
- JWT-based client authentication
- Public key verification
- Client metadata extraction

**Available commands:**
```bash
cd PyMcpServer

# Run the server directly
uv run server.py

# Run tests
uv run test_server.py

# Install dependencies
uv sync
```

### Client Development

The TypeScript client is a CLI application that:
- Connects to the MCP server
- Handles JWT authentication
- Demonstrates client-server communication

**Available commands:**
```bash
cd TSMcpClient

# Development mode (with hot reload)
npm run dev

# Build the project
npm run build

# Run the built version
npm start

# Watch mode for development
npm run watch

# Debug mode
npm run debug

# Linting
npm run lint
npm run lint:fix

# Clean build artifacts
npm run clean
```

## Authentication

This demo uses JWT (JSON Web Tokens) for client authentication:

- The **client** signs JWTs using a private key (`TSMcpClient/src/private.pem`)
- The **server** verifies JWTs using the corresponding public key (`PyMcpServer/public.pem`)
- Authentication is performed during the MCP initialization handshake

## Docker Support

The server includes a Dockerfile for containerized deployment:

```bash
cd PyMcpServer
docker build -t mcp-server .
docker run -p 8000:8000 mcp-server
```

## Troubleshooting

### Common Issues

1. **Server fails to start**: Ensure Python 3.10+ and `uv` are installed
2. **Client connection fails**: Verify the server is running and accessible
3. **Authentication errors**: Check that public/private key pairs match
4. **Port conflicts**: The server may use different ports; check server output

### Debugging

- Use `npm run debug` for client-side debugging
- Check server logs for authentication details
- Verify JWT token generation and validation

## Key Files

- `PyMcpServer/server.py` - Main server implementation
- `PyMcpServer/clientAuth.py` - JWT verification logic
- `TSMcpClient/src/mcpClient.ts` - Client implementation
- `TSMcpClient/src/clientAuth.ts` - JWT signing logic