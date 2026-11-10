# 铁流 · 20 关战役源码

**0.8.1-preview.1，私人试玩候选，不是商业验收版。** 默认入口是 `crafted20-001` 至 `crafted20-020` 的 20 条逐关编写内容，分四章；两条旧版战术试验不计入这 20 关。旧 303 条数据仅作历史代码与回归夹具保留，不进入默认构建。

## 本版变化与限制

- 第 2 关调整开场接敌与东西两侧路线；车辆、武器数值不变。20 关数量不变。
- 敌方真实蓄力时，原目标提示行显示“瞄你/瞄车”、相对方向及剩余时间；拥挤时使用数量摘要。镜头与按钮位置不变，敌人仍可能画面外或被按钮遮挡，提示不代表已经解决可见性。
- 五个工业 GLB 的重复 PNG 字节只嵌入一次，加载时逐字节还原原 GLB；没有降低模型/贴图质量。并未实测加载速度、内存峰值或 FPS 提升。
- 写入进度前合并同键已完成存档，避免旧标签页抹掉更新的解锁/最佳成绩；保留最快成绩的完整记录，读取失败不盲写。它不是跨进程原子保存或页面即时同步。

## 游玩

包根目录的 `铁流_电脑浏览器离线版.html` 是嵌入脚本、样式和运行资产的单文件候选，无需 Node。请在支持 WebGL 的电脑浏览器中打开；文件打开方式、浏览器实际运行及 iPad/Safari 尚未验收。

W/S 前进/倒车，A/D 转向；鼠标瞄准，左键或 F 单次开火；空格刹车，Shift 加速，1/2/3 切换速度上限。触屏设计为左摇杆驾驶、右摇杆独立瞄准与动作按钮；事件单测不等于真机可用。过关顺序解锁，已完成关卡可重玩。进度使用 `iron-route:crafted20:v1`，不会读取或覆盖旧战役存档；浏览器拒绝存储时不能保证进度持久化。

## 复建和验证

在本目录执行。验证环境为 Node v24.22.1、Python 3.12.14；依赖版本锁定于 `package-lock.json`。源码不含 `node_modules`，需事先在获准环境准备匹配依赖。本次仅复用现有依赖，没有运行 npm、安装或联网。

```sh
node --test tests/*.test.mjs
node --test qa/accepted40/verify.test.mjs
node build.mjs
```

第一条包含 553 个战役回归测试；其中美术二进制校验会调用本机 `python`，需可用的 Python 与 NumPy。第二条包含 1 个输入/源码绑定检查以及 40 个独立进程完整回放，合计 41 项。重建输出到 `dist/`；`dist/铁流_电脑浏览器离线版.html` 应与包根目录离线文件一致。交付 ZIP 不携带重复的 dist 输出。

## 复用入口

- **关卡**：`src/content/crafted20/`、`docs/20关设计.md`；修改明确的布局、目标及路线，不要只改装饰而留下错误碰撞。
- **驾驶、碰撞与战斗**：`tank-controller.js`、`campaign-world.js`、`combat.js`、`campaign-simulation.js`；固定 1/60 秒规则，契约见 `docs/drivetrain-contract.md`。
- **输入、进度与界面**：`campaign-input.js`、`session.js`、`campaign-ui.js`、`main.js`。
- **场景与表现**：`authored-scene-view.js`、`terrain-view.js`、`water-material.js`、`industrial-details.js`、`combat-fx.js`；只负责画面，不能替代物理与目标事实。
- **可编辑美术源**：`assets/art-kit/industrial-canal-kit.blend`、`assets/terrain/terrain-lookdev.blend` 及 `scripts/art-kit/`、`scripts/terrain/`。交付副本仅规范化资源路径并嵌入图片，没有重新导出运行 GLB；原工程及备份原样保留。
- **40 条输入证据**：`qa/accepted40/`。包含精确输入带和无驾驶策略的独立重放器；没有打包历史尝试的大量日志。

美术再生成另需 Blender、Python/Pillow/NumPy 等工具，环境版本变化可能改变导出字节，不属于 JS 复建的一部分。`refine_facade_shells.py` 是一次性历史修正，不应对最终源再次执行。原坦克导出/源几何比对/参考渲染脚本保留为技术源，但依赖未附带的原始 V5 工程。002 开场诊断与 HUD probe 脚本也依赖原工程历史诊断资料，不属于独立验证命令；普通构建和上面的测试不需要这些历史资料。

原坦克模型与贴图商业权利仍未独立核实。所有 PNG 预览都是离线 Blender 美术检查，不是浏览器截图。Node 测试、CPU 回放和美术源可编辑性均不证明实际设备、音效、GPU 性能、平衡或趣味性通过。完整范围见包根目录《验收与复用说明》。
