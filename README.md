[![Open in Dev Containers](https://img.shields.io/static/v1?label=Dev%20Containers&message=Open&color=blue&logo=visualstudiocode)](https://vscode.dev/redirect?url=vscode://ms-vscode-remote.remote-containers/cloneInVolume?url=https://github.com/kaito01234/dashboard-backend)

export AWS_ENDPOINT_URL=http://localhost:4566
npx cdklocal bootstrap --endpoint-url=http://localhost:4566
npx cdklocal deploy AwsStack --endpoint-url=http://localhost:4566

curl https://asb5qinpfl.execute-api.ap-northeast-1.amazonaws.com/prod

curl -X POST -H "Content-Type: application/json" -d '{
"id": "test0001",
"name": "テスト 0001",
"branch": "main",
"url": "main"
}' https://asb5qinpfl.execute-api.ap-northeast-1.amazonaws.com/prod/create

curl -X POST -H "Content-Type: application/json" -d '{
"id": "test0001",
"url": "main"
}' https://asb5qinpfl.execute-api.ap-northeast-1.amazonaws.com/prod/delete

# memo

statemachine のエラー処理
priority 設定
ec2 起動完了ステータス設定
