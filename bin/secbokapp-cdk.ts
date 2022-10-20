#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'

import { SecBokAppEcrStack } from '../lib/SecBokAppEcr-stack'
import { SecBokAppStack } from '../lib/SecBokApp-stack'
import { SecBokAppCertificateStack } from '../lib/SecBokAppCertificate-stack'

const app = new cdk.App();

const account: string = process.env.CDK_ACCOUNT_ID!
const region:  string = process.env.CDK_REGION!

const targetEnv: string = process.env.TARGET_ENV!

const repository = new SecBokAppEcrStack(app, `SecBokAppEcrStack-${targetEnv}`, targetEnv, {
  env: { 
    account,
    region
  }
}).repo

const albCert = new SecBokAppCertificateStack(app, `SecBokAppCertificateStack-${targetEnv}`, targetEnv, {
  env: { 
    account,
    region
  }
})

new SecBokAppStack(app, `SecBokAppStack-${targetEnv}`, {
  env: {
    account,
    region
  },
  repository,
  albHostedZone: albCert.albHostedZone,
  albDomainName: albCert.albDomainName,
  albCertificate: albCert.certificate
})
