"use strict";

/**
 * The resources for polices that define these permissions will be 'simplified'
 */
const LOG_ACTIONS_TO_SIMPLIFY = [
  "logs:CreateLogStream",
  "logs:CreateLogGroup",
  "logs:PutLogEvents",
];

class SimplifyDefaultExecRole {
  constructor(serverless) {
    this.hooks = {
      "before:package:finalize": function () {
        simplifyBaseIAMLogGroups(serverless);
      },
    };
  }
}

/**
 * By default serverless specifies each CloudWatch log group ARN individually in a Stack's Lambda IAM role. For every large stacks, this can cause the role
 * to exceed the maximum allowed size of 10240 bytes. This code reduces the size of the generated lambda role by replacing the resource list with a single
 * ARN to grants write access to _all_ log groups that are part of the same region and account.
 *
 * arn:${AWS::Partition}:logs:${AWS::Region}:${AWS::AccountId}:log-group:*
 *
 * @param {*} serverless
 */
function simplifyBaseIAMLogGroups(serverless) {
  const resourceSection =
    serverless.service.provider.compiledCloudFormationTemplate.Resources;

  if (
    resourceSection.IamRoleLambdaExecution &&
    resourceSection.IamRoleLambdaExecution.Properties &&
    Array.isArray(resourceSection.IamRoleLambdaExecution.Properties.Policies) &&
    resourceSection.IamRoleLambdaExecution.Properties.Policies.length
  ) {
    // parse all existing policies from the lambda role
    const policies = resourceSection.IamRoleLambdaExecution.Properties.Policies;

    // find all indexes of policies that define permissions for CloudWatch log groups
    const cloudWatchLogPolicyIndexes = policies.reduce((acc, p, idx) => {
      if (
        p.PolicyDocument &&
        p.PolicyDocument.Statement &&
        p.PolicyDocument.Statement.Effect === "Allow" &&
        Array.isArray(p.PolicyDocument.Statement.Action) &&
        p.PolicyDocument.Statement.Action.every((action) =>
          LOG_ACTIONS_TO_SIMPLIFY.includes(action)
        )
      ) {
        acc.push(idx);
      }

      return acc;
    }, []);

    if (cloudWatchLogPolicyIndexes.length > 0) {
      for (const idx of cloudWatchLogPolicyIndexes) {
        policies[idx] = {
          ...policies[idx],
          /*
            Apply the permission to *any* log group part of the same region and account
          */
          Resource: [
            {
              "Fn::Sub":
                "arn:${AWS::Partition}:logs:${AWS::Region}:${AWS::AccountId}:log-group:*",
            },
          ],
        };
      }

      resourceSection.IamRoleLambdaExecution.Properties.Policies = policies;
    }
  }
}

module.exports = SimplifyDefaultExecRole;
