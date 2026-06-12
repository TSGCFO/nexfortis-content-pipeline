<!-- Source: https://cursor.com/docs/customizing/aws-bedrock -->
<!-- Title: AWS Bedrock | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/customizing/aws-bedrock#main-content)

## Command Palette

Search for a command to run...

## Get Started

[Welcome](https://cursor.com/docs) [Quickstart](https://cursor.com/docs/get-started/quickstart)
Models & Pricing
[Changelog](https://cursor.com/changelog)

## Agent

[Overview](https://cursor.com/docs/agent/overview) [Agents Window](https://cursor.com/docs/agent/agents-window) [Agent Review](https://cursor.com/docs/agent/agent-review) [Planning](https://cursor.com/docs/agent/plan-mode) [Prompting](https://cursor.com/docs/agent/prompting) [Debugging](https://cursor.com/docs/agent/debug-mode)
Tools
[Security](https://cursor.com/docs/agent/security)

## Customizing

[Plugins](https://cursor.com/docs/plugins) [Rules](https://cursor.com/docs/rules) [Skills](https://cursor.com/docs/skills) [Subagents](https://cursor.com/docs/subagents) [Hooks](https://cursor.com/docs/hooks) [MCP](https://cursor.com/docs/mcp)

## Cloud Agents

[Overview](https://cursor.com/docs/cloud-agent) [Setup](https://cursor.com/docs/cloud-agent/setup) [Capabilities](https://cursor.com/docs/cloud-agent/capabilities) [My Machines](https://cursor.com/docs/cloud-agent/my-machines) [Self-Hosted Pool](https://cursor.com/docs/cloud-agent/self-hosted-pool) [Google Cloud Run](https://cursor.com/docs/cloud-agent/self-hosted-cloud-run) [Bugbot](https://cursor.com/docs/bugbot) [Automations](https://cursor.com/docs/cloud-agent/automations) [Best Practices](https://cursor.com/docs/cloud-agent/best-practices) [Security Agents](https://cursor.com/docs/security-agents) [Security & Network](https://cursor.com/docs/cloud-agent/security-network) [Settings](https://cursor.com/docs/cloud-agent/settings) [API](https://cursor.com/docs/cloud-agent/api/endpoints)

## Integrations

[Slack](https://cursor.com/docs/integrations/slack) [Microsoft Teams](https://cursor.com/docs/integrations/microsoft-teams) [Jira](https://cursor.com/docs/integrations/jira) [Linear](https://cursor.com/docs/integrations/linear) [GitHub](https://cursor.com/docs/integrations/github) [GitLab](https://cursor.com/docs/integrations/gitlab) [JetBrains](https://cursor.com/docs/integrations/jetbrains) [Xcode](https://cursor.com/docs/integrations/xcode) [Deeplinks](https://cursor.com/docs/reference/deeplinks)

## SDK

[TypeScript](https://cursor.com/docs/sdk/typescript) [Python](https://cursor.com/docs/sdk/python)

## CLI

[Overview](https://cursor.com/docs/cli/overview) [Installation](https://cursor.com/docs/cli/installation) [Capabilities](https://cursor.com/docs/cli/using) [Shell Mode](https://cursor.com/docs/cli/shell-mode) [ACP](https://cursor.com/docs/cli/acp) [Headless / CI](https://cursor.com/docs/cli/headless)
Reference

## Teams & Enterprise

Teams

Enterprise

Get Started

# AWS Bedrock

Route AI requests through your AWS Bedrock account instead of Cursor's model providers. This lets your team use existing AWS credits and keep requests within your AWS infrastructure.

![AWS Bedrock settings in Cursor](https://cursor.com/docs-static/images/settings/aws-bedrock-settings.png)

## [IAM role setup (recommended)](https://cursor.com/docs/customizing/aws-bedrock\#iam-role-setup-recommended)

The recommended approach is to create an IAM role that grants Cursor permission to invoke Bedrock models on your behalf.

### [Step 1: Create the IAM role](https://cursor.com/docs/customizing/aws-bedrock\#step-1-create-the-iam-role)

Create a new IAM role with the following trust policy:

```
{
  "Version": "2012-10-17",
  "Statement": [\
    {\
      "Effect": "Allow",\
      "Principal": {\
        "AWS": "arn:aws:iam::289469326074:role/roleAssumer"\
      },\
      "Action": "sts:AssumeRole",\
      "Condition": {\
        "StringEquals": {\
          "sts:ExternalId": "<your-external-id>"\
        }\
      }\
    }\
  ]
}
```

Replace `<your-external-id>` with the External ID shown in the [Cursor dashboard](https://cursor.com/dashboard). This ID is generated after you first validate your Bedrock configuration and prevents the [confused deputy problem](https://docs.aws.amazon.com/IAM/latest/UserGuide/confused-deputy.html).

### [Step 2: Attach permissions](https://cursor.com/docs/customizing/aws-bedrock\#step-2-attach-permissions)

Attach a policy that grants access to the Bedrock models you want to use:

```
{
  "Version": "2012-10-17",
  "Statement": [\
    {\
      "Effect": "Allow",\
      "Action": [\
        "bedrock:InvokeModel",\
        "bedrock:InvokeModelWithResponseStream"\
      ],\
      "Resource": [\
        "arn:aws:bedrock:*::foundation-model/anthropic.*",\
        "arn:aws:bedrock:*::foundation-model/us.anthropic.*"\
      ]\
    }\
  ]
}
```

Adjust the resource ARNs to match the specific models and regions you want to allow.

### [Step 3: Enable models in Bedrock](https://cursor.com/docs/customizing/aws-bedrock\#step-3-enable-models-in-bedrock)

Before using a model, you must enable it in the AWS Bedrock console:

1. Open the [Amazon Bedrock console](https://console.aws.amazon.com/bedrock/)
2. Navigate to **Model access** in the left sidebar
3. Click **Manage model access**
4. Select the models you want to use
5. Click **Save changes**

### [Step 4: Configure in the dashboard](https://cursor.com/docs/customizing/aws-bedrock\#step-4-configure-in-the-dashboard)

IAM role configuration is only available through the [Cursor dashboard](https://cursor.com/dashboard), not in the IDE settings.

1. Open the [Cursor dashboard](https://cursor.com/dashboard)
2. Navigate to **Settings**
3. Find the **Bedrock IAM Role** section
4. Enter your credentials:

| Setting | Description |
| --- | --- |
| **AWS IAM Role ARN** | Your IAM role ARN (e.g., `arn:aws:iam::123456789012:role/CursorBedrockRole`) |
| **AWS Region** | The AWS region where Bedrock is enabled (e.g., `us-east-1`) |
| **Test Model ID** | A model to test connectivity |

1. Click **Validate & Save** to test the connection

If you don't see the Bedrock IAM Role section, check with your team admin. On enterprise plans, admins control which settings are visible to team members.

## [External ID](https://cursor.com/docs/customizing/aws-bedrock\#external-id)

After validating your Bedrock configuration, Cursor generates a unique External ID. Add this to your IAM role's trust policy under the `Condition` section to enable secure cross-account access.

The External ID prevents unauthorized access to your AWS resources. Copy the ID from the dashboard and update your trust policy accordingly.

## [Using access keys](https://cursor.com/docs/customizing/aws-bedrock\#using-access-keys)

Alternatively, you can use AWS access keys instead of an IAM role. Enter your AWS Access Key ID and Secret Access Key in `Cursor Settings` \> `Models` in the IDE. This approach is simpler but less secure than using IAM roles.

## [Troubleshooting](https://cursor.com/docs/customizing/aws-bedrock\#troubleshooting)

### Validation fails with access denied

- Verify the IAM role ARN is correct
- Check that the trust policy includes Cursor's cross-account ARN (`arn:aws:iam::289469326074:role/roleAssumer`)
- Confirm the External ID matches exactly
- Ensure the test model is enabled in Bedrock

### Model not found

- Enable the model in the AWS Bedrock console
- Verify the model ID format matches your region (some use `us.anthropic.*` prefix)
- Check that your IAM policy includes the model's ARN

### Region errors

- Confirm Bedrock is available in your selected region
- Verify the model is enabled in that specific region
- Some models are only available in certain regions

## [Related](https://cursor.com/docs/customizing/aws-bedrock\#related)

- [Bring your own API key](https://cursor.com/help/models-and-usage/api-keys) \- Configure other model providers
- [Models](https://cursor.com/docs/models-and-pricing) \- Overview of available models in Cursor

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