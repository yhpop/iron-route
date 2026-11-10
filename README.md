# Iron Route / 铁流

浏览器 3D 坦克游戏的完整开发快照，包含未完成的功能、源码、运行素材、测试、固定输入回放及可取得的美术源文件。**这是开发预览，不是已验收完成的游戏。**

## 当前状态

- 最新代码包含 2026-11-10 的 HUD 页面隐藏后按压状态释放修复。
- 20 个编写关卡、特色试验关和历史内容均保留。历史 303 条记录不代表 303 个完成关卡。
- 新目录从锁文件安装后：1647 项测试，1597 通过、29 失败、21 跳过。失败名称与上一候选相同，未删除旧测试或修改金样来制造通过。
- 中文、英文构建成功；游戏脚本、离线 HTML、样式与最新候选逐字节一致。
- 真实手机/多指触控、Safari、声音、GPU 性能、全部玩法和平衡未完成验收。

## 运行和构建

验证环境：Node 24.22.1、Python 3.12.14、NumPy 2.3.5。JS 依赖由 project/work/package-lock.json 锁定。

```sh
npm run setup
python -m pip install -r requirements-dev.txt
npm run build
npm test
```

构建输出：

- project/work/dist/铁流_电脑浏览器离线版.html
- project/work/dist-en/Iron_Route_Desktop_Offline.html

也可在 project/work/dist 中用 `python -m http.server 8080`，随后打开 http://localhost:8080。运行需要支持 WebGL 的浏览器。构建产物可重新生成，不作为源码重复提交。

桌面控制：W/S 前进与倒车，A/D 转向；鼠标瞄准，左键或 F 开火；空格刹车，Shift 加速，1/2/3 改变速度上限。触控设计有左右摇杆，但真机验收仍未完成。

## 文件范围

- project/work/src、assets、locales：游戏源码、完整运行素材和语言文件。
- project/work/scripts、tests、qa：构建、美术处理、原测试和固定输入证据。
- project/evidence、fixtures、lib、tests、objective_choice_candidate：保留的历史验证、回归工具和测试依赖。
- authoring/v5：原 V5 Blender 工程、生成脚本、贴图、音频源及原始清单。
- authoring/community：社区模型原件、可编辑源、来源声明和废墟制作源。
- authoring/armor：额外恢复的车辆生成与检查脚本、归一化 Blender 源。
- validation：本次发布准备的验证摘要。
- FILES.sha256：本仓库文件清单和校验值。

未提交 node_modules、缓存、临时进程文件、下载签名链接、个人身份资料、内部协调记录及重复构建输出。它们不是游戏运行资产。历史证据中的路径可能记录旧的构建目录，不代表当前目录依赖。

## 未完成和历史工具

`npm test` 必须保留真实失败退出码，不能把“旧失败未增加”描述为全套通过。详情见 validation/RESULTS.json。旧回归工具的版本冻结约束见 HISTORICAL_REGRESSION_README.md；它不能被误当成当前构建的验收结论。

Blender 源文件可以编辑，但部分历史美术导出脚本仍依赖旧目录布局、原始中间 GLB 或旧 QA 清单，未完成跨机器重建验证。游戏 JS 构建直接使用已附的运行素材，不依赖重新导出 Blender。不会把源文件齐备说成每条历史流水线都已经可复现。

## 许可证

项目自有代码采用 MIT，见 LICENSE。第三方软件及素材保留原许可证和署名，见 THIRD_PARTY.md 和各目录的许可证文件。V5 素材已由项目所有者确认权属并授权公开；素材复用范围见 ASSET_LICENSES.md。不得把整个素材集合误标为同一种许可证。

## English summary

This is an unfinished browser tank-game development snapshot, not a production-ready release. It preserves the latest source, runtime assets, tests, historical fixtures, and recovered authoring sources. A clean dependency install and both builds were verified. The full suite has 1597 passes, 29 known failures and 21 skips. Device and human acceptance remain incomplete. Project-owned code is MIT; third-party assets retain their own licenses.
