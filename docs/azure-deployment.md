# Deploy ask-slack-mcp-server to Azure

Since the server is published on npm, the simplest Azure option is **Azure App Service** (Node.js) — no Docker or container registry needed. Azure pulls the package from npm and runs it directly.

For Docker-based workflows, **Azure Container Apps** is also a good fit.

---

## Option 1 — Azure App Service (recommended)

No Docker needed. Azure runs the npm package directly on a managed Node.js runtime.

### Create via Azure CLI

```bash
# Create resource group + App Service plan
az group create --name ask-slack-rg --location eastus
az appservice plan create \
  --name ask-slack-plan \
  --resource-group ask-slack-rg \
  --sku B1 \
  --is-linux

# Create the web app (Node 24)
az webapp create \
  --name ask-slack-mcp \
  --resource-group ask-slack-rg \
  --plan ask-slack-plan \
  --runtime "NODE:24-lts"

# Set startup command
az webapp config set \
  --name ask-slack-mcp \
  --resource-group ask-slack-rg \
  --startup-file "npx ask-slack-mcp-server"

# Set environment variables
az webapp config appsettings set \
  --name ask-slack-mcp \
  --resource-group ask-slack-rg \
  --settings \
    ASK_SLACK_API_KEY=your-secret-api-key \
    SLACK_BOT_TOKEN=xoxb-... \
    SLACK_APP_TOKEN=xapp-... \
    SLACK_SIGNING_SECRET=... \
    PORT=8080 \
    WEBSITES_PORT=8080
```

Your server URL: `https://ask-slack-mcp.azurewebsites.net`

### Notes

- App Service sets `PORT` automatically, but Socket Mode uses outbound WebSocket — no inbound port issues.
- The `B1` plan ($13/month) is enough. `F1` (free) has limitations with always-on.
- Enable **Always On** in App Service settings to prevent the server from being stopped after idle timeout:

```bash
az webapp config set \
  --name ask-slack-mcp \
  --resource-group ask-slack-rg \
  --always-on true
```

---

## Option 2 — Azure Container Apps (Docker)

Use the `Dockerfile` from the `server/` folder. Good if you want more control or already use containers.

```bash
# Create container registry
az acr create --name askslackmcp --resource-group ask-slack-rg --sku Basic
az acr login --name askslackmcp

# Build & push (from server/ folder)
cd server
docker build -t askslackmcp.azurecr.io/ask-slack-mcp-server:latest .
docker push askslackmcp.azurecr.io/ask-slack-mcp-server:latest

# Create Container Apps environment
az containerapp env create \
  --name ask-slack-env \
  --resource-group ask-slack-rg \
  --location eastus

# Deploy
az containerapp create \
  --name ask-slack-mcp \
  --resource-group ask-slack-rg \
  --environment ask-slack-env \
  --image askslackmcp.azurecr.io/ask-slack-mcp-server:latest \
  --registry-server askslackmcp.azurecr.io \
  --target-port 3000 \
  --ingress external \
  --min-replicas 1 \
  --env-vars \
    ASK_SLACK_API_KEY=your-secret-api-key \
    SLACK_BOT_TOKEN=xoxb-... \
    SLACK_APP_TOKEN=xapp-... \
    SLACK_SIGNING_SECRET=...
```

Your server URL: `https://ask-slack-mcp.<region>.azurecontainerapps.io`

### Tip: use npm directly (no Dockerfile needed)

You can skip building a custom image entirely:

```bash
az containerapp create \
  --name ask-slack-mcp \
  --resource-group ask-slack-rg \
  --environment ask-slack-env \
  --image node:20-alpine \
  --target-port 3000 \
  --ingress external \
  --min-replicas 1 \
  --command "npx" "ask-slack-mcp-server" \
  --env-vars \
    ASK_SLACK_API_KEY=your-secret-api-key \
    SLACK_BOT_TOKEN=xoxb-... \
    SLACK_APP_TOKEN=xapp-... \
    SLACK_SIGNING_SECRET=...
```

---

## Configure the client

Once the server is running, configure each user's MCP client:

```json
{
  "mcpServers": {
    "ask-slack-mcp": {
      "command": "npx",
      "args": ["-y", "ask-slack-mcp"],
      "env": {
        "ASK_SLACK_API_URL": "https://ask-slack-mcp.azurewebsites.net",
        "ASK_SLACK_API_KEY": "your-secret-api-key",
        "SLACK_USER_ID": "U01XXXXXXX"
      }
    }
  }
}
```

## Verify

```bash
curl https://ask-slack-mcp.azurewebsites.net/health
# {"status":"ok","version":"2.0.0"}
```
