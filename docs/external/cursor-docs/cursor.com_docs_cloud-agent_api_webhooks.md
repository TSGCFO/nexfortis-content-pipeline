<!-- Source: https://cursor.com/docs/cloud-agent/api/webhooks -->
<!-- Title: Webhooks | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/cloud-agent/api/webhooks#main-content)

## Command Palette

Search for a command to run...

## API Overview

[Overview](https://cursor.com/docs/api) [Authentication](https://cursor.com/docs/api#authentication) [Rate Limits](https://cursor.com/docs/api#rate-limits) [Best Practices](https://cursor.com/docs/api#best-practices)

## Cloud Agents API

[Overview](https://cursor.com/docs/cloud-agent/api/endpoints) [Create An Agent](https://cursor.com/docs/cloud-agent/api/endpoints#create-an-agent) [List Agents](https://cursor.com/docs/cloud-agent/api/endpoints#list-agents) [Get An Agent](https://cursor.com/docs/cloud-agent/api/endpoints#get-an-agent) [Create A Run](https://cursor.com/docs/cloud-agent/api/endpoints#create-a-run) [List Runs](https://cursor.com/docs/cloud-agent/api/endpoints#list-runs) [Get A Run](https://cursor.com/docs/cloud-agent/api/endpoints#get-a-run) [Stream A Run](https://cursor.com/docs/cloud-agent/api/endpoints#stream-a-run) [Cancel A Run](https://cursor.com/docs/cloud-agent/api/endpoints#cancel-a-run) [List Artifacts](https://cursor.com/docs/cloud-agent/api/endpoints#list-artifacts) [Download Artifact](https://cursor.com/docs/cloud-agent/api/endpoints#download-an-artifact) [Archive An Agent](https://cursor.com/docs/cloud-agent/api/endpoints#archive-an-agent) [Unarchive An Agent](https://cursor.com/docs/cloud-agent/api/endpoints#unarchive-an-agent) [Delete An Agent](https://cursor.com/docs/cloud-agent/api/endpoints#delete-an-agent-permanently) [Worker Tokens](https://cursor.com/docs/cloud-agent/api/endpoints#worker-tokens) [List Workers](https://cursor.com/docs/cloud-agent/api/endpoints#list-workers) [Get Fleet Summary](https://cursor.com/docs/cloud-agent/api/endpoints#get-fleet-summary) [Get Worker By ID](https://cursor.com/docs/cloud-agent/api/endpoints#get-worker-by-id) [List Pending Pool Requests](https://cursor.com/docs/cloud-agent/api/endpoints#list-pending-pool-requests) [API Key Info](https://cursor.com/docs/cloud-agent/api/endpoints#api-key-info) [List Models](https://cursor.com/docs/cloud-agent/api/endpoints#list-models) [List Repositories](https://cursor.com/docs/cloud-agent/api/endpoints#list-github-repositories) [Webhooks](https://cursor.com/docs/cloud-agent/api/webhooks)

## Admin API

[Overview](https://cursor.com/docs/account/teams/admin-api) [Team Members](https://cursor.com/docs/account/teams/admin-api#get-team-members) [Audit Logs](https://cursor.com/docs/account/teams/admin-api#get-audit-logs) [Get Daily Usage Data](https://cursor.com/docs/account/teams/admin-api#get-daily-usage-data) [Spending Data](https://cursor.com/docs/account/teams/admin-api#get-spending-data) [Get Usage Events Data](https://cursor.com/docs/account/teams/admin-api#get-usage-events-data) [User Spend Limit](https://cursor.com/docs/account/teams/admin-api#set-user-spend-limit) [Remove Team Member](https://cursor.com/docs/account/teams/admin-api#remove-team-member) [Get Repo Blocklists](https://cursor.com/docs/account/teams/admin-api#get-team-repo-blocklists) [Upsert Repo Blocklists](https://cursor.com/docs/account/teams/admin-api#upsert-repo-blocklists) [Delete Repo Blocklist](https://cursor.com/docs/account/teams/admin-api#delete-repo-blocklist) [Billing Groups](https://cursor.com/docs/account/teams/admin-api#billing-groups) [List Groups](https://cursor.com/docs/account/teams/admin-api#list-groups) [Get Group](https://cursor.com/docs/account/teams/admin-api#get-group) [Create Group](https://cursor.com/docs/account/teams/admin-api#create-group) [Update Group](https://cursor.com/docs/account/teams/admin-api#update-group) [Delete Group](https://cursor.com/docs/account/teams/admin-api#delete-group) [Add Members to Group](https://cursor.com/docs/account/teams/admin-api#add-members-to-group) [Remove Members from Group](https://cursor.com/docs/account/teams/admin-api#remove-members-from-group)

## Analytics API

[Overview](https://cursor.com/docs/account/teams/analytics-api) [Agent Edits](https://cursor.com/docs/account/teams/analytics-api#agent-edits) [Tab Usage](https://cursor.com/docs/account/teams/analytics-api#tab-usage) [Daily Active Users](https://cursor.com/docs/account/teams/analytics-api#daily-active-users-dau) [Client Versions](https://cursor.com/docs/account/teams/analytics-api#client-versions) [Model Usage](https://cursor.com/docs/account/teams/analytics-api#model-usage) [Top File Extensions](https://cursor.com/docs/account/teams/analytics-api#top-file-extensions) [MCP Adoption](https://cursor.com/docs/account/teams/analytics-api#mcp-adoption) [Commands Adoption](https://cursor.com/docs/account/teams/analytics-api#commands-adoption) [Plans Adoption](https://cursor.com/docs/account/teams/analytics-api#plans-adoption) [Skills Adoption](https://cursor.com/docs/account/teams/analytics-api#skills-adoption) [Ask Mode Adoption](https://cursor.com/docs/account/teams/analytics-api#ask-mode-adoption) [Conversation Insights](https://cursor.com/docs/account/teams/analytics-api#conversation-insights) [Leaderboard](https://cursor.com/docs/account/teams/analytics-api#leaderboard) [Bugbot Analytics](https://cursor.com/docs/account/teams/analytics-api#bugbot-analytics) [By-User Endpoints](https://cursor.com/docs/account/teams/analytics-api#by-user-endpoints)

## AI Code Tracking API

[Overview](https://cursor.com/docs/account/teams/ai-code-tracking-api) [Commit Metrics (JSON)](https://cursor.com/docs/account/teams/ai-code-tracking-api#get-ai-commit-metrics-json-paginated) [Commit Metrics (CSV)](https://cursor.com/docs/account/teams/ai-code-tracking-api#download-ai-commit-metrics-csv-streaming) [Code Changes (JSON)](https://cursor.com/docs/account/teams/ai-code-tracking-api#get-ai-code-change-metrics-json-paginated) [Code Changes (CSV)](https://cursor.com/docs/account/teams/ai-code-tracking-api#download-ai-code-change-metrics-csv-streaming)

API

Copy pageShare feedbackExplain more

# Webhooks

When you create an agent with a webhook URL, Cursor will send HTTP POST requests to notify you about status changes. Currently, only `statusChange` events are supported, specifically when an agent encounters an `ERROR` or `FINISHED` state.

## [Webhook verification](https://cursor.com/docs/cloud-agent/api/webhooks\#webhook-verification)

To ensure the webhook requests are authentically from Cursor, verify the signature included with each request:

### [Headers](https://cursor.com/docs/cloud-agent/api/webhooks\#headers)

Each webhook request includes the following headers:

- **`X-Webhook-Signature`** – Contains the HMAC-SHA256 signature in the format `sha256=<hex_digest>`
- **`X-Webhook-ID`** – A unique identifier for this delivery (useful for logging)
- **`X-Webhook-Event`** – The event type (currently only `statusChange`)
- **`User-Agent`** – Always set to `Cursor-Agent-Webhook/1.0`

### [Signature verification](https://cursor.com/docs/cloud-agent/api/webhooks\#signature-verification)

To verify the webhook signature, compute the expected signature and compare it with the received signature:

```
const crypto = require("crypto");

function verifyWebhook(secret, rawBody, signature) {
  const expectedSignature =
    "sha256=" +
    crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

  return signature === expectedSignature;
}
```

```
import hmac
import hashlib

def verify_webhook(secret, raw_body, signature):
    expected_signature = 'sha256=' + hmac.new(
        secret.encode(),
        raw_body,
        hashlib.sha256
    ).hexdigest()

    return signature == expected_signature
```

Always use the raw request body (before any parsing) when computing the signature.

## [Payload format](https://cursor.com/docs/cloud-agent/api/webhooks\#payload-format)

The webhook payload is sent as JSON with the following structure:

```
{
  "event": "statusChange",
  "timestamp": "2024-01-15T10:30:00Z",
  "id": "bc_abc123",
  "status": "FINISHED",
  "source": {
    "repository": "https://github.com/your-org/your-repo",
    "ref": "main"
  },
  "target": {
    "url": "https://cursor.com/agents?id=bc_abc123",
    "branchName": "cursor/add-readme-1234",
    "prUrl": "https://github.com/your-org/your-repo/pull/1234"
  },
  "summary": "Added README.md with installation instructions"
}
```

Note that some fields are optional and will only be included when available.

## [Best practices](https://cursor.com/docs/cloud-agent/api/webhooks\#best-practices)

- **Verify signatures** – Always verify the webhook signature to ensure the request is from Cursor
- **Handle retries** – Webhooks may be retried if your endpoint returns an error status code
- **Return quickly** – Return a 2xx status code as soon as possible
- **Use HTTPS** – Always use HTTPS URLs for webhook endpoints in production
- **Store raw payloads** – Store the raw webhook payload for debugging and future verification

English

- English
- 简体中文
- 日本語
- 繁體中文
- Español
- Français
- Português
- 한국어
- Русский
- Türkçe
- Bahasa Indonesia
- Deutsch
- हिन्दी

Agent

Tokenizer OffContext: 0/200k (0%)

Open chat