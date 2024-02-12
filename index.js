"use strict";

/**
 * Check if a policy statement item meets the criteria to be simplified
 *
 * @param {*} s Policy Statement entry
 * @returns {boolean} true when the statement should be simplified
 */
const shouldSimplify = (s) => {
  /**
   * The resources for polices that define these permissions will be 'simplified'
   * source: https://www.serverless.com/framework/docs/providers/aws/guide/iam
   */
  const LOG_ACTIONS_TO_SIMPLIFY = [
    "logs:CreateLogStream",
    "logs:CreateLogGroup",
    "logs:PutLogEvents",
    "logs:TagResource",
  ];

  return (
    s.Effect === "Allow" &&
    s.Action.every((action) => LOG_ACTIONS_TO_SIMPLIFY.includes(action))
  );
};

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
    Array.isArray(resourceSection.IamRoleLambdaExecution.Properties.Policies)
  ) {
    // parse all existing policies from the lambda role
    resourceSection.IamRoleLambdaExecution.Properties.Policies.forEach((p) => {
      if (p.PolicyDocument && Array.isArray(p.PolicyDocument.Statement)) {
        const nStatement = [];
        for (const s of p.PolicyDocument.Statement) {
          if (shouldSimplify(s)) {
            s.Resource = [
              {
                "Fn::Sub":
                  "arn:${AWS::Partition}:logs:${AWS::Region}:${AWS::AccountId}:log-group:*",
              },
            ];
          }

          nStatement.push(s);
        }

        p.PolicyDocument.Statement = nStatement;
      }
    });
  }
}

module.exports = SimplifyDefaultExecRole;
