# react-hono-sam-template

React SPA + Hono API を **AWS Lambda + API Gateway + CloudFront + S3 + DynamoDB** で一体運用する、型安全なサーバーレスモノレポテンプレート。

- **フロント**: Vite + React 19 + TanStack Router/Query + shadcn/ui + Tailwind CSS v4
- **バックエンド**: Hono + Zod OpenAPI (Swagger / Scalar 自動生成) + DynamoDB
- **RPC 型共有**: Hono の `hc<AppType>` によるフロント⇔バック間の完全型付き通信
- **デプロイ**: AWS SAM (Lambda + API Gateway + CloudFront + S3 + DynamoDB を 1 スタックで管理)
- **ローカル開発**: Docker Compose で DynamoDB Local 起動 → `pnpm dev` で api / web / 型 watch を並行実行

## 目次

- [クイックスタート](#クイックスタート)
- [技術スタック](#技術スタック)
- [ディレクトリ構成](#ディレクトリ構成)
- [開発フロー](#開発フロー)
- [アーキテクチャの要点](#アーキテクチャの要点)
- [デプロイ](#デプロイ)
- [CI / CD](#ci--cd)
- [テンプレートとしての注意点](#テンプレートとしての注意点)
- [トラブルシューティング](#トラブルシューティング)

## クイックスタート

### 前提条件

| ツール | バージョン |
| --- | --- |
| Node.js | `>=24 <25` |
| pnpm | `11.10.0`（`packageManager` フィールドで固定） |
| Docker Desktop | 任意（DynamoDB Local 用。OrbStack / Colima でも可） |
| AWS SAM CLI | デプロイ時のみ、`nodejs24.x` 対応版（1.144.0 以降） |
| AWS CLI | ローカル DB 初回セットアップ時（Docker Compose 経由なら不要） |

### 5 分で立ち上げる

```bash
# 1. 依存関係のインストール
pnpm install

# 2. 環境変数（api と web の両方）
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# 3. DynamoDB Local を起動 + テーブル自動作成
pnpm db:up

# 4. 全アプリを並行起動（api + web + 型 watch）
pnpm dev
```

**注**: `apps/web/.env` は `VITE_API_BASE_URL` を渡すために必須です。未設定だと `apps/web/src/lib/api.ts` が fail-fast で throw します（silently 相対 URL に落ちるのを防ぐため）。

アクセス先:

| URL | 内容 |
| --- | --- |
| <http://localhost:5173/> | React SPA ホーム（Hono RPC 経由の healthcheck 表示） |
| <http://localhost:5173/users> | ユーザー CRUD 画面（DynamoDB Local と接続） |
| <http://localhost:3000/api/v1/scalar> | Scalar API リファレンス |
| <http://localhost:3000/api/v1/swagger> | Swagger UI |
| <http://localhost:3000/api/v1/doc> | OpenAPI 3.1 JSON |

## 技術スタック

### apps/api（バックエンド）

| 分類 | ライブラリ | 用途 |
| --- | --- | --- |
| Web フレームワーク | [Hono](https://hono.dev/) | 軽量・高速、Lambda コールドスタート最適化 |
| OpenAPI | [@hono/zod-openapi](https://github.com/honojs/middleware/tree/main/packages/zod-openapi) | Zod スキーマから OpenAPI 3.1 自動生成 |
| API ドキュメント | [@hono/swagger-ui](https://github.com/honojs/middleware/tree/main/packages/swagger-ui) / [@scalar/hono-api-reference](https://github.com/scalar/scalar) | Swagger UI / Scalar |
| バリデーション | [Zod](https://zod.dev/) | ランタイム + 型 |
| ロガー | [pino](https://getpino.io/) | 構造化ログ (CloudWatch Logs JSON 対応) |
| DB SDK | [@aws-sdk/lib-dynamodb](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-lib-dynamodb/) | DynamoDB DocumentClient |
| ローカル環境変数 | [dotenv](https://github.com/motdotla/dotenv) | ローカル開発時のみ `.env` を読み込み |
| ローカル開発 | [tsx](https://github.com/privatenumber/tsx) + [concurrently](https://github.com/open-cli-tools/concurrently) | `watch` + 型 `--emitDeclarationOnly --watch` を並行 |

### apps/web（フロントエンド）

| 分類 | ライブラリ | 用途 |
| --- | --- | --- |
| ビルド | [Vite](https://vite.dev/) | HMR + SPA プロダクションビルド |
| UI | React 19 + [shadcn/ui](https://ui.shadcn.com/) | コンポーネント |
| スタイル | [Tailwind CSS v4](https://tailwindcss.com/) | ユーティリティ |
| ルーティング | [TanStack Router](https://tanstack.com/router) | ファイルベース + 完全型付き |
| データフェッチ | [TanStack Query](https://tanstack.com/query) + [Hono RPC](https://hono.dev/docs/guides/rpc) | キャッシュ / 再取得 + 型安全 API 呼び出し |
| フォーム | [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/) | バリデーション |
| 通知 | [Sonner](https://sonner.emilkowal.ski/) | Toast |
| アイコン | [Lucide](https://lucide.dev/) | shadcn 標準 |

### インフラ

| 分類 | 使用技術 |
| --- | --- |
| モノレポ | pnpm workspaces |
| Lint / Format | [Biome](https://biomejs.dev/) |
| IaC | [AWS SAM](https://aws.amazon.com/serverless/sam/) |
| CI/CD | GitHub Actions (SHA ピン) + Dependabot (cooldown 付き) |
| ローカル DB | Docker Compose + [amazon/dynamodb-local](https://hub.docker.com/r/amazon/dynamodb-local) |

## ディレクトリ構成

```bash
react-hono-sam-template/
├── apps/
│   ├── api/                          # Hono API (Lambda + API Gateway)
│   │   ├── src/
│   │   │   ├── app.ts                # Hono アプリ本体 (onError で 500 集約)
│   │   │   ├── handler/              # エントリーポイント
│   │   │   │   ├── index.ts          # ローカル開発 (@hono/node-server)
│   │   │   │   └── lambda.ts         # Lambda ハンドラ
│   │   │   ├── lib/                  # 共通ユーティリティ
│   │   │   │   ├── date.ts           # ISO 日時のブランド型 / codec
│   │   │   │   ├── dynamodb.ts       # DocumentClient シングルトン
│   │   │   │   ├── env.ts            # 環境変数
│   │   │   │   ├── http.ts           # errorBody ヘルパー
│   │   │   │   ├── logger.ts         # pino ロガー
│   │   │   │   └── openapi-hono.ts   # OpenAPI Hono ファクトリ
│   │   │   ├── middleware/           # cors / basic-auth
│   │   │   ├── routes/               # v1 ルーター組み立て
│   │   │   ├── schemas/              # 共通スキーマ (response / user)
│   │   │   ├── services/             # ビジネスロジック (DynamoDB CRUD)
│   │   │   └── package.json          # ← Lambda deploy 用 runtime deps
│   │   ├── dist/                     # tsc --emitDeclarationOnly の出力 (.d.ts)
│   │   ├── template.yaml             # SAM CloudFormation
│   │   ├── samconfig.toml
│   │   ├── tsconfig.json
│   │   ├── .env.example
│   │   └── package.json              # exports."./app-type" で AppType 公開
│   │
│   └── web/                          # React SPA (Vite)
│       ├── src/
│       │   ├── main.tsx              # Provider セットアップ
│       │   ├── index.css             # Tailwind + shadcn theme
│       │   ├── routes/               # TanStack Router ファイルベース
│       │   │   ├── __root.tsx        # 共通レイアウト (Nav + Outlet)
│       │   │   ├── index.tsx         # / (Home)
│       │   │   └── users/index.tsx   # /users (CRUD 画面)
│       │   ├── routeTree.gen.ts      # ← Vite プラグイン自動生成 (.gitignore)
│       │   ├── components/ui/        # shadcn/ui コンポーネント
│       │   ├── features/users/       # users 機能まわり (schema / form)
│       │   └── lib/
│       │       ├── api.ts            # hc<AppType> クライアント
│       │       └── utils.ts          # cn 等
│       ├── vite.config.ts            # React + Tailwind v4 + TanStack Router
│       ├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
│       └── package.json              # @app/api を workspace 依存として参照
├── packages/                         # (任意) 共通スキーマの置き場
├── docs/
│   └── frontend-design.md            # フロント追加時の設計書
├── scripts/
│   └── deploy-web.sh                 # S3 sync + CloudFront invalidation
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                    # PR / push: typecheck / lint / build
│   │   └── deploy.yml                # AWS OIDC で自動デプロイ (雛形)
│   └── dependabot.yml                # weekly + cooldown 付き
├── docker-compose.yml                # DynamoDB Local + init container
├── biome.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json                      # workspace 統括
```

## 開発フロー

### スクリプト一覧（ルート）

| コマンド | 用途 |
| --- | --- |
| `pnpm dev` | api + web + 型 watch を並行起動 |
| `pnpm typecheck` | 全パッケージの `tsc --noEmit` |
| `pnpm build` | api の `.d.ts` emit → 全パッケージ build |
| `pnpm check` | Biome lint + format チェック |
| `pnpm fix` | Biome 自動修正 |
| `pnpm check:lambda-deps` | `apps/api/src/package.json` と親の drift 検出（CI で自動実行） |
| `pnpm db:up` | DynamoDB Local 起動 + テーブル自動作成 |
| `pnpm db:down` | DynamoDB Local 停止 (データは保持) |
| `pnpm db:reset` | データ完全リセットして再起動 |
| `pnpm db:logs` | Docker Compose ログ |
| `pnpm deploy:all` | build → sam build → sam deploy → S3 sync + CloudFront invalidation |
| `pnpm deploy:web` | web のみ再デプロイ |

**⚠️ 注意**: `pnpm deploy`（`deploy:all` ではない裸の `deploy`）は pnpm の**予約サブコマンド**（プロジェクトを別ディレクトリへコピーする内蔵機能）と衝突するため、必ず `deploy:all` または `pnpm run deploy:all` で呼び出してください。

### api のみ / web のみ操作

```bash
pnpm --filter @app/api dev          # api 単体起動 (型 watch 込み)
pnpm --filter @app/web dev          # web 単体起動
pnpm --filter @app/api build:types  # .d.ts を手動再生成
pnpm --filter @app/api sam:dev      # SAM Local で API Gateway エミュレート
```

### API 変更 → フロント型反映の自動化

`pnpm dev` は 3 プロセスを同時起動:

```text
apps/api dev: [handler]  tsx watch src/handler/index.ts       ← ソース再起動
apps/api dev: [types]    tsc --emitDeclarationOnly --watch    ← .d.ts 自動更新
apps/web dev:            vite                                  ← HMR
```

`apps/api/src/routes/*` を編集すると `apps/api/dist/app.d.ts` が即更新され、web の tsserver がそれを拾って型が自動反映されます。

### 疎通確認 (curl)

```bash
# 一覧
curl http://localhost:3000/api/v1/users | jq .

# 作成
curl -X POST http://localhost:3000/api/v1/users \
  -H "Content-Type: application/json" \
  -d '{"name":"John","email":"john@example.com"}' | jq .

# 削除
curl -X DELETE http://localhost:3000/api/v1/users/<id>
```

## アーキテクチャの要点

### dev/prod で URL パス一致

Hono は `/api/v1` にマウント、CloudFront も同じ `/api/*` を透過的にルーティング:

| 環境 | フロント呼び出し | 経路 | Hono マウント |
| --- | --- | --- | --- |
| dev | `/api/v1/users` | Vite proxy → `localhost:3000/api/v1/users`（書き換えなし） | `/api/v1` |
| prod | `/api/v1/users` | CloudFront `/api/*` Behavior → API Gateway → Lambda | `/api/v1` |

**設計上のポイント**: パス書き換え（rewrite）を一切行わない。「同じ URL は同じ場所に届く」ことで dev/prod のバグを排除。

### Hono RPC の型共有: compile before use

api の `.ts` を web が直接参照すると、`hc<AppType>` の型推論負荷が肥大化して tsserver が重くなる問題があります。

**対策**: api を `.d.ts` に emit してから web に公開する:

```json
// apps/api/package.json
"exports": {
  "./app-type": { "types": "./dist/app.d.ts" }
}
```

```ts
// apps/web/src/lib/api.ts
import type { AppType } from "@app/api/app-type"
import { hc } from "hono/client"
const _client = hc<AppType>("")
type Client = typeof _client
const createClient = (baseUrl: string): Client => hc<AppType>(baseUrl)
export const api = createClient(import.meta.env.VITE_API_BASE_URL)
```

`pnpm dev` の `watch:types` が編集ごとに `.d.ts` を再 emit するので、web にはリアルタイムで反映されます。

### CloudFront 経由の同一オリジン化

```bash
CloudFront Distribution
├── / (Default Behavior)  → S3 (SPA アセット, CachingOptimized)
│   └── 403/404 → /index.html (200)  ← SPA fallback for TanStack Router
└── /api/*                → API Gateway (Origin Path: /prod で吸収)
```

**副次効果**:

- **CORS 不要**: フロントと API が同一オリジン
- **SPA 直リンク対応**: `/users/123` などに直接アクセスしても index.html にフォールバック
- **ステージ吸収**: `Origin Path: /prod` で `/prod/` プレフィックスを CloudFront が付与

### エラーハンドリング

- **400 (バリデーション)**: `lib/openapi-hono.ts` の `defaultHook` が Zod エラーを整形
- **404 等 (既知)**: `errorBody("...")` ヘルパーでレスポンス生成
- **500 (未捕捉)**: `app.onError` で logger 出力 + 汎用エラーレスポンス

すべて `schemas/response.schema.ts` の `errorResponseSchema` に準拠。

## デプロイ

### AWS リソース構成

`apps/api/template.yaml` が以下を 1 スタックで管理:

- `AWS::Serverless::Function` (Lambda, nodejs24.x arm64)
- `AWS::Serverless::Api` (API Gateway, prod ステージ)
- `AWS::DynamoDB::Table` (PAY_PER_REQUEST, PITR + SSE 有効)
- `AWS::S3::Bucket` (Public 遮断, バージョニング有効)
- `AWS::CloudFront::Distribution` (S3 + API Gateway ルーティング)
- `AWS::CloudFront::OriginAccessControl` (OAC で S3 保護)

### 実行手順

```bash
# 1. AWS 認証 (SSO or Access Key)
aws sso login

# 2. samconfig.toml の stack_name / region を確認・編集
vim apps/api/samconfig.toml

# 3. デプロイ (フル: api + web)
pnpm deploy:all
```

`deploy:web` に `CONFIG_ENV` / `STACK_NAME` / `AWS_REGION` を渡して複数環境に対応:

```bash
# staging スタックへ web だけ再デプロイ
CONFIG_ENV=staging pnpm deploy:web

# stack 名を明示指定
STACK_NAME=my-custom-stack pnpm deploy:web
```

### 出力

デプロイ後の CloudFormation Outputs:

- `WebSiteURL`: CloudFront の公開 URL
- `WebSiteBucketName`: S3 バケット名
- `CloudFrontDistributionId`: 無効化に使う ID
- `UsersTableName`: DynamoDB テーブル名

### web だけ更新した時

```bash
pnpm --filter @app/web build
pnpm deploy:web  # S3 sync + CloudFront invalidation
```

### api だけ更新した時

```bash
pnpm --filter @app/api sam:build
pnpm --filter @app/api sam:deploy
```

## CI / CD

### CI (`.github/workflows/ci.yml`)

PR / push で自動実行:

1. `pnpm install --frozen-lockfile`
2. `pnpm biome:ci` (lint + format)
3. `pnpm check:lambda-deps` (Lambda deploy deps 同期チェック)
4. `pnpm --filter @app/api build:types` (`.d.ts` emit)
5. `pnpm typecheck`
6. `pnpm build`

すべての action は **フル SHA でピン**、Dependabot が weekly で更新提案。

### Deploy (`.github/workflows/deploy.yml`)

**初期状態は `if: false` で無効化**。有効化には以下が必要:

1. AWS に GitHub Actions 用 OIDC provider を作成
2. IAM ロールを Trust Policy 付きで作成
3. GitHub リポジトリの Settings → Actions → Variables に:
   - `AWS_REGION` (例: `ap-northeast-1`)
   - `AWS_DEPLOY_ROLE_ARN` (作成した IAM ロールの ARN)
4. `.github/workflows/deploy.yml` の `if: false` を `if: true` に

詳細は `.github/workflows/deploy.yml` の冒頭コメント参照。

### Dependabot (`.github/dependabot.yml`)

- **github-actions**: weekly 更新, 7 日 cooldown
- **npm**: weekly 更新, 7 日 cooldown, minor + patch は 1 PR に集約

## テンプレートとしての注意点

### `apps/api/src/package.json` を同期させる

Lambda ビルド用の依存宣言です。ランタイム deps（Lambda 上で必要な npm パッケージ）を `apps/api/package.json` と合わせる必要があります。

**含めるもの**:

- ランタイム deps（`dependencies`）: hono / zod / pino など Lambda 上で必要な全パッケージ

**除外するもの**:

- `@aws-sdk/*` — Lambda ランタイムが提供
- `@hono/node-server` — ローカル起動専用
- `dotenv` — ローカルの `.env` 読み込み専用
- `esbuild` — SAM の esbuild builder は sandbox 内から esbuild を探すが、`src/package.json` に含めても hoisting 制約で参照できない場合がある。**グローバルインストール**した esbuild を使う運用にしている（下記参照）

**hono などを bump した時は両方更新** してください。CI で `pnpm check:lambda-deps` が同期を自動検証するので、drift すると PR がブロックされます。

### `sam build` は esbuild をグローバル参照する

SAM の Node.js esbuild builder は `apps/api/src/` を sandbox にコピーし、`npm install --production` を走らせてから esbuild で bundle します。ローカルで `sam build` を実行する場合、esbuild が **PATH または require path で見つかる必要**があります。

**ローカル環境（初回のみ）**:

```bash
npm install -g esbuild@0.28.1
```

**CI**: `.github/workflows/ci.yml` で自動的にグローバルインストールされます。

**バージョン**: `apps/api/package.json` の `devDependencies.esbuild` と揃えてください（`^0.28.1`）。

### SAM esbuild builder は npm を使う（pnpm-lock は反映されない）

SAM の Node.js esbuild builder は `apps/api/src/package.json` の `dependencies` を **npm** で `install` してから esbuild で bundle します。`pnpm-lock.yaml` は無視されるため、Lambda に載る依存の実バージョンは `^x.y.z` レンジで CI 実行時に解決される版になります。

**現状の対応**:
- `apps/api/src/package.json` にランタイム deps を明示（版レンジも明示）
- `pnpm check:lambda-deps` で親の `package.json` との drift を検出

**より厳密にしたい場合の選択肢**:
- `apps/api/src/` に `package-lock.json` をコミットして `npm ci` で再現ビルド
- SAM の Makefile builder に切り替え、Makefile 内で `pnpm --filter @app/api install --prod` を実行してから esbuild bundle

### `users` はサンプル、実装時に置き換え推奨

`users` は「テンプレの機能を紹介するためのサンプル CRUD」です。実プロジェクトでは:

1. `apps/api/src/routes/users` / `services/user.service.ts` / `schemas/user.schema.ts` を自分のリソースに置換
2. または `apps/web/src/features/users` を参考に新規機能を追加

### `middleware/basic-auth.ts` はデモ実装

`createBasicAuthMiddleware()` は **factory 関数**で、production で `BASIC_AUTH_USERNAME` / `BASIC_AUTH_PASSWORD` が未設定なら **throw** します。development のみ `admin` / `password` にフォールバック（警告付き）。

本番採用時は以下いずれかに置き換え推奨:

- Cognito
- Auth0 / Clerk
- Lambda Authorizer + JWT
- CloudFront Functions

認証を掛ける層（フロント含めるなら CloudFront 一択）は要検討。

### `middleware/cors.ts` は同一オリジン運用前提

CloudFront で同一オリジン化する構成（§ アーキテクチャの要点）を前提に、`credentials: true` を**外して**あります。別ドメインで運用する場合は `origin` を allowlist に絞り、`credentials: true` を復活させてください。

### 必須環境変数は production で throw

`apps/api/src/lib/env.ts` は以下を production で必須にしています（未設定なら Lambda cold start で fail-fast）:

- `USERS_TABLE_NAME`
- `AWS_REGION`（Lambda ランタイムが自動注入するが安全側）

Development では local dev の摩擦ゼロを優先し、未設定でもデフォルトフォールバック（`users-local` など）。`DYNAMODB_ENDPOINT_URL` が dev で未設定の場合は console.warn で「本物 AWS に繋がる可能性がある」旨を通知。

### OpenAPI `servers` は相対 URL

`apps/api/src/routes/index.ts` の `servers: [{ url: "/api/v1" }]` は **相対 URL**。 doc 配信元 (dev: `localhost:3000`, prod: CloudFront ドメイン) に対して解決されるので、`API_BASE_URL` を env で渡す必要がありません。

**これは SAM 循環依存の回避策**でもあります。CloudFront ドメインを Lambda env に注入すると `Lambda ↔ CloudFront ↔ ApiGateway` の循環依存が発生してデプロイ失敗するため、そもそも Lambda がドメインを知る必要がない構造にしています。

### エラーハンドリング

- **500 (未捕捉)**: `app.onError` が AWS SDK エラー名を HTTP status にマップ（Throttling → 429、ServiceUnavailable → 503、Validation → 400）、`requestId` を発行して**ログとレスポンス両方に含める**
- **web の toast**: `ensureOk()` ヘルパー経由でサーバーの `error.message` と `requestId` を extract して表示

### 型共有ルール

- **wire 型（User, CreateUser など）**: `apps/api/src/schemas/` を single source of truth に、`@app/api/schemas` から web に types-only export
- **form 用 Zod スキーマ**: web 側で個別に定義（UX 特化のエラーメッセージのため）
- **`hc<AppType>`**: api の `.d.ts` を `apps/api/dist/` に emit してから型参照（tsserver 負荷抑制）

### AWS 認証は SSO 推奨

ローカルからのデプロイは `aws sso login` を推奨。IAM Access Key の長期発行は避けてください。GitHub Actions での自動デプロイは **OIDC** で実装（`.github/workflows/deploy.yml` 冒頭コメント参照）。

### `findAll()` の Scan 制限

`apps/api/src/services/user.service.ts` の `findAll()` は DynamoDB Scan をページネーションで全走査していますが、**ハードキャップ 10,000 件** で打ち切ります。無限データ増加や Lambda タイムアウトを防ぐ安全側の default です。実運用では以下いずれかに置き換え推奨:

- GSI + Query パターン（tenant / status で partition）
- カーソルベースの list API（`?cursor=...&limit=...`）で `LastEvaluatedKey` をクライアントに透過

## トラブルシューティング

### `pnpm install` が supply-chain policy でエラー

`pnpm-workspace.yaml` の `minimumReleaseAge: 10080`（7 日）に引っかかっている可能性。新しすぎる依存は `~x.y.z` などでバージョンを絞ってください。

### `Cannot find module '@app/api/app-type'`

api の `.d.ts` が未生成:

```bash
pnpm --filter @app/api build:types
```

`pnpm dev` を起動していれば通常自動で emit されます。

### `Type instantiation is excessively deep`

`hono` のバージョンが api と web で不一致の可能性:

```bash
pnpm why hono
# Found 1 version of hono になっていればOK
```

両方の `package.json` の hono を同じ範囲に揃えて `pnpm install`。

### `Error: listen EADDRINUSE :::3000`

別プロセスが port 3000 を掴んでいる:

```bash
lsof -ti :3000 | xargs kill -9
```

### `ResourceNotFoundException` (DynamoDB)

DynamoDB Local が起動していない、またはテーブルが未作成:

```bash
pnpm db:up   # 起動 + テーブル作成
```

### CloudFront の内容が古い

キャッシュが残っている可能性。`pnpm deploy:web` を再実行すると `index.html` の invalidation が走ります。

### CloudFront で SPA は表示されるがアセットが落ちる

`template.yaml` の `CustomErrorResponses` が 403/404 を `/index.html` にリライトしているため、OAC / BucketPolicy の設定ミス（S3 実 403）が「空白の SPA」の形で隠蔽されます。以下で切り分け:

```bash
# アセットが正しく 200 で返るか
curl -I https://<cf-domain>/assets/index-<hash>.js

# CloudFront の OAC が正しくアタッチされているか
aws cloudfront get-distribution-config --id <dist-id>
```

CloudWatch で `4xxErrorRate` メトリクスをアラート化するのも推奨。

### `pnpm deploy` を実行したら何も起こらない

`pnpm deploy` は pnpm 内蔵サブコマンドと衝突します。**`pnpm deploy:all`** で実行してください（トラブルシューティング §「⚠️ 注意」参照）。

## ライセンス

MIT
