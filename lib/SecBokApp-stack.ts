require('dotenv').config();

import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'

import { 
  aws_ecr as ecr,
  aws_ec2 as ec2,
  aws_rds as rds,
  aws_ecs as ecs,
  aws_route53 as route53,
  aws_certificatemanager as amc,
  aws_ecs_patterns as ecs_patterns,
  aws_secretsmanager as secretmanager,
  aws_apigateway as apigateway,
  aws_elasticloadbalancingv2 as elbv2,
  SecretValue,
} from 'aws-cdk-lib'
import { ApplicationProtocol } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { RecordTarget } from 'aws-cdk-lib/aws-route53';

export class SecBokAppStack extends cdk.Stack {
  public readonly vpc: ec2.IVpc

  constructor(scope: Construct, id: string, props: cdk.StackProps & {
    repository: ecr.Repository
    albHostedZone: route53.IHostedZone
    albCertificate: amc.Certificate
    albDomainName: string
  }) {
    super(scope, id, props);
    
    const targetEnv = process.env.TARGET_ENV!
    const vpcSubnet = process.env.VPC_SUBNET!
    const railsEnv  = process.env.RAILS_ENV!
    const dbUser    = process.env.DB_USER!
    const dbName    = process.env.DB_NAME!
    
    const rdsDeleteAutomatedBackups = targetEnv === ('local' || 'dev')

    // VPC
    this.vpc = new ec2.Vpc(this, 'Vpc', {
      cidr: vpcSubnet,
      enableDnsHostnames: true,
      enableDnsSupport: true,
      natGateways: 1,
      maxAzs: 2,
      subnetConfiguration: [
        { 
          name: 'Public', subnetType: ec2.SubnetType.PUBLIC, 
          cidrMask: 27 
        },
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          //subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 27,
        },
      ],
    });
    
    // RDS Secret
    const secret = new secretmanager.Secret(this, 'RdsSecret', {
      secretName: `postgres-${targetEnv}`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: dbUser }),
        excludePunctuation: true,
        includeSpace: false,
        generateStringKey: 'password'
      }
    })
    
    // TODO: SendGrid Secret
    //const sendGridsecret = new secretmanager.Secret(this, 'SendGridSecret', {
    //}

    // RDS SecurityGroup
    const rdsSG = new ec2.SecurityGroup(this, 'RdsSG', {
      vpc: this.vpc,
      allowAllOutbound: true
    });
    rdsSG.addIngressRule(
      ec2.Peer.ipv4('0.0.0.0/0'),
      ec2.Port.tcp(5432)
    );

    const postgresql = new rds.DatabaseInstance(this, 'Rds', {
      deleteAutomatedBackups: rdsDeleteAutomatedBackups,
      instanceIdentifier: `Rds-${targetEnv}`,
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_14_2,
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE3, ec2.InstanceSize.MICRO),
      vpc: this.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
        //subnetType: ec2.SubnetType.PRIVATE_ISOLATED
      },
      securityGroups: [rdsSG],
      credentials: rds.Credentials.fromSecret(secret),
      databaseName: dbName
    });
    
    // ECS Cluster
    const ecsCluster = new ecs.Cluster(this, 'EcsCluster', {
      clusterName: `Cluster-${targetEnv}`,
      vpc: this.vpc,
      containerInsights: true,
    });

    // ECS Task Definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDefinition', {
      family: `task-${targetEnv}`
    })

    let taskDefinitionSecrets: {[key: string]: ecs.Secret} = {
      'DATABASE_PASSWORD': ecs.Secret.fromSecretsManager(
        secret, 
        'password'
      ),
    } 

    // TODO: sendGrid
    // let sendGridTaskDefinitionSecrets: {[key: string]: ecs.Secret} = {
    // } 

    // RAILS_MASTER_KEY Secrets Manager
    const railsSecret = new secretmanager.Secret(this, `RailsSecret-${targetEnv}`, {
      secretName: `rails-master-key-${targetEnv}`,
      secretObjectValue: {
        railsMasterKey: SecretValue.unsafePlainText('xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')
      }
    })
    taskDefinitionSecrets.RAILS_MASTER_KEY = ecs.Secret.fromSecretsManager(
      railsSecret, 
      'railsMasterKey'
    )
    
    taskDefinition.addContainer('Container', {
      containerName: `Container-${targetEnv}`,
      image: ecs.ContainerImage.fromEcrRepository(props.repository, 'latest'),
      memoryLimitMiB: 256,
      logging: ecs.LogDriver.awsLogs({
        streamPrefix: props.repository.repositoryName,
      }),
      environment: {
        RAILS_ENV: railsEnv,
        RAILS_LOG_TO_STDOUT: 'true',
        DATABASE_HOST: postgresql.instanceEndpoint.hostname,
        DATABASE_NAME: dbName,
        DATABASE_NAME_PRODUCTION: dbName,
        DATABASE_USER: dbUser
        /*
         * SMTP_ADDRESS #send gridから取得
         * SMTP_PORT #send gridから取得
         */
      },
      secrets: taskDefinitionSecrets
    })
    .addPortMappings({
      protocol: ecs.Protocol.TCP,
      containerPort: 3000
    });
    
    // ALB
    const alb = new elbv2.ApplicationLoadBalancer(this, 'Alb', {
      vpc: this.vpc,
      loadBalancerName: `Alb-${targetEnv}`,
      internetFacing: true
    });
    
    // TODO: セキュリテグルーを作成して追加。port 3000
    const lbFargateService = 
      new ecs_patterns.ApplicationLoadBalancedFargateService(
        this, 
        'LoadBalancedFargateService', 
        {
          serviceName: `Service-${targetEnv}`,
          assignPublicIp: false,
          cluster: ecsCluster,
          taskSubnets: this.vpc.selectSubnets({
            subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
          }),
          memoryLimitMiB: 1024,
          cpu: 512,
          desiredCount: 2,
          taskDefinition: taskDefinition,
          publicLoadBalancer: true,
          loadBalancer: alb,
          protocol: ApplicationProtocol.HTTPS,
          certificate: props.albCertificate,
          domainName: props.albDomainName,
          domainZone: props.albHostedZone
        }
      )
    lbFargateService.service.connections.allowFrom(
      ec2.Peer.ipv4(this.vpc.vpcCidrBlock),
      ec2.Port.tcp(3000)
    )
    lbFargateService.targetGroup.configureHealthCheck({
      path: '/health_check'
    })
    
    // Rilas側でDNSリバインディング対策を行う場合は、コンテナに環境変数としてNLBのホスト名を渡す。
    //const container = taskDefinition.findContainer(`Container-${targetEnv}`)
    //container?.addEnvironment('VALID_HOST', loadBalancedFargateService.loadBalancer.loadBalancerDnsName)

    // Auto Scaling Settings
    const scalableTarget =
      lbFargateService.service.autoScaleTaskCount({
        minCapacity: 2,
        maxCapacity: 10,
      });
    scalableTarget.scaleOnCpuUtilization("CpuScaling", {
      targetUtilizationPercent: 50,
    });
    scalableTarget.scaleOnMemoryUtilization("MemoryScaling", {
      targetUtilizationPercent: 50,
    });
  }
}
