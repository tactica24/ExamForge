# AWS Foundation Automation

This folder contains a CloudFormation stack that provisions the main AWS foundation pieces the app expects:

- Cognito User Pool and hosted UI domain
- SES email identity for Cognito verification emails
- Aurora PostgreSQL Serverless v2 with Data API enabled
- S3 bucket for app assets/uploads
- Secrets Manager session secret for the app cookie signer

## What this automates

- Email verification stays mandatory through Cognito.
- Cognito callback/logout URLs are derived from your app URL.
- Aurora outputs the cluster ARN and master secret ARN needed by the app.
- The export script turns stack outputs into Amplify-ready environment variables.

## Deploy the stack

Example:

```powershell
aws cloudformation deploy `
  --stack-name examforge-prod-foundation `
  --template-file infra/aws/cloudformation/backend-foundation.yaml `
  --capabilities CAPABILITY_NAMED_IAM `
  --region us-east-1 `
  --parameter-overrides `
    AppName=examforge `
    EnvironmentName=prod `
    AppUrl=https://www.acenaija.com.ng `
    CognitoDomainPrefix=examforge-prod-auth `
    SesIdentityValue=acenaija.com.ng `
    SesFromEmail=no-reply@acenaija.com.ng `
    DbName=examforge `
    DbMasterUsername=appadmin `
    AppRuntimeRoleName=your-amplify-runtime-role-name `
    VpcId=vpc-xxxxxxxx `
    PrivateSubnetIds=subnet-aaaaaaa,subnet-bbbbbbb
```

Optional Google sign-in parameters:

```powershell
GoogleClientId=your-google-client-id
GoogleClientSecret=your-google-client-secret
```

## Generate Amplify env values

After the stack finishes, export the exact env file the app needs:

```powershell
node scripts/aws-stack-export-env.mjs `
  --stack-name examforge-prod-foundation `
  --region us-east-1 `
  --out .env.aws.generated
```

That file will contain:

- Cognito IDs, domain, callback URL, and client secret
- The app session secret value
- Aurora Data API ARNs and database name
- S3 bucket values
- `APP_BACKEND_PROVIDER=aws`

## Apply the Aurora schema

After the stack is created, apply the current schema with:

```powershell
node scripts/aws-apply-schema.mjs `
  --region us-east-1 `
  --cluster-arn <aurora-cluster-arn> `
  --secret-arn <aurora-secret-arn> `
  --database examforge
```

## Remaining manual steps

- Complete SES DNS verification for the configured identity if AWS asks for DNS records.
- Move SES out of sandbox for production email sending if the account is still sandboxed.
- Paste the generated env values into Amplify environment variables, then redeploy.
