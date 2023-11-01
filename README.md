# serverless-simplify-default-exec-role-plugin

** This is a fork of [serverless-simplify-default-exec-role-plugin](https://github.com/shelfio/serverless-simplify-default-exec-role-plugin) by [shelfio](https://github.com/shelfio) **

> Fixes "IamRoleLambdaExecution - Maximum policy size of 10240 bytes exceeded" error

This plugin works by modifying the Cloudformation stack before deployment.

It searches for the `IamRoleLambdaExecution` resource and modifies the policy attached to this role. Unlike the original version, this maintains any custom IAM polices attached to the Lambda role. 

## Install

```
$ npm install --dev @woebot/serverless-simplify-default-exec-role-plugin
```

## Usage

In your `serverless.yml` file:

```yaml
plugins:
  - '@woebot/serverless-simplify-default-exec-role-plugin'
```

## Explanation

By default, Serverless framework creates such role:

```json5
{
  "Effect": "Allow",
  "Action": ["logs:CreateLogStream", "logs:CreateLogGroup"],
  "Resource": [
    {
      "Fn::Sub": "arn:${AWS::Partition}:logs:${AWS::Region}:${AWS::AccountId}:log-group:/aws/lambda/production-users-createUser:*",
    },
    {
      "Fn::Sub": "arn:${AWS::Partition}:logs:${AWS::Region}:${AWS::AccountId}:log-group:/aws/lambda/production-users-updateUser:*",
    },
    {
      "Fn::Sub": "arn:${AWS::Partition}:logs:${AWS::Region}:${AWS::AccountId}:log-group:/aws/lambda/production-users-deleteUser:*",
    },
    // dozens of identical lines
  ],
}
```

When you reach a certain project size, deployment will fail since this role will exceed 10 KB limit.

This plugin simplifies the default execution role to smth like this:

```json5
{
  Effect: "Allow",
  Action: ["logs:CreateLogStream", "logs:CreateLogGroup"],
  Resource: [
    {
      "Fn::Sub": "arn:${AWS::Partition}:logs:${AWS::Region}:${AWS::AccountId}:log-group:*",
    },
  ],
}
```

## License

MIT © [Shelf](https://shelf.io)
