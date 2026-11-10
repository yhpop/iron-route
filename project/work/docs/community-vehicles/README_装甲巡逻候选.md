# 装甲巡逻队 · 复合转身与交付说明修订 v3

入口：web/index.html?sortie=interceptor
英文：web-en/index.html?sortie=interceptor
解压后运行 python3 -m http.server 8096，再访问 http://localhost:8096/web/index.html?sortie=interceptor 。浏览器自动化仅允许 ego-browser CLI，禁止 Tabbit。

## 本次实际修订
1. 查明原新车 2.2 m 圆柱代理与模型侧向轮廓不符；用 GLB 实测车体/炮塔盒及炮管胶囊复合代理替代。新增网格顶点包络验证，不是凭感觉缩半径。
2. 修复地形适配层把任何炮管阻挡都写作 terrain 的诊断错误。保留真实实体 ID、地形、边界及阻挡部位；没有放宽地形安全阈值。
3. 使用反馈中的固定位置作本地回归：旧报告 tick2747 的玩家/敌车姿态下，修订版炮管间隙为空、中心射线无命中、能够前移且三种阻挡标志均 false。该文件是本地数值重放，不是 Mac 验收证据。
4. 击毁车辆留场成为炭化残骸，轮履带停止、模型不消失，复合碰撞体仍阻挡移动和弹丸；克隆的残骸材质不会污染另一辆活车。
5. 复用用户原坦克已有迷彩图集的安全内部区域及配套 PBR 信息，补模型空间 UV 及下车体尘土色差；不再使用有斜向排列脱漆点的通用 SagePaint。没有改写原坦克资源、没有增加外部下载、没有宣称写实扫描或商业质量。

## 证据与边界
全量测试 674/674；原坦克二进制、默认 20 关与进度命名空间保持不变。中英构建、覆盖率和数值回归日志见 evidence/。
本次 v3 尚待 Mac ego-browser 实机复验画面、近距绕行、实弹碰撞、死车残骸、胜败与重开。旧版曾经通过的 Mac 试玩不代表 v3 自动通过。
只新增一种敌方巡逻车，没有声称完成可选坦克库。碰撞为测量代理，并非任意多边形精确网格或完整物理车辆模拟。

## 社区资产
原作者 konserwa，Panzer III，CC0：https://opengameart.org/content/panzerkampfwagen-iii
源 .blend、GLB、来源校验和重建脚本均随包保留。原用户坦克不替换。
源码重建：cd source && npm ci && npm test && npm run build
英文构建：node build-english.mjs
模型重建：blender -b originals/pzIIIs.blend --python source/docs/community-vehicles/export_vehicle.py -- source/assets/pz3-interceptor.glb

包中没有被拒访问的 Mac 文件或浏览器截图。

## v3 新增修订
敌车转身从保守方盒改为同一实测复合扫掠，完整保留其他实体与地形阻挡。SagePaint 的源图存在斜向排列脱漆点，现替换为原用户坦克已有迷彩图集内部区域，复用配套 PBR 图集且不修改原资产。轻量 QA 包使用独立 README，不再声称带有母盘源码/原始资产/证据目录。近距四发越顶原因未确认，未修改弹道或自动命中。
