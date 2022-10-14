import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'

import { 
  aws_ecr as ecr,
} from 'aws-cdk-lib'

import { TargetEnvType } from './types/TargetEnvType';
import { Repository } from 'aws-cdk-lib/aws-ecr';

export class EcrStack extends cdk.Stack {
  public readonly repo: Repository

  constructor(scope: Construct, id: string, targetEnv: TargetEnvType, props?: cdk.StackProps) {
    super(scope, id, props);
    
    // ECR
    this.repo = new ecr.Repository(this, 'Ecr', {
      repositoryName: `ecr-${targetEnv}`,
      imageScanOnPush: true,
    });
  }
}