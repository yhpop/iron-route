# 玩家自主目标追踪候选

## 结果与目的
20关审查找到真实的信息冲突：基线HUD取第一条active任务，方向独立按类型和距离取点。第5关两个炮位都必须清除，但东先/西先均能通关；沿东线走时旧HUD仍可能要求西炮。此次让玩家选择当前追踪任务，并使标题和方向同属一个目标，**不是新增敌种、关卡或任务分支**。

- 正式初始并行关05/08/13/14/17/18/20提供Q或点目标条切换；不把单任务内多个敌/货车算成多任务。
- 一旦手选，保持目标身份；另一炮更近、另一个任务先完成都不抢占；选中任务完成才自动回退。无有效地点时清方向，不伪造另一个目标位置。
- 目标仍全部必需、依赖不变。仅全清炮/破障的组合提示先后自定；混合任务提示并行，不承诺先后都安全。
- 单任务不加按钮。代表关两个选路圈仍需实际驶入，不允许Q替代选路；H待命/前进不变。
- 暂停保留选择但禁切；重试与换关清空。Q拒绝重复/编辑框/修饰键（含Shift，故加速时先松Shift）；按钮最小44px、文字换行、polite/atomic状态仅播报目标文本，不播报每帧距离。

## 独立基线和修改范围
基于 combat_feedback_candidate/work，基线ZIP SHA `5c40c90a754bef4d78229e24ea8b311b2a01166e930e7192f3651a0b68a5a499`。包含已保存的草地、旧化路肩、命中反馈；**不含stochastic-road、committed-aim**。不得当作全部候选合并验收。

仅四个runtime文件：新增objective-guidance.js；main.js共用追踪状态；campaign-ui.js输入/展示；style.css目标条。另英文映射、3个新测试文件、相机测试helper定位边界与文档/证据。没有改变模拟、关卡记录、战斗、碰撞、驾驶input adapter、资产、依赖或旧验收原件。

所有旧候选ZIP按既有SHA复验未变；assets/licenses/qa/src-content按基线逐文件比较未变。原玩家坦克独立商用/再分发许可尚未核实，不声称整包可公开销售。

## 证据分层
- 基线721/721；最终737/737（新增16条）。中英文构建成功。第一次全回归发现2文件加载错误：测试相机helper把已移除的`const targets=`当结束标记；只改定位到tankView.update，并确认真实相机段与基线逐字一致；11相关测试恢复。首轮失败日志保留。
- 第5关原main：西1469→东3189→离开5024，won；原alt：东1529→西3653→离开4960，won；两场完整原终局hash均匹配，没有重写预期hash。
- 真实回放状态上使用actual UI的Q/点击钉住后清目标；main有1469tick、alt有1185tick另一个炮更近但未抢占。每次展示后模拟JSON未变；另一目标完成不抢选，选中目标完成正确转出口。
- actual-main harness执行生产main模块体、UI、input、真实Three相机，确认目标标题/方向所有者一致；Q不清W，按钮不释放持有的drive pointer、不误开火；pause/retry和无存档写入通过。此harness替换DOM、WebGL/GLB、音频、RAF，**不是浏览器/触屏设备实测**。
- 代表关direct/covered旧控制带仍分别won于8206/10842tick，完整原hash完全一致。
- 20关审查是静态记录/依赖图验证，不是此次20关全部通关。旧严格40场验收保留既有38/41历史结论，本轮未改写它。

## 复现
```
cd objective_choice_candidate/work
npm test
npm run build
node build-english.mjs
node ../qa-tools/verify-mission-five.mjs
node ../qa-tools/verify-tracker-replays.mjs
node ../qa-tools/verify-main-objective-owner.mjs
node qa/vertical-slice/replay-tape.mjs qa/vertical-slice/direct-inputs.json.gz
node qa/vertical-slice/replay-tape.mjs qa/vertical-slice/covered-inputs.json.gz
python3 ../qa-tools/preservation-audit.py
```
完整云工程在work；source-patch是相对combat-feedback工程的增量，不是完整仓库。qa-tools依赖对应work、Node和原依赖。

## 独立验收建议
本轮未使用Mac/Tabbit/任何浏览器。Mac当前任务结束后可另行验此包，不并发：正式第5关走东线，Q/点目标条切西并继续驾驶；确认标题/箭头同向且不被最近目标抢回；按住W切换、暂停恢复、重试。检查390px窄屏与长英文目标条是否遮挡驾驶区，以及真实双指驾驶+点目标条。走到代表关选路圈确认只能实际驶入选路、H照常、单任务无新增按钮。

没有实机排版、帧率、人类可读性/手感结论；旧版也存在的静止鼠标帧推进异常未归因于本补丁，未宣称修复。此候选不处理补给车接触受阻；真实碰撞、倒车拉开侧距的脱困方式保留。

## 参考和许可
见verification/research-license.md：CDDA（CC BY-SA3.0）参考独立当前目标与完成回退；SPT-QuestTracker（MIT插件）参考稳定ID的独立追踪偏好。仅借鉴设计，没有复制上游代码/资产/翻译片段或加入依赖；MIT插件不意味着宿主游戏也MIT。
