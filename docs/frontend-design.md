# React フロントエンド追加 設計書

## 1. 目的とゴール

- 現在の Hono + SAM バックエンドと **同一リポジトリ** で React SPA を管理する
- Hono の `AppType` を活用し、**フロント⇔バック間で型安全な RPC 通信**を実現する
- `pnpm workspaces` によるモノレポとして、統一されたビルド・Lint・型チェック環境を構築する
- 将来的に共通スキーマ・共通ユーティリティを切り出せる構造にする

## 2. 前提と非目的

**前提:**

- パッケージマネージャは `pnpm@11.10.0`（既存 `pnpm-workspace.yaml` 活用）
- Node.js は `>=24 <25`
- Biome / TypeScript / SAM は既存設定を再利用
- **API のマウントパスを `/api/v1` に統一する**（dev/prod で経路を完全一致させる。§5.0 参照）
- Lambda ランタイム（`template.yaml` の `Runtime`）は `package.json` の `engines.node` と揃える（現状 `nodejs24.x` ⇔ `>=24 <25` で整合）
- 認証は現状 Basic Auth のみ（適用層は §10 で決定）

**非目的:**

- SSR / SSG（Next.js / Remix 等の採用は今回の設計スコープ外）
- モバイル対応（React Native）
- マイクロフロントエンド化

## 3. モノレポ構成

### 3.1 推奨ディレクトリ構成

```
react-hono-sam-template/
├── apps/
│   ├── api/                       # ← 現在の src/ + template.yaml をここへ移動
│   │   ├── src/
│   │   ├── dist/                  # tsc emit した .d.ts 群（web 側が参照）
│   │   ├── template.yaml
│   │   ├── samconfig.toml
│   │   ├── tsconfig.json
│   │   └── package.json
│   └── web/                       # 新規: React SPA
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   ├── routes/
│       │   ├── features/          # 機能単位（users 等）
│       │   ├── components/
│       │   │   └── ui/            # shadcn/ui コンポーネント
│       │   ├── lib/
│       │   │   └── api.ts         # hc<AppType> クライアント
│       │   ├── hooks/
│       │   └── styles/
│       ├── public/
│       ├── index.html
│       ├── vite.config.ts
│       ├── tsconfig.json
│       └── package.json
├── packages/
│   └── shared/                    # (任意) 共通スキーマ・型
│       ├── src/
│       └── package.json
├── .env.example
├── biome.json                     # ルート集約
├── pnpm-workspace.yaml
├── package.json                   # ルート（スクリプトのみ）
└── tsconfig.base.json             # 共通コンパイラオプション
```

### 3.2 選定理由

| 案 | 判定 | 理由 |
| --- | --- | --- |
| `apps/*` + `packages/*` （採用） | ✅ | Turborepo / Nx / Vercel 標準。役割が明確 |
| `frontend/` + `backend/` | ❌ | workspace 命名と親和しない |
| ルートに `web/` だけ足す | ❌ | 将来 shared 追加時に構造が破綻 |

### 3.3 `pnpm-workspace.yaml`

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

## 4. 技術スタック（フロント側）

| カテゴリ | 選定 | 理由 |
| --- | --- | --- |
| ビルドツール | **Vite** | Lambda バックエンドと相性◎、HMR 高速、SPA 出力が S3 と親和 |
| React | **React 19** | 最新の安定版 |
| ルーター | **TanStack Router** | ファイルベース + 完全型付き。search params も型安全 |
| データ取得 | **TanStack Query** + **hono/client (`hc`)** | RPC で `AppType` 経由の型伝播。キャッシュ／再取得管理 |
| フォーム | **React Hook Form** + `@hookform/resolvers` (zod) | バック側 Zod スキーマの再利用 |
| バリデーション | **Zod** | バックと共通、スキーマ再利用可 |
| UI コンポーネント | **shadcn/ui** + **Radix UI** | コード所有＋アクセシビリティ担保 |
| スタイル | **Tailwind CSS v4** | ユーティリティファースト、shadcn と組み合わせ |
| 状態管理（クライアント） | **Zustand**（必要になったら） | Context で足りない時のみ導入 |
| アイコン | **lucide-react** | shadcn/ui の推奨アイコンセット |
| 日付 | **date-fns** | ツリーシェイク可能 |
| テスト | **Vitest** + **Testing Library** | Vite 統合、高速 |
| E2E | **Playwright** | 既存 MCP と親和 |

## 5. URL / 型共有戦略

### 5.0 URL 設計（dev と prod で経路一致）

**方針**: Hono を `/api/v1` にマウントし、フロント・CloudFront・Vite proxy いずれもパス書き換えを行わない。

| 環境 | フロント側の呼び出し | 経路 | Hono マウント |
| --- | --- | --- | --- |
| dev | `/api/v1/users` | Vite proxy → `http://localhost:3000/api/v1/users`（**書き換えなし**） | `/api/v1` |
| prod | `/api/v1/users` | CloudFront `/api/*` Behavior → API Gateway → Lambda（**そのまま透過**） | `/api/v1` |

**背景**: 旧案では Vite で `/api → /v1` に書き換えていたが、CloudFront はデフォルトでパスを書き換えないため、dev/prod で Hono に届くパスが食い違い prod で 404 になる。パスを一致させることで再現性を担保する。

**影響する変更（Step 1 と同時に実施）**:

- `apps/api/src/app.ts` の `app.route("/v1", apiV1Router)` → `app.route("/api/v1", apiV1Router)`
- `apps/api/src/handler/index.ts` のログ出力パスを更新
- CloudFront Behavior は `/api/*` を API Gateway に **リライトせず** 転送
- API Gateway のステージ名（`prod`）と Hono の basePath が二重にならないよう、CloudFront から API Gateway に流す際は Origin Path で `/prod` を吸収

### 5.1 型共有: hc の "compile before use"（推奨）

**方針**: `AppType` は `apps/api/dist/app.d.ts` 経由で提供する。web は `.ts` を直接参照しない。

**理由**:

- `hc<AppType>` はルート数に比例して tsserver 負荷が増大する既知の挙動があり、Hono 公式も「事前に型を確定させる（compile before use / `hcWithType`）」を推奨している
- `.ts` を直参照だと、web の型チェックのたびに api 全体を推論し直すため、後から差し戻すコストが高い

**構成**:

`apps/api/tsconfig.json`（emit 用の追加設定）:

```jsonc
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "declaration": true,
    "emitDeclarationOnly": true,
    "rootDir": "./src"
  },
  "include": ["src/**/*.ts"]
}
```

`apps/api/package.json`:

```jsonc
{
  "name": "@app/api",
  "exports": {
    "./app-type": {
      "types": "./dist/app.d.ts"
    }
  },
  "scripts": {
    "build:types": "tsc --emitDeclarationOnly",
    "typecheck": "tsc --noEmit",
    ...
  }
}
```

`apps/web/src/lib/api.ts`:

```ts
import { hc } from "hono/client"
import type { AppType } from "@app/api/app-type"

const client = hc<AppType>(import.meta.env.VITE_API_BASE_URL)
// hc の型を確定させる（tsserver の再推論を回避）
export const api = client as unknown as ReturnType<typeof hc<AppType>>
```

**フロー**:

1. api を変更したら `pnpm --filter api build:types` で `.d.ts` を生成
2. web の型チェックは api の `.d.ts` のみ参照 → 推論コストが安定
3. ルート `dev` スクリプトで api の `tsc --watch --emitDeclarationOnly` を並行実行し、型を自動更新

**利点**:

- スキーマ codegen 不要
- 変更が `.d.ts` 更新経由で自動反映
- web の tsserver が api 実装を再解析しないため高速

**注意点**:

- web のバンドルに api の実装コードは含めず、`import type` に統一
- Vite の `optimizeDeps.exclude` に `@app/api` を含めることも検討

### 5.2 補助: Zod スキーマの共有（任意）

再利用したいスキーマ（例: `userSchema`）は `packages/shared` に切り出す方針。
初期は不要、`users` を実装に置き換えるタイミングで検討。

## 6. デプロイ構成

### 6.1 SAM 統合方式（推奨）

```
CloudFront Distribution
├── Default Behavior  → S3 (React SPA)
│   └── CustomErrorResponses:
│       ├── 403 → /index.html (Status 200)
│       └── 404 → /index.html (Status 200)  ← SPA フォールバック必須
└── /api/*            → API Gateway (Lambda)  ← パスは書き換えず透過
    └── Origin Path: /prod                    ← ステージ名を CloudFront で吸収
```

`apps/api/template.yaml` に以下を追加:

- `AWS::S3::Bucket`（フロント配信用、パブリックアクセスは OAC で遮断）
- `AWS::CloudFront::Distribution`
  - Default Behavior: S3 オリジン
  - `/api/*` Behavior: API Gateway オリジン（`Origin Path` に `/prod` を設定してステージを吸収）
  - **`CustomErrorResponses`**: 403 と 404 を `/index.html` にフォールバック（TanStack Router のクライアントサイドルーティング用）
  - `DefaultCacheBehavior` の `ResponseHeadersPolicy` で `index.html` は `no-cache`
- `AWS::CloudFront::OriginAccessControl`（OAC で S3 保護）
- `AWS::CloudFront::CachePolicy`（`/api/*` は無キャッシュ or 短 TTL）

**SPA フォールバックの根拠**: `/users/123` などに直アクセス／リロードすると S3 に該当オブジェクトが無いため 403（OAC 有効時）or 404 が返る。これを `/index.html` に振り替えて 200 で返し、クライアント側ルーターに解決させる。

**同一オリジン化の副次効果**: フロント⇔API が同一ドメインになるため **CORS が不要**（§8 参照）。

### 6.2 別デプロイ方式（代替案）

- フロント: Vercel / Netlify / Cloudflare Pages
- API: 現行の SAM デプロイのまま
- **この方式ではフロントと API が別オリジンになるため CORS 設定が必要**（§8）
- SPA フォールバックは各プラットフォームの機能で対応（Vercel: 自動、Netlify: `_redirects`）

**判断基準:**

| 状況 | 推奨 |
| --- | --- |
| AWS 一本化 / IaC 統一 | SAM 統合 |
| PR プレビュー / CDN 品質重視 | Vercel などに分離 |

## 7. 開発フロー

### 7.1 ローカル起動

```bash
pnpm dev                     # api + web + api の型 emit を並行起動
pnpm --filter web dev        # web のみ
pnpm --filter api dev        # api のみ
pnpm --filter api sam:dev    # SAM ローカルで API 起動
```

### 7.2 Vite の API プロキシ設定（書き換えなし）

`apps/web/vite.config.ts`:

```ts
export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        // rewrite は行わない: Hono は /api/v1 にマウントされているため
      },
    },
  },
})
```

CORS を気にせず開発可能。dev の呼び出し `/api/v1/users` はそのまま Hono に届く。

### 7.3 スクリプト（ルート `package.json`）

```json
{
  "scripts": {
    "dev": "pnpm --parallel --filter \"./apps/*\" dev",
    "dev:types": "pnpm --filter api tsc --watch --emitDeclarationOnly",
    "build": "pnpm --filter api build:types && pnpm -r build",
    "typecheck": "pnpm -r typecheck",
    "lint": "biome lint .",
    "format": "biome format --write .",
    "check": "biome check .",
    "fix": "biome check --write ."
  }
}
```

`build` の前段で必ず api の `.d.ts` を emit する（web の型チェックが参照するため）。

## 8. 環境変数と CORS

**フロント（`apps/web/.env.example`）:**

```
VITE_API_BASE_URL=/api/v1       # dev は Vite proxy 経由、prod は同一オリジン
```

**CORS の要否**:

| デプロイ方式 | CORS 設定 |
| --- | --- |
| 6.1 SAM 統合（同一オリジン） | **不要**。`corsMiddleware` を外すか、開発用 origin のみ許可に絞る |
| 6.2 別デプロイ（Vercel など） | **必要**。`origin` を CloudFront ドメイン等に厳格化 |

**別デプロイ時の CORS 例**:

```ts
export const corsMiddleware = cors({
  origin: env.CORS_ORIGIN,   // 例: "https://app.example.com"
  ...
})
```

## 9. マイグレーション手順

### Step 1: モノレポ骨組み作成 + basePath 変更

1. `apps/api/` を新設し、既存の `src/`, `template.yaml`, `samconfig.toml`, `tsconfig.json` を移動
2. **`apps/api/src/app.ts` の `app.route("/v1", ...)` を `app.route("/api/v1", ...)` に変更**
3. **`apps/api/src/handler/index.ts` のログ出力パスを `/api/v1/*` に更新**
4. `apps/api/package.json` を作成（依存関係を移動、`exports."./app-type"` を追加、`build:types` スクリプト追加）
5. ルート `package.json` は workspace 統括スクリプトのみに縮小
6. `tsconfig.base.json` を作成し、各パッケージから extends
7. `pnpm --filter api build:types` で `.d.ts` が生成されることを確認

### Step 2: web 追加

8. `pnpm create vite apps/web --template react-ts` で Vite プロジェクト生成
9. `apps/web/package.json` に `"@app/api": "workspace:*"` を追加
10. `hc<AppType>` クライアントを `@app/api/app-type` 経由で設定
11. Vite proxy を **書き換えなし** で設定（§7.2）
12. `/api/v1/healthcheck` を叩いて dev で疎通確認

### Step 3: 開発体験整備

13. Tailwind + shadcn/ui 導入
14. TanStack Router + TanStack Query 導入
15. ルート `package.json` に `dev` / `build` 統合スクリプト（api の型 watch を含む）

### Step 4: デプロイ整備

16. `template.yaml` に S3 + CloudFront + OAC を追加
17. **CloudFront に `CustomErrorResponses`（403/404 → `/index.html`）を追加**
18. **CloudFront `/api/*` Behavior の Origin Path を `/prod` に設定**
19. `sam:deploy` にフロントビルド → S3 sync のステップを追加
20. GitHub Actions などで CI 化

### Step 5: サンプル差し替え

21. `users` サンプルを、フロント込みで CRUD 画面を持つ完成した例に置き換え

## 10. 未決事項（要決定）

| 項目 | 選択肢 | 決定期限 |
| --- | --- | --- |
| **認証方式** | Cognito / Auth0 / Clerk / 自前 JWT | 実装前 |
| **認証を掛ける層** | CloudFront Functions / API Gateway Authorizer / Hono ミドルウェア | 実装前（SPA にも掛けるなら CloudFront 層一択） |
| **UI テーマ** | shadcn の default / new-york | 導入時 |
| **国際化** | i18next / lingui / 不要 | 実装前 |
| **デプロイ形態** | SAM 統合 / Vercel 分離 | Step 4 前 |
| **CI/CD** | GitHub Actions 構成 | Step 4 中 |
| **型共有粒度** | RPC のみ / shared パッケージ併用 | shared 追加時 |

## 11. リスクと対策

| リスク | 影響 | 対策 |
| --- | --- | --- |
| フロントバンドルに api コード混入 | バンドルサイズ肥大 | `import type` 限定＋ Vite の `optimizeDeps.exclude` |
| モノレポ構成による学習コスト増 | 開発着手遅延 | README に workspace 運用ルールを明記 |
| SPA 直リンクで 403/404 | 主要導線が壊れる | CloudFront `CustomErrorResponses` で `/index.html` フォールバック（§6.1） |
| dev/prod のパス乖離 | 本番で 404 | Hono を `/api/v1` にマウントしてパス書き換えを廃止（§5.0） |
| `hc<AppType>` の tsserver 遅延 | 型チェック時間肥大 | api の `.d.ts` を事前 emit し、web は `.d.ts` のみ参照（§5.1） |
| CORS 設定ミスで本番接続不可 | 本番障害 | 6.1 では同一オリジンで CORS 廃止、6.2 なら環境変数化＋ステージング検証 |
| CloudFront キャッシュ問題 | SPA の古い版が配信 | ビルド時ハッシュ命名＋ `index.html` は `no-cache` |
| Node.js バージョン差分 | 実行時挙動の乖離 | `engines.node` と `template.yaml` の `Runtime` を常時揃える |

## 12. 移行後のディレクトリ完成形

```
react-hono-sam-template/
├── apps/
│   ├── api/                       # 既存の src/ 一式
│   │   ├── src/{app,handler,lib,middleware,routes,schemas,services,...}
│   │   ├── dist/                  # tsc --emitDeclarationOnly の出力
│   │   ├── template.yaml
│   │   ├── samconfig.toml
│   │   ├── tsconfig.json
│   │   └── package.json           # exports."./app-type" で AppType 公開
│   └── web/
│       ├── src/{main.tsx,App.tsx,routes,features,components,lib,hooks,styles}
│       ├── public/
│       ├── index.html
│       ├── vite.config.ts
│       ├── tsconfig.json
│       └── package.json
├── packages/
│   └── shared/                    # 任意（初期は空でも可）
├── docs/
│   └── frontend-design.md         # 本書
├── biome.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── package.json
├── .env.example
└── README.md
```

## 13. 次のアクション

1. 本設計書のレビュー
2. 「10. 未決事項」の一部（特に認証方式・認証を掛ける層・デプロイ形態）を確定
3. Step 1（モノレポ骨組み + basePath 変更）から着手
