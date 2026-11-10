# 0.8.2 preview: startup diagnostics

This incremental candidate changes startup-error presentation, not gameplay, assets, camera, input or progress format.

- WebGL context creation failures at the renderer constructor are identified separately from art/tank resource failures and other startup errors.
- Chinese and English explanations are accessible alerts. Raw errors use textContent in a collapsed native details/summary control.
- No automatic reload, new network requests, save deletion or primitive fallback is introduced.

Integrated verification: 578 Node tests passed. The new diagnostic module has 100% measured line coverage and 87.50% branch coverage; this is not whole-game or real-renderer coverage. English localization integration first failed on the untranslated new module; eight reviewed entries and four English failure-boundary tests resolve it. The English-aware test harness retains actual localized production modules.

The supported cloud browser loaded both locale builds and displayed their failure messages. The English layout was visually inspected; Tab then Return focused and expanded Technical details. The current cloud browser reports GL_VENDOR/GL_RENDERER Disabled and cannot create a WebGL context. Therefore these checks verify only startup-error UI, not game rendering, gameplay, audio, FPS, physical iPad behavior or genuine gameplay video.

The 0.8.1 reconstructed master and original ZIP files remain unchanged. Prior reconstruction hashes/documentation refer to that baseline; this patch intentionally produces new runtime hashes. Market publication, platform account/contract steps and real-player validation remain separate gates.
