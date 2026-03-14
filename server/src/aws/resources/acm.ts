import { ListCertificatesCommand } from '@aws-sdk/client-acm';
import type { ACMClient } from '@aws-sdk/client-acm';
import type { InfraNode } from '../types.js';

export async function discoverAcm(client: ACMClient): Promise<InfraNode[]> {
  try {
    const res = await client.send(new ListCertificatesCommand({}));
    return (res.CertificateSummaryList || []).map(cert => ({
      id: `acm-${cert.CertificateArn?.split('/').pop()}`,
      type: 'acm' as const,
      label: cert.DomainName || 'Unknown Cert',
      status: cert.Status || 'unknown',
      isManual: true,
      metadata: { arn: cert.CertificateArn, domainName: cert.DomainName, status: cert.Status, type: cert.Type, subtitle: cert.Type },
    }));
  } catch (e: any) { console.error('ACM discovery error:', e.message); return []; }
}
