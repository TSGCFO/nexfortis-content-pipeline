<!-- Source: https://cursor.com/docs/api -->
<!-- Title: Cursor APIs Overview | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/api#main-content)

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

# Cursor APIs Overview

Cursor provides multiple APIs for programmatic access to your team's data, AI-powered coding agents, and analytics.

## [Available APIs](https://cursor.com/docs/api\#available-apis)

| API | Description | Availability |
| --- | --- | --- |
| [Admin API](https://cursor.com/docs/account/teams/admin-api) | Manage team members, settings, usage data, and spending. Build custom dashboards and monitoring tools. | Enterprise teams |
| [Analytics API](https://cursor.com/docs/account/teams/analytics-api) | Comprehensive insights into team's Cursor usage, AI metrics, active users, and model usage. | Enterprise teams |
| [AI Code Tracking API](https://cursor.com/docs/account/teams/ai-code-tracking-api) | Track AI-generated code contributions at commit and change levels for attribution and analytics. | Enterprise teams |
| [Cloud Agents API](https://cursor.com/docs/cloud-agent/api/endpoints) | Programmatically create and manage AI-powered coding agents for automated workflows and code generation. | Beta (All Plans) |
| [TypeScript SDK](https://cursor.com/docs/sdk/typescript) | Run Cursor agents from TypeScript with one interface for local and cloud runtimes. | All users |
| [Python SDK](https://cursor.com/docs/sdk/python) | Run Cursor agents from Python with sync and async clients for local and cloud runtimes. | All users |

## [Authentication](https://cursor.com/docs/api\#authentication)

All Cursor APIs accept Basic Authentication. The Cloud Agents API additionally accepts Bearer tokens — pick whichever is easier for your HTTP client.

### [Basic Authentication](https://cursor.com/docs/api\#basic-authentication)

Use your API key as the username in basic authentication (leave password empty):

```
curl https://api.cursor.com/teams/members \
  -u YOUR_API_KEY:
```

Or set the Authorization header directly:

```
Authorization: Basic {base64_encode('YOUR_API_KEY:')}
```

### [Bearer Authentication (Cloud Agents API)](https://cursor.com/docs/api\#bearer-authentication-cloud-agents-api)

The [Cloud Agents API](https://cursor.com/docs/cloud-agent/api/endpoints) also accepts `Authorization: Bearer <key>` headers. Both schemes behave identically — use whichever your HTTP client makes easier:

```
curl https://api.cursor.com/v1/me \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### [Creating API Keys](https://cursor.com/docs/api\#creating-api-keys)

API keys are created from your team settings. Only team administrators can create and manage API keys.

#### [Admin API & AI Code Tracking API](https://cursor.com/docs/api\#admin-api-ai-code-tracking-api)

1. Navigate to **cursor.com/dashboard** → **Settings** tab → **Advanced** → **Admin API Keys**
2. Click **Create New API Key**
3. Give your key a descriptive name (e.g., "Usage Dashboard Integration")
4. Copy the generated key immediately - you won't see it again

Key format: `crsr_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

Required scope: `admin:*`

#### [Analytics API](https://cursor.com/docs/api\#analytics-api)

Generate an API key from your [team settings page](https://cursor.com/settings).

#### [Cloud Agents API](https://cursor.com/docs/api\#cloud-agents-api)

Create a user API key from [Cursor Dashboard → Integrations](https://cursor.com/dashboard/integrations), or use a [service account API key](https://cursor.com/docs/account/enterprise/service-accounts) from team settings.

API keys are tied to your organization and viewable by all admins. Keys are unaffected by the original creator's account status.

## [Rate Limits](https://cursor.com/docs/api\#rate-limits)

All APIs implement rate limiting to ensure fair usage and system stability. Rate limits are enforced per team and reset every minute.

### [Rate Limits by API](https://cursor.com/docs/api\#rate-limits-by-api)

| API | Endpoint Type | Rate Limit |
| --- | --- | --- |
| **Admin API** | Most endpoints | 20 requests/minute |
| **Admin API** | `/teams/user-spend-limit` | 250 requests/minute |
| **Analytics API** | Most team-level endpoints | 100 requests/minute |
| **Analytics API** | `/analytics/team/conversation-insights` | 20 requests/minute |
| **Analytics API** | By-user endpoints | 50 requests/minute |
| **AI Code Tracking API** | All endpoints | 20 requests/minute per endpoint |
| **Cloud Agents API** | All endpoints | Standard rate limiting |

### [Rate Limit Response](https://cursor.com/docs/api\#rate-limit-response)

When you exceed the rate limit, you'll receive a `429 Too Many Requests` response:

```
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Please try again later."
}
```

## [Caching](https://cursor.com/docs/api\#caching)

Several APIs support HTTP caching with ETags to reduce bandwidth usage and improve performance.

### [Supported APIs](https://cursor.com/docs/api\#supported-apis)

- **Analytics API**: All endpoints (both team-level and by-user) support HTTP caching
- **AI Code Tracking API**: Endpoints support HTTP caching

### [How Caching Works](https://cursor.com/docs/api\#how-caching-works)

1. **Initial Request**: Make a request to any supported endpoint
2. **Response Includes ETag**: The API returns an `ETag` header in the response
3. **Subsequent Requests**: Include the `ETag` value in an `If-None-Match` header
4. **304 Not Modified**: If data hasn't changed, you'll receive a `304 Not Modified` response with no body

### [Example](https://cursor.com/docs/api\#example)

```
# Initial request
curl -X GET "https://api.cursor.com/analytics/team/dau" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -D headers.txt

# Response includes: ETag: "abc123xyz"

# Subsequent request with ETag
curl -X GET "https://api.cursor.com/analytics/team/dau" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "If-None-Match: \"abc123xyz\""

# Returns 304 Not Modified if data hasn't changed
```

### [Cache Duration](https://cursor.com/docs/api\#cache-duration)

- Cache duration: 15 minutes (`Cache-Control: public, max-age=900`)
- Responses include an `ETag` header
- Include `If-None-Match` header in subsequent requests to receive `304 Not Modified` when data hasn't changed

### [Benefits](https://cursor.com/docs/api\#benefits)

- **Reduces bandwidth usage**: 304 responses contain no body
- **Faster responses**: Avoids processing unchanged data
- **Rate limit friendly**: 304 responses don't count against rate limits
- **Better performance**: Especially useful for frequently polled endpoints

## [Best Practices](https://cursor.com/docs/api\#best-practices)

### [1\. Implement Exponential Backoff](https://cursor.com/docs/api\#1-implement-exponential-backoff)

When you receive a 429 response, wait before retrying with increasing delays:

```
import time
import requests

def make_request_with_backoff(url, headers, max_retries=5):
    for attempt in range(max_retries):
        response = requests.get(url, headers=headers)

        if response.status_code == 429:
            # Exponential backoff: 1s, 2s, 4s, 8s, 16s
            wait_time = 2 ** attempt
            print(f"Rate limited. Waiting {wait_time}s before retry...")
            time.sleep(wait_time)
            continue

        return response

    raise Exception("Max retries exceeded")
```

### [2\. Distribute Requests Over Time](https://cursor.com/docs/api\#2-distribute-requests-over-time)

Spread your API calls over time rather than making burst requests:

- Schedule batch jobs to run at different intervals
- Add delays between requests when processing large datasets
- Use queuing systems to smooth out traffic spikes

### [3\. Leverage Caching](https://cursor.com/docs/api\#3-leverage-caching)

**For Analytics API and AI Code Tracking API:**

These APIs support HTTP caching with ETags. See the [Caching](https://cursor.com/docs/api#caching) section above for details on how to use ETags to reduce bandwidth usage and avoid unnecessary requests.

**Key benefits:**

- Reduces bandwidth usage
- Faster responses when data hasn't changed
- Doesn't count against rate limits (for 304 responses)

Use date shortcuts (`7d`, `30d`) instead of timestamps for better caching support in Analytics API.

### [4\. Monitor Your Usage](https://cursor.com/docs/api\#4-monitor-your-usage)

Track your request patterns to stay within limits:

- Log API call timestamps and response codes
- Set up alerts for 429 responses
- Monitor daily/weekly usage trends
- Adjust polling intervals based on actual needs

### [5\. Batch Wisely](https://cursor.com/docs/api\#5-batch-wisely)

For endpoints with pagination:

- Use appropriate page sizes to get more data per request
- For Analytics API by-user endpoints: Use `users` parameter to filter specific users
- For large data extractions: Use CSV endpoints when available (they stream data efficiently)

### [6\. Poll at Appropriate Intervals](https://cursor.com/docs/api\#6-poll-at-appropriate-intervals)

Don't over-poll endpoints that update infrequently:

- **Admin API**`/teams/daily-usage-data`: Poll at most once per hour (data aggregated hourly)
- **Admin API**`/teams/filtered-usage-events`: Poll at most once per hour (data aggregated hourly)
- **Analytics API**: Use date shortcuts (`7d`, `30d`) for better caching support
- **AI Code Tracking API**: Data is ingested in near real-time but polling every few minutes is sufficient

### [7\. Handle Errors Gracefully](https://cursor.com/docs/api\#7-handle-errors-gracefully)

Implement proper error handling for all API calls:

```
async function fetchAnalytics(endpoint) {
  try {
    const response = await fetch(`https://api.cursor.com${endpoint}`, {
      headers: {
        'Authorization': `Basic ${btoa(API_KEY + ':')}`
      }
    });

    if (response.status === 429) {
      // Rate limited - implement backoff
      throw new Error('Rate limit exceeded');
    }

    if (response.status === 401) {
      // Invalid API key
      throw new Error('Authentication failed');
    }

    if (response.status === 403) {
      // Insufficient permissions
      throw new Error('Enterprise access required');
    }

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}
```

## [Common Error Responses](https://cursor.com/docs/api\#common-error-responses)

All APIs use standard HTTP status codes:

### [400 Bad Request](https://cursor.com/docs/api\#400-bad-request)

Request parameters are invalid or missing required fields.

```
{
  "error": "Bad Request",
  "message": "Some users are not in the team"
}
```

### [401 Unauthorized](https://cursor.com/docs/api\#401-unauthorized)

Invalid or missing API key.

```
{
  "error": "Unauthorized",
  "message": "Invalid API key"
}
```

### [403 Forbidden](https://cursor.com/docs/api\#403-forbidden)

Valid API key but insufficient permissions (e.g., Enterprise features on non-Enterprise plan).

```
{
  "error": "Forbidden",
  "message": "Enterprise access required"
}
```

### [404 Not Found](https://cursor.com/docs/api\#404-not-found)

Requested resource doesn't exist.

```
{
  "error": "Not Found",
  "message": "Resource not found"
}
```

### [429 Too Many Requests](https://cursor.com/docs/api\#429-too-many-requests)

Rate limit exceeded. Implement exponential backoff.

```
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Please try again later."
}
```

### [500 Internal Server Error](https://cursor.com/docs/api\#500-internal-server-error)

Server-side error. Contact support if persistent.

```
{
  "error": "Internal Server Error",
  "message": "An unexpected error occurred"
}
```

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