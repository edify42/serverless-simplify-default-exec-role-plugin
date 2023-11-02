# serverless-simplify-default-exec-role-plugin

** This is a fork of [serverless-simplify-default-exec-role-plugin](https://github.com/shelfio/serverless-simplify-default-exec-role-plugin) by [shelfio](https://github.com/shelfio) **

A quick solution for the error `Maximum policy size of 10240 bytes exceeded` error.

- This plugin modifies the `IamRoleLambdaExecution` policy to reduce its size.  
- Unlike the [original version](https://github.com/shelfio/serverless-simplify-default-exec-role-plugin), this maintains any custom IAM statements attached to the Lambda role. 
- It also doesn't collapse `"logs:CreateLogStream"`, `"logs:CreateLogGroup"`, and `"logs:PutLogEvents"` permissions into the same IAM statement.

## Install

```
$ npm install --dev @woebot/serverless-simplify-default-exec-role-plugin
```

## Usage

In your `serverless.yml` file:

```yaml
plugins:
  - "@woebot/serverless-simplify-default-exec-role-plugin"
```

## Explanation

By default the Serverless framework adds something like the IAM statement below in order to allow write access to CloudWatch log groups that are part of the deployment stack. For every large stacks, this can cause the role to exceed the maximum allowed size of 10240 bytes. This plugin reduces the size of the generated lambda role by replacing the resource list with a single ARN to grants write access to _all_ log groups that are part of the same region and account.

### Before
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
    // ... and so on, for each lambda function that logs to cloudwatch
  ],
}
```

### After

```json5
{
  "Effect": "Allow",
  "Action": ["logs:CreateLogStream", "logs:CreateLogGroup"],
  "Resource": [
    {
      "Fn::Sub": "arn:${AWS::Partition}:logs:${AWS::Region}:${AWS::AccountId}:log-group:*",
    },
  ],
}
```

## License

MIT ©
