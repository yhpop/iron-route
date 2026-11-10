# 装卸点掩护 · 撤离 / Loading-Apron Cover · Extraction

独立私人候选，不覆盖旧版。新增的是同一货场中的真实守点→护送任务，不是新增坦克或新地图；旧任务与原默认入口保留。

## 打开实机包
解压到新目录后，中文打开 `Open_Loading_Extraction_CN.html`，英文打开 `Open_Loading_Extraction_EN.html`。这两个启动器进入各自离线页的 `?sortie=loading-extraction`（任务9090）；不要用旧版启动器判断新任务。也可在原任务选择界面选择“装卸点掩护 · 撤离”。本文件所在源码包还包含未修改的历史文档；有关本候选以本文件与 `evidence/extraction/` 为准。

## 真实玩法
- 在起始装卸区内掩护 **18 个模拟秒**，现有目标栏显示实际剩余时间。未完成前离开区域会重置；敌人持续作战，补给车不会提前出发。
- 准备完成后，正常驶入东/西集结圈选路，再近距护送货车到终点。指挥“待命”只让货车等候，不暂停敌火。
- 玩家或受保护货车被击毁即失败。使用正常“重试”重新开始。暂停菜单和开始界面提供现有驾驶、刹车、瞄准、射击与车辆选择说明。
-18模拟秒不承诺等于18墙钟秒；现有调度会丢弃超长间隔的时间，本候选未改变限步或安全设置。

## 已有离线证据与边界
- 原样任务/实际碰撞、敌火、HP及路线：Sandfalcon东路获胜，tick9189，玩家52HP、货车100HP并真实到达；自然玩家死亡tick3124、自然货车死亡tick3887，public retry恢复新局。
- 成功输入仅在新进程重放一次。整份保存输出逐字节一致；原内存对象与JSON对象比较因 signed-zero 边界报错的记录仍保留。不是IEEE内存比特相等声明。
- 中英文实际入口、倒计时、暂停/输入清理、重试、加载失败重试和异步过期选择有Node/GPU边界检查；部分边界用例明确使用测试状态夹具，不冒称自然玩法或浏览器验收。
- 唯一全套1138项：1116通过、1个历史身份守卫失败、21跳过。守卫已以新旧SHA双绑定适配，独立窄测1/1通过；这是“失败全套+窄测恢复”的组合证据，不是零失败全套。中英文实际构建复用该轮产物，没有重新构建刷绿。
- 仅Sandfalcon/东路有本任务完整胜利记录，不代表五车型/两路线全部完成。未进行本候选Mac、手机触屏、真实WebGL、完整画面遮挡或性能验收。

## 继承的未解决问题
父线程对冻结货场的Mac抽查：西侧灰色地图外底面在样本中消失、无明显接缝；但仓库仍完整均匀、地面烧痕像柔边涂色，战损质量不足。仓库后移动/刹车时透明频繁跳变，未做旧版同姿态对照，是否新回归未知。5段录像辅助rAF采样共14次>900ms间隔，原因和性能未通过。小屏超时命令未重试。本候选继承上述画面，未声称修复。

下一视觉工作应独立诊断遮挡切换，再改善结构/材质层次；不能把换色算完整战损。保留全部旧包、来源/许可和失败记录。Vanguard原始权利仍未清楚，因此仅私人检查，不授权公开发布或再分发整体游戏。

## English quick start
Open the new CN or EN launcher in a separate extracted folder. Hold the loading area for18simulationseconds (leaving resets unfinished preparation), then choose a real route and escort the supply truck. Enemy fire continues during convoy hold. Player or protected-truck destruction loses; use Retry. The existing clock and safeguards are unchanged. Cloud tests are not browser/touch/performance approval; the inherited visual and scheduling issues above remain open. Private review only; unresolved Vanguard rights prohibit treating this package as cleared for public distribution.
