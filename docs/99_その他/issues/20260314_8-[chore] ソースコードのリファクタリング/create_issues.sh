#!/bin/bash
set -e

REPO="pandapan-cute/TriggerGameCompose"
PARENT=8
DIR="$(cd "$(dirname "$0")" && pwd)"

for f in \
  "refactor-01-guidelines.md:[Feature] リファクタリング基準と計測指標を定義する" \
  "refactor-02-input-controller.md:[Feature] GridCellsScene の入力処理を InputController に分離する" \
  "refactor-03-selection-trigger.md:[Feature] GridCellsScene の選択・移動・トリガー設定を分離する" \
  "refactor-04-turn-planner.md:[Feature] ターン計画と再生処理を Scene から分離する" \
  "refactor-05-usecase-split.md:[Feature] ProcessTurnUseCase を提出処理と解決処理に分割する" \
  "refactor-06-domain-service.md:[Feature] Step/Game のドメイン責務をサービスへ抽出する" \
  "refactor-07-test-cleanup.md:[Feature] テストの棚卸しと低価値テスト削減・仕様テスト強化"
do
  FILE="${f%%:*}"
  TITLE="${f#*:}"

  NUM=$(gh issue list \
    --repo "$REPO" \
    --state open \
    --search "in:title \"$TITLE\"" \
    --json number,title \
    --jq ".[] | select(.title == \"$TITLE\") | .number" | head -n 1)

  if [ -z "$NUM" ]; then
    ISSUE_URL=$(gh issue create \
      --repo "$REPO" \
      --title "$TITLE" \
      --body-file "$DIR/$FILE" \
      --label "refactor")

    NUM=$(printf "%s" "$ISSUE_URL" | sed -n 's#.*/issues/\([0-9][0-9]*\).*#\1#p')
    if [ -z "$NUM" ]; then
      echo "Failed to parse issue number from output: $ISSUE_URL" >&2
      exit 1
    fi
    echo "Created #$NUM: $TITLE"
  else
    echo "Reusing existing issue #$NUM: $TITLE"
  fi

  ISSUE_ID=$(gh api /repos/$REPO/issues/$NUM --jq '.id')
  if [ -z "$ISSUE_ID" ]; then
    echo "Failed to fetch issue id for #$NUM" >&2
    exit 1
  fi

  if gh api --method POST /repos/$REPO/issues/$PARENT/sub_issues -F sub_issue_id=$ISSUE_ID >/dev/null; then
    echo "Linked #$NUM as sub-issue of #$PARENT"
  else
    echo "Skipped linking #$NUM (already linked or not linkable)"
  fi
done

echo "Done: 7 issues created and linked to #$PARENT"
