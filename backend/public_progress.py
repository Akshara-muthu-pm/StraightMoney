"""Public progress and review guidance: no raw PayPal identifiers or private notes."""
import hashlib


def public_reference(kind, campaign_id, record_id):
    digest = hashlib.sha256(f'straightmoney:{kind}:{campaign_id}:{record_id}'.encode()).hexdigest()[:12].upper()
    return f'SM-{kind.upper()}-{digest}'


def donor_alias(donation):
    return 'Donor ' + public_reference('d', donation.campaign_id, donation.id).split('-')[-1][:6]


def review_guidance(invoice):
    rules = [c for c in invoice.checks if c.source == 'rule']
    reasons = [c.detail for c in invoice.checks if not c.passed]
    hard_failed = any(not c.passed and c.severity == 'hard' for c in invoice.checks)
    if invoice.status in {'REJECTED','NEEDS_REVIEW','VERIFIER_REJECTED'} or hard_failed:
        depth, label = 'blocked', 'Correction or rejection review'
        reasons = reasons or ['The claim has not completed screening or has been rejected.']
    elif invoice.status == 'ESCALATED':
        depth, label = 'detailed', 'Investigation required'
        reasons = ['A verifier escalated this claim. Record the investigation outcome before approval.'] + reasons
    elif (invoice.status == 'MORE_EVIDENCE_REQUIRED' or not invoice.extracted_json or not invoice.evidence_path
          or not invoice.ai_summary or not rules or any(not c.passed for c in rules)
          or 'Advisory flags:' in (invoice.ai_summary or '')
          or 'timed out' in (invoice.ai_summary or '').lower()
          or 'could not be completed' in (invoice.ai_summary or '').lower()
          or any(not c.passed for c in invoice.checks if c.source != 'rule')):
        depth, label = 'detailed', 'Detailed human review'
        reasons = reasons or ['Evidence or screening is incomplete, or an advisory needs investigation.']
    else:
        depth, label = 'standard', 'Standard human confirmation'
        reasons = ['Recorded automatic checks passed and required files are present. This does not prove delivery.']
    return {'depth':depth, 'label':label, 'reasons':reasons,
            'basis':'Rule-based review guidance, not an authenticity score. Independent recipient confirmation is mandatory for every approval.'}


def simulated_payout(invoice):
    parts = list(invoice.installments) + ([invoice.payout] if invoice.payout else [])
    return any((p.paypal_batch_id or '').startswith('SANDBOX-') for p in parts) or 'payout was simulated' in (invoice.ai_summary or '').lower()
