import * as cdk from 'aws-cdk-lib';
import * as budgets from 'aws-cdk-lib/aws-budgets';
import { Construct } from 'constructs';
import { EnvConfig } from '../../config/environments';

interface BudgetStackProps extends cdk.StackProps {
  config: EnvConfig;
  tags: Record<string, string>;
}

export class BudgetStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: BudgetStackProps) {
    super(scope, id, props);

    Object.entries(props.tags).forEach(([k, v]) => cdk.Tags.of(this).add(k, v));

    const subscribers = props.config.budgetAlertEmails.map((email) => ({
      subscriptionType: 'EMAIL',
      address: email,
    }));

    new budgets.CfnBudget(this, 'MonthlyCostBudget', {
      budget: {
        budgetName: `formaton-${props.config.envName}-monthly`,
        budgetLimit: {
          amount: props.config.budgetMonthlyUsd,
          unit: 'USD',
        },
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
        costFilters: {
          TagKeyValue: [`Project$${props.tags.Project}`, `Env$${props.config.envName}`],
        },
      },
      notificationsWithSubscribers: [
        {
          notification: {
            notificationType: 'ACTUAL',
            comparisonOperator: 'GREATER_THAN',
            threshold: props.config.budgetAlertThresholdPct,
            thresholdType: 'PERCENTAGE',
          },
          subscribers,
        },
        {
          notification: {
            notificationType: 'FORECASTED',
            comparisonOperator: 'GREATER_THAN',
            threshold: props.config.budgetAlertThresholdPct,
            thresholdType: 'PERCENTAGE',
          },
          subscribers,
        },
      ],
    });

    new cdk.CfnOutput(this, 'BudgetName', {
      value: `formaton-${props.config.envName}-monthly`,
      exportName: `formaton-budget-name-${props.config.envName}`,
    });
  }
}
