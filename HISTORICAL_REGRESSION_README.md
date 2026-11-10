# 当前控制器四路线 CPU 自动回归

这是新增的、独立版本化的回归包。它不替换任何原生产文件、旧输入、旧测试或金样。**新路线测试通过不代表历史全套通过，更不代表 WebGL、GPU、Mac、触控或真人体验通过。**

## 目录与来源

- `project/`：原 `../physics-audit-candidate/` 的完整隔离副本，沿用已安装依赖，无网络下载或安装。
- `objective_choice_candidate/`：原目录的 7 个文件，供原测试的历史对照导入使用。
- `fixtures/manifest.json`：四条真实新路线的固定输入/结果哈希、独立终局值和原始来源目录。
- `fixtures/*/*inputs.json.gz`、`*result.json.gz`：原证据逐字节副本，不在测试中更新。
- 两条东线的 `*raw-result.v8`：保存包括负零在内的原始最终状态和事件。沙隼东线来自原 `lossless-confirmation/`，Tiger 东线来自首次记录。
- `fixtures/frozen-source-hashes.json`：已保存的 409 份源文件/原测试/资产/package 字节绑定。
- `fixtures/runtime-hashes.json`：本次复制的 1329 个已安装依赖文件哈希。不是最小依赖闭包声明。
- `fixtures/historical-baseline.json`：原全套 1471 项结果，1421 通过、29 失败、21 跳过，原失败名称完整保留。
- `lib/`：共享、只读证据校验及真实重放逻辑。无需复制四份驾驶脚本。
- `tests/`：校验器负向测试、真实文件损坏探针及四路线全量重放。
- `evidence/`：本次红绿测试、实际重放、旧全套和不改原文件的核对结果。

## 重跑

使用 **Node v24.22.1**，与原记录一致。V8 序列化证据和严格数值结果不跨版本自动放宽。

在本目录执行：

```sh
npm test                 # 新包所有自动测试，包括四次独立新进程真实重放
npm run test:guards      # 快速输入/事件校验器测试
npm run test:routes      # 只跑四条路线
node run-route.mjs tiger-east
npm run test:legacy      # 原 package.json 的完整 npm test，保留真实非零退出
npm run test:all         # 新包和原全套都运行，任意一边失败就退出 1
```

四路线 ID 为 `tiger-west`、`sandfalcon-west`、`sandfalcon-east`、`tiger-east`。

全套历史日志比较是**审计命令**，不把旧红灯变成通过：

```sh
node compare-legacy.mjs evidence/legacy-full-suite.log evidence/legacy-full-suite.exit
```

它只有在原失败集合、所有计数及退出状态保持一致时返回 0，同时结果始终保留 `historicalSuitePassed: false` 和原退出 1。这不应替代 `npm run test:legacy` 的发布门禁。

## 实际验证内容

1. 在任何生产模块导入/模拟前，验证压缩输入、JSON 结果、东线 V8 结果、源清单、409 个源文件和1329个依赖文件的 SHA-256。丢失/损坏/版本不符立即失败，不更新金样。
2. 检查普通控制键、类型、有限数、范围、run 长度/总数、固定 1/60 步长、一次正常 start、车型/路线和完整历史前缀。
3. 从真实 `createGame(spec)` 开始，只向真实 `stepGame` 输入带中普通输入。没有驾驶员、保存状态加载、复活、传送、模拟替身或隐藏无敌。
4. 每步验证 tick、存活、有限数、炮口无碰撞、事件唯一/有序、弹丸发射与命中/伤害因果、无友军伤害。允许真实“同 tick 发射并撞击”的弹丸已被消费，不错误要求它仍留在末帧。
5. 车队真实到达 `(0,-32)`，路线上锁，arrival → escort objective complete → mission end 的因果次序正确，最终获胜且双方存活。
6. 整个最终状态及全部有序事件严格相等。东线直接对比 V8 原始数据，不抹平负零，不添加数值容差。另核对完整最终哈希及独立固定终局值。
7. 损坏真实压缩输入/结果、有效 JSON 重压缩改控制、截断输入、破坏 V8 的 CLI 探针必须退出 1，不能输出成功报告。

## 必须保留的边界

- Tiger 西、沙隼西、沙隼东保留完整旧输入作为前缀。Tiger 东正常开局只保留 **2400/9543** 次旧输入，随后分叉；后 7143 次旧输入没有被消费。旧带战败仍保留。
- 新路线不等于旧带兼容性修复。旧版本字节绑定与历史轨迹失败仍须独立处理。
- 这些路线不能替代原测试要求的北方敌人后半程有效受伤场景。新套件记录 lateNorthernShots/lateNorthernDamage（事件次数，不是HP伤害量），但不会把零晚段伤害改称已覆盖。
- 严格来源锁定是可复现版本契约，不是对任意未来代码的保证。改变生产版本时先保留本目录与旧失败，另建清楚标记的新版本，重新生成并独立验证真实输入证据。没有自动“更新金样”脚本。
- 不声明驾驶最优、体验顺滑、渲染性能或真人趣味性。没有发布、付费或改动 Mac。

## 历史全套首次隔离运行

首次复制候选后，旧 `player-vehicles.test.mjs` 依赖的上级 `objective_choice_candidate` 不在副本中，造成 1458 项/28 失败的环境错误。该尝试的日志完整留在 `evidence/legacy-missing-baseline-attempt.*`。之后仅补齐原有7文件历史对照，原测试一字未改，再完整重跑。不能用首次的“28”宣称减少历史失败。

最终本次运行结果见 `REPORT.md` 与 `evidence/RESULTS.json`。
