# 四路线回归交付结果

## 已实际完成

- 新套件 `npm test`：**65 项，65 通过，0 失败，0 跳过，退出 0**。包括 4 次独立新进程真实生产重放和 8 项真实文件损坏 CLI 检测。
- 四条路线共 **52,952 次普通输入**，均从正常 `createGame` 开始，严格整态及完整有序事件相等。两条东线保留 V8 负零，不放宽容差。
- 原项目 `npm test`：**1471 项，1421 通过，29 失败，21 跳过，退出 1**。失败名称、计数、退出状态与原基线完全一致，无新增/消失失败。完整名称见 `HISTORICAL-FAILURES.md`。
- 原项目及已存证据 **3564 文件** 未改；隔离项目 **3448 文件** 与原件逐字相同；7 个历史对照文件也未改。
- 每条重放先校验409个源/测试/资产文件、1329个依赖文件及压缩输入/结果的固定SHA-256。审查加强事件顺序、一次弹丸一次命中、弹丸owner、事件发生帧的真实到达及异常退出状态。

| 路线 | 普通输入数 | 获胜tick | 玩家 / 车队HP | 事件数 | 后半程北敌开火 / 伤害事件次数 |
|---|---:|---:|---:|---:|---:|
| tiger-west | 14781 | 14780 | 139 / 84 | 132 | 3 / 3 |
| sandfalcon-west | 16157 | 16156 | 72 / 100 | 160 | 1 / 0 |
| sandfalcon-east | 15613 | 15612 | 34 / 100 | 156 | 0 / 0 |
| tiger-east | 6401 | 6400 | 155 / 86 | 143 | 1 / 0 |

Tiger东线只保留旧带 **2400/9543** 次输入，随后分叉，没有消费旧带后7143次输入，没有复活。其余三条保留完整旧带前缀。

## 可重跑入口

本目录运行 `npm test`；单条运行 `node run-route.mjs tiger-east`。原全套运行 `npm run test:legacy`。全部门禁入口 `npm run test:all` 会保留旧失败而退出1，不会把已知红灯跳过。使用记录中的 Node v24.22.1。

完整用法及版本更新约束见 `README.md`。原输入与金样永不在测试中自动覆盖。

## 证据

- `evidence/current-suite-verified.log` / `.exit`：最终审查后完整新套件，本报告的直接依据。
- `evidence/RESULTS.json`：机器可读结果及四条实际重放诊断。
- `evidence/legacy-full-suite.log` / `.exit`：原全套实际红灯。
- `evidence/legacy-comparison.json`：原29失败名称/计数/退出状态精确对账。
- `evidence/noninterference.json`、`original-tree-before.json`、`original-tree-after.json`：未改原件的哈希核对。
- `evidence/verified-implementation-sha256.json`：最终验证开始时的实现字节。
- `evidence/guards-red.tap`、`routes-red.tap`、`legacy-parser-red.tap`、`review-*-red.tap`：校验器/整合/审查负向测试失败证据。
- `evidence/review-complete-green.tap`：全部快速校验通过。`review-resolution.md`记录修正。

## 仍然未完成

旧29失败没有修复；这些路线不替代原测试的北方敌人后半程有效受伤覆盖。没有WebGL/GPU/Mac/触控或真人验收，没有发布或付费。新路线也不证明最优驾驶、顺滑体验或游戏趣味性。

首次历史全套复制漏掉上级对照目录的环境错误，以及审查前/中间新套件日志都保留，只以命名为 `current-suite-verified` 的完整最终运行作新测试通过证据。
