export type PiiStatus = 'redacted' | 'blocked';

export type BlockReason =
  | 'email_address'
  | 'subject_keyword'
  | 'body_keyword'
  | 'redaction_failed';

export interface RedactionLogEntry {
  type: string;
  offset: number;
  replacement: string;
}

export interface RedactionInput {
  source: string;
  senderEmail?: string;
  recipientEmails?: string[];
  subject?: string;
  body: string;
  anthropicApiKey: string;
  skipHaiku?: boolean;
}

export type RedactionResult =
  | {
      status: 'redacted';
      redactedText: string;
      log: RedactionLogEntry[];
    }
  | {
      status: 'blocked';
      reason: BlockReason;
      redactedText: '';
      log: RedactionLogEntry[];
    };
