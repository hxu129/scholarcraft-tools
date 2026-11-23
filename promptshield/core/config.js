/**
 * PromptShield Pro — Product configuration, embedded ECDSA P-256 public key,
 * storefront links, Pro feature gates, and curated bilingual demo fixtures.
 *
 * Zero-network by design: private signing keys are NEVER shipped here.
 */

export const APP_NAME = 'PromptShield Pro';
export const APP_VERSION = '1.0.0';
export const PRODUCT_ID = 'shd';
export const LICENSE_PREFIX = 'SHD1';
export const PRODUCT_PREFIX = LICENSE_PREFIX;

/**
 * Embedded ECDSA P-256 Public JWK for 100% offline license signature verification.
 */
export const PUBLIC_LICENSE_JWK = Object.freeze({
  key_ops: ['verify'],
  ext: true,
  kty: 'EC',
  x: 'NSDoxkI-j1zCkjRzvhy60DwyY3hKkDSrAYgXF29AkZc',
  y: 'wwyr0VnMv7C69dmMcjlYktPR-P0JgDEc0gv6s2FagVE',
  crv: 'P-256',
});

/**
 * Storefront checkout links.
 */
export const STOREFRONT_LINKS = Object.freeze({
  gumroad: 'https://hxucreativity28.gumroad.com/l/promptshield-pro',
  mianbaoduo: 'https://mbd.pub/o/bread/promptshield-pro',
  supportEmail: 'hxucreativity28@gmail.com',
});

/**
 * Online license verification config (disabled by default to keep PromptShield
 * strictly zero-network until a live Gumroad product_id is wired).
 * Offline ECDSA P-256 `SHD1.*` keys ALWAYS verify 100% locally with zero network calls.
 */
export const ONLINE_LICENSE_CONFIG = Object.freeze({
  enabled: true,
  provider: 'gumroad',
  gumroadEndpoint: 'https://api.gumroad.com/v2/licenses/verify',
  gumroadProductId: 'a8xAJYRJFJ7hvBK97M_GEw==',
});

/**
 * Pro feature identifiers.
 * Free tier includes unlimited single-prompt redaction, 1-click restoration,
 * and all 29 built-in Secret & PII detectors.
 */
export const PRO_FEATURES = Object.freeze({
  batchScrubber: 'batchScrubber',
  customRuleProfiles: 'customRuleProfiles',
  chatIntegration: 'chatIntegration',
});

/**
 * Supported AI chat hosts for optional explicit 1-click Side Panel bridge.
 */
export const SUPPORTED_CHAT_HOSTS = Object.freeze([
  'chatgpt.com',
  'chat.openai.com',
  'claude.ai',
  'gemini.google.com',
]);

/**
 * Default custom entity demo term (synthetic).
 */
export const DEMO_CUSTOM_TERMS = Object.freeze([
  {
    id: 'demo-org-1',
    term: 'AcmeHealth Corp',
    tokenPrefix: 'ORG',
    caseSensitive: false,
    wholeWord: true,
    enabled: true,
  },
]);

/**
 * Curated realistic (100% synthetic) prompt showcasing AWS, OpenAI, PostgreSQL URI,
 * JWT, private IP, repeated email, Chinese mobile, valid-checksum 18-digit Resident ID,
 * Luhn-valid test credit card, and custom client name (`AcmeHealth Corp`).
 */
export const DEMO_PROMPT = `# Incident Debug Request — AcmeHealth Corp Billing Sync

Hi AI, please inspect why our staging worker fails when syncing AcmeHealth Corp invoices.

## 1. Runtime Config (.env)
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
OPENAI_API_KEY=sk-proj-9XkLmN2pQrStUvWxYz0123456789AbCdEfGhIjKlMnOpQr
DATABASE_URL=postgres://billing_ops:Tr0ub4dor_2026!@10.24.8.15:5432/acme_prod?sslmode=require
WEBHOOK_SIGNING_SECRET=whsec_local_demo_9948271650abcdef
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c3JfODg0MjEiLCJvcmciOiJBY21lSGVhbHRoIENvcnAiLCJyb2xlIjoiYWRtaW4ifQ.dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk

## 2. Error Log & Affected Customer
[2026-11-23 14:12:08] host=10.24.8.15 retries=3 owner=lin.chen@acmehealth.example
Customer Contact: lin.chen@acmehealth.example | Mobile: +86 138-0013-8000
Resident ID (synthetic): 110105199003071239
Test Card (Luhn-valid): 4532-0151-1283-0366

Please return a patched retry snippet and a short status email addressed to lin.chen@acmehealth.example.`;

/**
 * Sample AI reply using placeholders from DEMO_PROMPT so users can test
 * 1-click lossless local restoration immediately.
 */
export const DEMO_AI_RESPONSE = `Here is the diagnosis for [ORG_1] on host [IP_1]:

1. Rotate [OPENAI_KEY_1] and [AWS_KEY_1] into your secret manager rather than hardcoding them beside [DB_URI_1].
2. Verify the HMAC header signed with [SECRET_1] and confirm token [JWT_1] has not expired.
3. Sample status email:

To: [EMAIL_1]
Subject: [ORG_1] Billing Sync Recovered

Hi [EMAIL_1],
We resolved the invoice sync timeout linked to card [CREDIT_CARD_1] (ID [CN_ID_1], phone [PHONE_CN_1]). No further action is required.`;

/**
 * Curated multi-file demo batch (CSV + JSON + Log) for Batch File Scrubber preview.
 */
export const DEMO_BATCH_FILES = Object.freeze([
  {
    name: 'customers_2026.csv',
    content: [
      'customer_id,customer_name,email,phone,id_number,plan,notes',
      'C-1001,"Lin, Chen",lin.chen@acmehealth.example,+86 138-0013-8000,110105199003071239,Enterprise,"Account owner at AcmeHealth Corp, card 4532-0151-1283-0366"',
      'C-1002,"Wang Wei",wei.wang@acmehealth.example,13912345678,11010519900307128X,Pro,"Secondary contact; gateway IP 10.24.8.15"',
      'C-1003,"Alice Rivera",alice@partner-labs.example,+1 (415) 555-0192,,Starter,"No ID provided; uses API key sk-proj-9XkLmN2pQrStUvWxYz0123456789AbCdEfGhIjKlMnOpQr"',
    ].join('\n'),
  },
  {
    name: 'service_config.json',
    content: JSON.stringify(
      {
        organization: 'AcmeHealth Corp',
        primaryOwner: 'lin.chen@acmehealth.example',
        database: {
          uri: 'postgres://billing_ops:Tr0ub4dor_2026!@10.24.8.15:5432/acme_prod?sslmode=require',
          host: '10.24.8.15',
          poolSize: 16,
        },
        integrations: {
          openaiKey: 'sk-proj-9XkLmN2pQrStUvWxYz0123456789AbCdEfGhIjKlMnOpQr',
          awsAccessKey: 'AKIAIOSFODNN7EXAMPLE',
          webhookSecret: 'whsec_local_demo_9948271650abcdef',
        },
      },
      null,
      2,
    ),
  },
  {
    name: 'worker_incident.log',
    content: [
      '2026-11-23T14:12:08Z INFO host=10.24.8.15 org="AcmeHealth Corp" starting billing sync',
      '2026-11-23T14:12:09Z WARN auth="Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c3JfODg0MjEiLCJvcmciOiJBY21lSGVhbHRoIENvcnAiLCJyb2xlIjoiYWRtaW4ifQ.dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk" retry=1',
      '2026-11-23T14:12:11Z ERROR notify=lin.chen@acmehealth.example sms=+86 138-0013-8000 code=E_TIMEOUT',
    ].join('\n'),
  },
]);
