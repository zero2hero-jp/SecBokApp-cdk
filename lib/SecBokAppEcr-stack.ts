import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'

import { 
  aws_ecr as ecr,
} from 'aws-cdk-lib'

import { Repository } from 'aws-cdk-lib/aws-ecr';

export class SecBokAppEcrStack extends cdk.Stack {
  public readonly repo: Repository

  constructor(scope: Construct, id: string, targetEnv: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    // ECR
    this.repo = new ecr.Repository(this, 'Ecr', {
      repositoryName: `ecr-${targetEnv}`,
      imageScanOnPush: true,
    });
  }
}
