"use strict";

const LOG_ACTIONS = [
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
 * By default serverless specifies each lambda ARN individually in a Stack's Lambda IAM role. For every large stacks, this can cause the role
 * to exceed the maximum allowed size of 10240 bytes. This code reduces the size of the generated lambda role by allowing ANY lambda part 
 * of the _same_ AWS account and Region write access to CloudWatch by replacing the Resources array of the policy with:
 * 
 * arn:${AWS::Partition}:logs:${AWS::Region}:${AWS::AccountId}:log-group:*
 * 
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

    // find the index of the policy that defines CloudWatch permissions for each Lambda
    const cloudWatchLogPolicyIndex = policies.findIndex((p) => {
      if (
        p.PolicyDocument &&
        p.PolicyDocument.Statement &&
        p.PolicyDocument.Statement.Effect === "Allow" &&
        Array.isArray(p.PolicyDocument.Statement.Action)
      ) {
        return policy.PolicyDocument.Statement.Action.every((action) =>
          LOG_ACTIONS.includes(action)
        );
      }
    });

    if (cloudWatchLogPolicyIndex > -1) {
      policies[cloudWatchLogPolicyIndex] = {
        ...policies[cloudWatchLogPolicyIndex],
        /*
          Replace all individual ARNs with a single ARN allowing ANY Lambda part of the same region and account to log to CloudWatch
        */
        Resource: [
          {
            "Fn::Sub":
              "arn:${AWS::Partition}:logs:${AWS::Region}:${AWS::AccountId}:log-group:*",
          },
        ],
      };

      resourceSection.IamRoleLambdaExecution.Properties.Policies = policies;
    }
  }
}

module.exports = SimplifyDefaultExecRole;
