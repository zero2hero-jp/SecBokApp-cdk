import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'

import { 
  aws_route53 as route53,
  aws_certificatemanager as acm,
} from 'aws-cdk-lib'

export class SecBokAppCertificateStack extends cdk.Stack {
  public readonly albHostedZone: route53.IHostedZone
  public readonly albDomainName: string
  public readonly certificate: acm.Certificate

  constructor(scope: Construct, id: string, targetEnv: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    const domainName = process.env.DOMAIN!
    this.albDomainName = `secbokapp-${targetEnv}.${domainName}`
    
    this.albHostedZone = route53.PublicHostedZone.fromLookup(this, 'HostZone', {
      domainName: domainName
    })
    
    // SSL証明書
    this.certificate = new acm.DnsValidatedCertificate(
      this,
      'Certificate',
      {
        hostedZone: this.albHostedZone,
        domainName: `secbokapp-${targetEnv}.${domainName}`,
        validation: acm.CertificateValidation.fromDns(this.albHostedZone)
      }
    )
  }
}
