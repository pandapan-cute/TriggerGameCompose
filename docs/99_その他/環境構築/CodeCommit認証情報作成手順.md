# CodeCommit認証情報作成手順

## 参考

- [Linux、macOS、または Unix 上の AWS CodeCommit リポジトリへの SSH 接続の設定手順](https://docs.aws.amazon.com/codecommit/latest/userguide/setting-up-ssh-unixes.html?icmpid=docs_acc_console_connect_np)

# 前提

- IAMユーザーが作成されていること
- AWS CLIがインストールされていること
- AWS CLIで認証されていること
- SSHクライアントがインストールされていること
- Gitがインストールされていること

## 手順

### 1. SSHキーの作成

```bash
# 1. SSHキーの作成
ssh-keygen -t rsa -b 4096 -f ~/.ssh/codecommit_rsa
```

### 2. IAMユーザーにSSH公開鍵をアップロード

```bash
# 2. SSH公開鍵のアップロード
aws iam upload-ssh-public-key --user-name <IAMユーザー名> --ssh-public-key-body file://~/.ssh/codecommit_rsa.pub
```

**コマンド実行後に表示されるSSH公開鍵ID(SSHPublicKeyId)を控えておく**

### 3. SSH設定ファイルの編集

```bash
# SSH設定ファイルを開く
vi ~/.ssh/config
```

以下の内容を追加
```
Host git-codecommit.*.amazonaws.com
  User <SSHPublicKeyIdの値>
  IdentityFile ~/.ssh/codecommit_rsa
```

### 4. 接続確認

```bash
ssh git-codecommit.ap-northeast-1.amazonaws.com
# Are you sure you want to continue connecting (yes/no/[fingerprint])? yes
```

接続成功時のメッセージ例
> You have successfully authenticated over SSH. You can use Git to interact with AWS CodeCommit. Interactive shells are not supported.Connection to git-codecommit.ap-northeast-1.amazonaws.com closed by remote host.
Connection to git-codecommit.ap-northeast-1.amazonaws.com closed.

### 5. CodeCommitリポジトリのクローン

```bash
git clone ssh://git-codecommit.ap-northeast-1.amazonaws.com/v1/repos/TriggerGameCompose
```