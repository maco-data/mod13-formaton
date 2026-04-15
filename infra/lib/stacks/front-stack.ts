import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import { Construct } from 'constructs';
import { EnvConfig } from '../../config/environments';

interface FrontStackProps extends cdk.StackProps {
  config: EnvConfig;
  tags: Record<string, string>;
  apiUrl: string;
  userPoolId: string;
  userPoolClientId: string;
}

export class FrontStack extends cdk.Stack {
  public readonly distributionUrl: string;

  constructor(scope: Construct, id: string, props: FrontStackProps) {
    super(scope, id, props);

    Object.entries(props.tags).forEach(([k, v]) => cdk.Tags.of(this).add(k, v));

    // ── S3 — hosting estático (NO website endpoint, solo vía CloudFront OAC) ─
    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      bucketName: `formaton-frontend-${props.config.envName}-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: props.config.envName === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: props.config.envName !== 'prod',
    });

    // ── CloudFront OAC ────────────────────────────────────────────────────
    const oac = new cloudfront.S3OriginAccessControl(this, 'OAC', {
      description: 'Formaton Frontend OAC',
    });

    const apiProxyRewrite = new cloudfront.Function(this, 'ApiProxyRewriteFunction', {
      comment: 'Elimina el prefijo /api antes de reenviar a API Gateway',
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  if (request.uri === '/api') {
    request.uri = '/';
  } else if (request.uri.indexOf('/api/') === 0) {
    request.uri = request.uri.substring(4);
  }
  return request;
}
      `.trim()),
    });

    const webAcl = props.config.enableWaf
      ? new wafv2.CfnWebACL(this, 'CloudFrontWebAcl', {
          name: `formaton-cloudfront-${props.config.envName}`,
          scope: 'CLOUDFRONT',
          defaultAction: { allow: {} },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: `formaton-cloudfront-${props.config.envName}`,
            sampledRequestsEnabled: true,
          },
          rules: [
            {
              name: 'AWSManagedRulesAmazonIpReputationList',
              priority: 0,
              overrideAction: { none: {} },
              statement: {
                managedRuleGroupStatement: {
                  vendorName: 'AWS',
                  name: 'AWSManagedRulesAmazonIpReputationList',
                },
              },
              visibilityConfig: {
                cloudWatchMetricsEnabled: true,
                metricName: 'aws-ip-reputation',
                sampledRequestsEnabled: true,
              },
            },
            {
              name: 'AWSManagedRulesCommonRuleSet',
              priority: 10,
              overrideAction: { none: {} },
              statement: {
                managedRuleGroupStatement: {
                  vendorName: 'AWS',
                  name: 'AWSManagedRulesCommonRuleSet',
                },
              },
              visibilityConfig: {
                cloudWatchMetricsEnabled: true,
                metricName: 'aws-common',
                sampledRequestsEnabled: true,
              },
            },
            {
              name: 'AWSManagedRulesKnownBadInputsRuleSet',
              priority: 20,
              overrideAction: { none: {} },
              statement: {
                managedRuleGroupStatement: {
                  vendorName: 'AWS',
                  name: 'AWSManagedRulesKnownBadInputsRuleSet',
                },
              },
              visibilityConfig: {
                cloudWatchMetricsEnabled: true,
                metricName: 'aws-known-bad-inputs',
                sampledRequestsEnabled: true,
              },
            },
            {
              name: 'AWSManagedRulesSQLiRuleSet',
              priority: 30,
              overrideAction: { none: {} },
              statement: {
                managedRuleGroupStatement: {
                  vendorName: 'AWS',
                  name: 'AWSManagedRulesSQLiRuleSet',
                },
              },
              visibilityConfig: {
                cloudWatchMetricsEnabled: true,
                metricName: 'aws-sqli',
                sampledRequestsEnabled: true,
              },
            },
            {
              name: 'RateLimitPerIp',
              priority: 40,
              action: { block: {} },
              statement: {
                rateBasedStatement: {
                  aggregateKeyType: 'IP',
                  limit: props.config.wafRateLimit,
                },
              },
              visibilityConfig: {
                cloudWatchMetricsEnabled: true,
                metricName: 'ip-rate-limit',
                sampledRequestsEnabled: true,
              },
            },
          ],
        })
      : undefined;

    // ── CloudFront Distribution ───────────────────────────────────────────
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: `Formaton Frontend — ${props.config.envName}`,
      defaultRootObject: 'index.html',
      webAclId: webAcl?.attrArn,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket, { originAccessControl: oac }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
      },
      additionalBehaviors: {
        // Proxy /api/* → API Gateway (sin caché)
        '/api/*': {
          origin: new origins.HttpOrigin(
            cdk.Fn.select(2, cdk.Fn.split('/', props.apiUrl)),
            {
              protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
              originPath: `/${props.config.envName}`,
            }
          ),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          functionAssociations: [
            {
              function: apiProxyRewrite,
              eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
            },
          ],
        },
      },
      // SPA fallback: 403/404 → index.html (React Router)
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: cdk.Duration.seconds(0) },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: cdk.Duration.seconds(0) },
      ],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // Europa + NA
    });

    this.distributionUrl = `https://${distribution.distributionDomainName}`;

    // ── Outputs ───────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'DistributionUrl', { value: this.distributionUrl, exportName: `formaton-frontend-url-${props.config.envName}` });
    new cdk.CfnOutput(this, 'DistributionId', { value: distribution.distributionId });
    new cdk.CfnOutput(this, 'SiteBucketName', { value: siteBucket.bucketName });
    if (webAcl) {
      new cdk.CfnOutput(this, 'WebAclArn', { value: webAcl.attrArn, exportName: `formaton-waf-arn-${props.config.envName}` });
    }
  }
}
