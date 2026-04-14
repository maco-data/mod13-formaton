import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { EnvConfig } from '../../config/environments';

interface DataStackProps extends cdk.StackProps {
  config: EnvConfig;
  tags: Record<string, string>;
}

export class DataStack extends cdk.Stack {
  public readonly table: dynamodb.Table;
  public readonly evidencesBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    Object.entries(props.tags).forEach(([k, v]) => cdk.Tags.of(this).add(k, v));

    // ── DynamoDB — tabla única (single-table design) ───────────────────────
    //
    //  Patrones de acceso cubiertos:
    //  • GetItem WORKSHOP#<id> / META           → detalle de taller
    //  • Query  WORKSHOP#<id> / REG#USER#*      → inscritos de un taller
    //  • Query  USER#<id> / META                → perfil de usuario
    //  • Query  GSI1PK=WORKSHOP#ALL / GSI1SK    → listado de talleres por fecha
    //  • Query  GSI2PK=CATEGORY#<cat>           → talleres por categoría
    //  • Query  GSI1PK=USER#<id> / GSI1SK=REG#* → talleres de un usuario
    //
    this.table = new dynamodb.Table(this, 'FormatonTable', {
      tableName: `formaton-${props.config.envName}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      tableClass: props.config.dynamoTableClass === 'STANDARD_INFREQUENT_ACCESS'
        ? dynamodb.TableClass.STANDARD_INFREQUENT_ACCESS
        : dynamodb.TableClass.STANDARD,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: props.config.envName === 'prod',
      },
      timeToLiveAttribute: 'ttl',
      removalPolicy: props.config.envName === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    });

    // GSI1 — listado de talleres por fecha
    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI2 — talleres por categoría
    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI2',
      partitionKey: { name: 'GSI2PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI2SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ── S3 — evidencias y materiales (privado) ────────────────────────────
    this.evidencesBucket = new s3.Bucket(this, 'EvidencesBucket', {
      bucketName: `formaton-evidencias-${props.config.envName}-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: props.config.envName === 'prod',
      lifecycleRules: [
        {
          id: 'archive-old-evidences',
          enabled: true,
          transitions: [
            { storageClass: s3.StorageClass.INTELLIGENT_TIERING, transitionAfter: cdk.Duration.days(90) },
          ],
        },
      ],
      removalPolicy: props.config.envName === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: props.config.envName !== 'prod',
    });

    // ── Outputs ───────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'TableName', { value: this.table.tableName, exportName: `formaton-table-${props.config.envName}` });
    new cdk.CfnOutput(this, 'TableArn', { value: this.table.tableArn });
    new cdk.CfnOutput(this, 'EvidencesBucketName', { value: this.evidencesBucket.bucketName });
  }
}
