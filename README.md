# Opxia InfraPulse

InfraPulse is a full-stack infrastructure visualization app that helps you connect cloud and Kubernetes environments, scan their resources, and explore them as interactive graphs.

Today, the project supports:

- AWS account connections using access keys
- ROSA-style Kubernetes cluster connections using API server + bearer token
- Interactive infrastructure graph visualization
- AWS resource relationship mapping
- AI chat over scanned AWS infrastructure metadata
- Local authentication with optional Google OAuth

## What The App Does

InfraPulse has two main usage modes:

1. AWS infrastructure exploration
2. Kubernetes namespace exploration

For AWS, a user can connect an account, scan supported resource types, cache the scanned graph, and ask natural-language questions about the scanned environment.

For Kubernetes, a user can connect a cluster, select a namespace, fetch supported resources, inspect relationships, view deployment environment variables, and read pod logs.

## Architecture

The repo is an npm workspace with two applications:

- `server/`: Node.js + Express + TypeScript backend
- `client/`: React + Vite + TypeScript frontend

High-level flow:

1. The frontend calls backend REST APIs under `/api/*`.
2. The backend authenticates the user with session cookies.
3. Credentials for AWS and Kubernetes are stored encrypted in SQLite.
4. AWS scans call the AWS SDK and convert resources into graph nodes and edges.
5. Kubernetes fetches call the Kubernetes client and convert namespace resources into graph nodes and edges.
6. The dashboard renders those graphs with React Flow.
7. The AI chat feature answers questions using cached AWS graph data, not direct live cloud queries.

## Tech Stack

### Frontend

- React 19
- React Router
- Vite
- TypeScript
- Tailwind CSS
- React Flow
- Socket.IO client
- Lucide React icons

### Backend

- Node.js
- Express
- TypeScript
- Passport.js
- `express-session`
- `better-sqlite3`
- AWS SDK v3
- `@kubernetes/client-node`
- Socket.IO
- Axios

### Database

- SQLite
- Local database files under `server/infrapulse.db*`
- SQL-based migrations in `server/src/db/migrations/`

## Current Feature Coverage

### AWS

Currently implemented resource discovery includes:

- Compute: EC2, Lambda
- Database and cache: RDS, ElastiCache
- Storage: S3
- Networking: VPC, Subnet, Route Table, Transit Gateway, VPC Endpoint, Internet Gateway, NAT Gateway, Elastic IP, DHCP Options, Network ACL, VPN
- Security: Secrets Manager, KMS, ACM, WAF
- Content and API: CloudFront, API Gateway, ELB, Route 53
- Messaging: SNS, SES

### Kubernetes

Currently implemented Kubernetes resources include:

- Deployments
- StatefulSets
- DaemonSets
- Pods
- Jobs
- CronJobs
- Services
- Ingresses
- Secrets
- ConfigMaps
- PersistentVolumeClaims
- Cluster Nodes

### Authentication

- Email/password registration and login
- Session-based auth with cookies
- Optional Google OAuth login

### AI Chat

- Questions are answered from scanned AWS resource metadata
- Chat first classifies intent, then builds context, then sends that context to Globant Enterprise AI
- The assistant is intentionally limited to configuration and metadata that already exists in the cached graph

## Repository Structure

```text
.
├── client/
│   ├── src/
│   │   ├── components/      # UI building blocks
│   │   ├── config/          # Resource metadata used by the UI
│   │   ├── hooks/           # Data-fetching and graph state hooks
│   │   ├── lib/             # API and Socket.IO helpers
│   │   └── pages/           # Route-level screens
├── server/
│   ├── src/
│   │   ├── auth/            # Login, registration, sessions, Passport setup
│   │   ├── aws/             # AWS discovery, resource adapters, metrics helpers
│   │   ├── chatbot/         # Intent analysis, context building, LLM calls
│   │   ├── db/              # SQLite connection and SQL migrations
│   │   ├── graph/           # Graph edge inference and graph routes
│   │   ├── kubernetes/      # K8s clients, discovery, logs, routes
│   │   ├── providers/       # Cloud credential storage and verification
│   │   └── realtime/        # Socket.IO and metric pulse plumbing
├── package.json             # Workspace scripts
└── README.md
```

## How AWS Works In This Project

When a user adds an AWS provider:

1. The frontend submits a label, region, access key ID, secret access key, and optional session token.
2. The backend verifies the credentials using `STS GetCallerIdentity`.
3. The credentials are encrypted with AES-256-GCM before being stored in SQLite.
4. A later graph scan decrypts the credentials in memory and uses the AWS SDK to discover resources.
5. The backend converts discovered resources into graph nodes.
6. The graph builder infers relationships, such as EC2-to-subnet or CloudFront-to-S3.
7. The finished graph is cached in the database so it can be reopened without scanning again.

## How Kubernetes Works In This Project

When a user adds a Kubernetes cluster:

1. The frontend submits a label, API server URL, bearer token, and TLS preference.
2. The backend encrypts the token and tries a namespace list call to verify access.
3. After the cluster is saved, the frontend can load namespaces.
4. The dashboard requests selected resource types for a chosen namespace.
5. The backend fetches raw Kubernetes objects and normalizes them into graph nodes and edges.
6. The frontend renders the namespace graph and lets the user inspect details.

Extra Kubernetes inspection features:

- Deployment/statefulset environment variables
- Pod log viewing
- Ingress-to-service relationship display
- Service selector matching to deployments and statefulsets

## How The AI Chat Works

The AI feature is implemented only for AWS graphs.

Flow:

1. A user scans AWS resources first.
2. The graph is stored in `cached_graphs`.
3. The user sends a question from the dashboard chat panel.
4. The backend loads the cached graph for that provider.
5. An intent-analysis step asks the LLM to identify resource types, filters, and whether the question is answerable from available data.
6. The backend builds a compact context string from matching resources.
7. The backend sends the system prompt + user prompt to Globant Enterprise AI.
8. The final answer is returned to the chat panel.

The current LLM integration uses:

- Endpoint: Globant SAIA chat API
- Auth: `GLOBANT_API_KEY`
- Model string used by the code: `openai/gpt-4o-mini`

Important behavior:

- The chat is grounded on cached infrastructure metadata.
- It is designed to refuse questions about unavailable data such as logs, errors, CPU, latency, traffic, or runtime metrics when that data is not present in the cached graph context.

## Database And Migrations

InfraPulse uses SQLite for local persistence.

Main tables:

- `users`: user accounts
- `sessions`: session store for logged-in users
- `provider_credentials`: encrypted AWS credentials and provider metadata
- `cached_graphs`: cached AWS graph results
- `kubernetes_clusters`: encrypted Kubernetes cluster credentials
- `_migrations`: tracks which SQL migration files were already applied

Migrations are plain `.sql` files that run automatically when the server starts. They let the schema evolve safely over time instead of manually changing the database each time.

Current migrations in this repo:

- `001_init.sql`: creates users, sessions, and AWS provider credential tables
- `002_credential_type.sql`: adds `credential_type` to distinguish permanent vs temporary AWS credentials
- `003_cached_graphs.sql`: adds cached graph storage
- `004_fetch_tags.sql`: tracks whether a cached graph was scanned with tag fetching enabled
- `005_kubernetes_clusters.sql`: adds Kubernetes cluster storage

## Local Development

### Prerequisites

- Node.js 20+
- npm

### Install

```bash
npm install
```

### Environment Variables

Create a root-level `.env` file.

```env
PORT=3000
SESSION_SECRET=replace-with-a-long-random-secret
CREDENTIAL_ENCRYPTION_KEY=replace-with-a-32+-character-secret
CLIENT_URL=http://localhost:5173

# Optional Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback

# Required for AI chat
GLOBANT_API_KEY=
```

Notes:

- The backend loads `.env` from the repository root.
- Google login only works when the Google OAuth values are configured correctly.
- The AI chat feature requires `GLOBANT_API_KEY`.
- Do not commit real secrets to a public repository.

### Run In Development

Start both apps:

```bash
npm run dev
```

Or run them separately:

```bash
npm run dev:server
npm run dev:client
```

Default local URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`

In development, Vite proxies `/api` and `/socket.io` to the backend server.

### Build

```bash
npm run build
```

### Start Production Build

```bash
npm run start
```

The production server serves the built frontend from `client/dist`.

## UI Overview

### Dashboard

- Select an AWS provider or Kubernetes cluster
- Scan AWS resources or fetch Kubernetes resources
- Explore the graph
- Inspect a node in the detail panel
- Open chat for AWS infrastructure questions

### Providers

- Add and remove AWS accounts
- Supports permanent credentials and temporary credentials with session token

### Kubernetes

- Add and remove cluster connections
- View available clusters and load namespace resources

## Important Notes For Contributors

- AWS and ROSA are the currently active integrations.
- GCP, Azure, EKS, AKS, and GKE appear in the UI as placeholders but are not implemented yet.
- SQLite is currently used as the local persistence layer; this is convenient for development but may not fit multi-user production deployments.
- There is Socket.IO and CloudWatch metric plumbing in the codebase for AWS pulse updates, but contributors should review the realtime wiring before describing it as a fully active feature.

## Security Notes

- Cloud and cluster credentials are encrypted before being stored, but they still represent sensitive access and should be handled carefully.
- Session secrets, OAuth secrets, encryption keys, and API keys must be kept out of git history.
- Database files and `.env` files should not be published with real values in a public repo.

## Contributing

Contributions are welcome. A good starting workflow is:

1. Fork or branch the repository
2. Run the app locally
3. Make a focused change
4. Update documentation when behavior changes
5. Open a pull request with a clear description of the change

## License

Add a license file before publishing publicly if you want contributors and users to have clear usage terms.
