"use strict";

/**
 * Check if a policy statement item meets the criteria to be simplified
 *
 * @param {*} s Policy Statement entry
 * @returns {boolean} true when the statement should be simplified
 */
const shouldSimplifyLogActions = (s) => {
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

const isKinesisShardRecord = (s) => {
  const KINESIS_SHARD_RECORD_ACTIONS = [
    "kinesis:GetRecords",
    "kinesis:GetShardIterator",
    "kinesis:DescribeStreamSummary",
    "kinesis:ListShards"
  ];

  return (
    s.Effect === "Allow" &&
    s.Action.every((action) => KINESIS_SHARD_RECORD_ACTIONS.includes(action))
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
    // boolean to check if the kinesis shard record push is disabled
    let kinesisShardRecordPush = false;
    // parse all existing policies from the lambda role
    resourceSection.IamRoleLambdaExecution.Properties.Policies.forEach((p) => {
      if (p.PolicyDocument && Array.isArray(p.PolicyDocument.Statement)) {
        const nStatement = [];
        for (const s of p.PolicyDocument.Statement) {
          if (shouldSimplifyLogActions(s)) {
            s.Resource = [
              {
                "Fn::Sub":
                  "arn:${AWS::Partition}:logs:${AWS::Region}:${AWS::AccountId}:log-group:*",
              },
            ];
          };
          if (isKinesisShardRecord(s)) {
            if (!kinesisShardRecordPush) {
              // case when we haven't pushed the record yet and we are in the first statement
              nStatement.push(s);
              kinesisShardRecordPush = true; // we should never execute this again
            };
          } else {
            nStatement.push(s);
          }
        }

        p.PolicyDocument.Statement = nStatement;
      }
    });
  }
}

module.exports = SimplifyDefaultExecRole;
