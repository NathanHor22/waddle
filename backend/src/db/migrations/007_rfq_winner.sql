-- The buyer's decision: which quote won. Set when an RFQ is decided.
ALTER TABLE rfqs ADD COLUMN winning_quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL;
