#!/usr/bin/env bash
set -euo pipefail

rm -rf app.zip ||:
pushd src
zip -r ../app.zip *
popd

aws lambda update-function-code \
  --region "eu-west-1" \
  --function-name "arn:aws:lambda:eu-west-1:007759148419:function:bistroMenuPoller" \
  --zip-file "fileb://app.zip"
