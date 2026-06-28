FROM rust:1.92-bookworm

WORKDIR /app

# 必要なパッケージをインストール
RUN apt update && apt install -y \
    build-essential \
    pkg-config \
    libssl-dev \
    python3 \
    python3-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Cargo設定をコピー
COPY rust_app/Cargo.toml rust_app/Cargo.lock ./

# pyo3 が利用する Python 実行ファイルを明示
ENV PYO3_PYTHON=python3
# Python 3.13 環境で pyo3 0.21 を stable ABI 前方互換でビルドする
ENV PYO3_USE_ABI3_FORWARD_COMPATIBILITY=1

# Cargo設定をコピー
RUN cargo install cargo-lambda

# 依存関係をキャッシュ
RUN mkdir src && \
    echo "fn main() {}" > src/main.rs && \
    cargo build && \
    rm -rf src

ENV DYNAMODB_ENDPOINT=http://dynamodb-local:8000
# ローカル開発用の環境変数を設定
ENV APP_ENV=local

# モデルのパス（アプリはこの環境変数を参照してモデルを読み込みます）
ENV MODEL_PATH=/opt/models/wt_model.onnx

# ソースコードをマウント
VOLUME /app/src

# watchモードで起動
CMD ["cargo", "lambda", "watch"]