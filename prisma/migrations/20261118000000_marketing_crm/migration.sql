CREATE TABLE marketing_campaigns (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, channel TEXT NOT NULL CHECK(channel IN ('GOOGLE_ADS','META_ADS','EMAIL','WHATSAPP','SMS','OTHER')),
 status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','ACTIVE','PAUSED','ENDED')),
 objective TEXT NOT NULL DEFAULT '', budget DECIMAL(14,2) NOT NULL CHECK(budget >= 0), spend DECIMAL(14,2) NOT NULL CHECK(spend >= 0),
 "startDate" TEXT, "endDate" TEXT, "landingUrl" TEXT NOT NULL DEFAULT '',
 "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ NOT NULL
);
CREATE TABLE marketing_leads (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, "customerId" TEXT REFERENCES customers(id) ON DELETE SET NULL,
 "campaignId" TEXT REFERENCES marketing_campaigns(id) ON DELETE SET NULL,
 stage TEXT NOT NULL DEFAULT 'NEW' CHECK(stage IN ('NEW','QUALIFIED','QUOTE_SENT','WON','LOST')),
 value DECIMAL(14,2) NOT NULL CHECK(value >= 0), "followUpDate" TEXT, notes TEXT NOT NULL DEFAULT '',
 "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ NOT NULL
);
CREATE INDEX marketing_leads_campaign_stage_idx ON marketing_leads("campaignId",stage);
CREATE INDEX marketing_leads_customer_idx ON marketing_leads("customerId");
CREATE INDEX marketing_leads_followup_idx ON marketing_leads("followUpDate");
