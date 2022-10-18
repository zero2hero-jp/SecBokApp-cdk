# SecBokApp-cdk

## 前提
1. 必要なコマンドとバージョン
```
$ aws --version
aws-cli/2.2.16 Python/3.8.8 Linux/5.15.0-50-generic exe/x86_64.ubuntu.20 prompt/off

$ volta --version
1.0.5
```

2. awsのクレデンシャルの設定
```
$ cat ~/.aws/config

# 最後の行に以下を追加する

(省略)

[profile secbokapp-cdk]
output = json
region = <管理者に聞いて入力して下さい>
aws_access_key_id = <管理者に聞いて入力してください>
aws_secret_access_key = <管理者に聞いて入力してください>
```

## Install

1. パッケージのインストール
```
$ yarn

# インストールされたパッケージの確認
$ cdk --version
2.44.0 (build bf32cb1)
```

## オペレーション
- スタックは3つの環境変数(local, dev, prod)が存在します。

| 環境変数 | 用途 | デプロイ方法 |
| ---- | ---- | ---- |
| local | ローカルからaws上のCfnに直接デプロイをして試すことができます。| 以下の操作方法を参照 |
| dev | 本番前の動作確認インフラです。| developmentブランチにマージされるとデプロイされます。 |
| prod | 本番のインフラです。 | mainブランチにマージされるとデプロイされます。 |

- localからのcdkの操作方法
```
# 差分確認
$ cdk diff SecBokAppStack-local --profile secbokapp-cdk

# デプロイ
$ cdk deploy SecBokAppStack-local --profile secbokapp-cdk

# スタックの削除
$ cdk destroy SecBokAppStack-local --profile secbokapp-cdk
```
