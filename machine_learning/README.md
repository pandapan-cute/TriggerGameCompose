# machine_learning

このプロジェクトはゲームを動かす際に直接使用するものではありません。

機械学習を使ってゲームのAIを作るためのコードが入っています。

## 初期設定

### 必要なツール

新しく機械学習をやらないのであればPythonは不要です。

機械学習を行う場合、以下のツールが入ってなければ調べて入れてください。

```sh
# Pythonバージョン確認
python3 --version

# Pythonのパッケージ管理ツールのバージョン確認
pip3 --version

# C/C++コンパイラのバージョン確認
gcc --version

# makeのバージョン確認
make --version
```

### Pythonの仮想環境準備

```bash
# 1. 新しい環境で新しく.venvを作る
cd machine_learning
python3 -m venv .venv

# 2. Pythonの仮想環境に入る
source .venv/bin/activate

# 3. 設計図を元に一括インストール
pip install -r requirements.txt

# Pythonの仮想環境から出る
deactivate
```

### VSCode拡張機能

* Python

## 実行方法

上記のツールが入っていれば以下のコマンドで機械学習を実行できます。

**/game_server/rust_app/cargo.tomlのコメントアウトを解除**してください。

```bash
# 1. Pythonの仮想環境に入る
cd machine_learning
source .venv/bin/activate

# 2. maturinを使ってRustのライブラリをビルドしてPython仮想環境にインストールする
cd ../game_server/rust_app
maturin develop

# 3. 機械学習を実行する
cd ../../machine_learning
RUST_BACKTRACE=1 python3 main.py

# Pythonの仮想環境から出る
deactivate
```

## ライブラリを追加したとき

```bash
# 1. Pythonの仮想環境に入る
cd machine_learning
source .venv/bin/activate

# 2. ライブラリを追加する
pip install <ライブラリ名>

# 3. requirements.txtを更新する
pip freeze > requirements.txt

# 4. Pythonの仮想環境から出る
deactivate
```
