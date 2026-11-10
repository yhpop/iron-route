const messages={
 webgl:{title:'当前环境无法启动三维画面',message:'此页面未能创建 WebGL 图形上下文，游戏尚未进入资源加载。请在完整浏览器中重新打开页面，或尝试另一个支持 WebGL 的浏览器或设备。若仍失败，请把下方技术详情发给维护者。'},
 assets:{title:'游戏资源未能载入',message:'图形初始化已通过，但战场或坦克资源未能载入。请重新打开游戏页面；若仍失败，请把下方技术详情发给维护者。'},
 startup:{title:'游戏暂未启动',message:'启动过程中发生了错误，尚未进入游戏。请重新打开页面；若问题持续，请把下方技术详情发给维护者。'}
};

// Classify only the observed context-creation error at the renderer boundary.
// An asset's error text (or an unrelated renderer exception) is not proof that
// WebGL is unavailable. This diagnostic cannot enable GPU/browser capabilities.
export function showStartupFailure(help,error,phase){
 const detail=typeof error?.message==='string'?error.message:typeof error==='string'?error:'';
 const kind=phase==='assets'?'assets':phase==='graphics'&&/Error creating WebGL context\b/i.test(detail)?'webgl':'startup';
 const document=help.ownerDocument,{title,message}=messages[kind];
 help.setAttribute('role','alert');help.setAttribute('aria-live','assertive');help.setAttribute('aria-atomic','true');
 help.setAttribute('data-startup-failure',kind);help.setAttribute('aria-labelledby','startup-failure-title');
 const heading=document.createElement('h1');heading.setAttribute('id','startup-failure-title');heading.textContent=title;
 const instructions=document.createElement('p');instructions.textContent=message;
 const progress=document.createElement('p');progress.textContent='此提示不会清除已保存的进度，也不会自动刷新页面。';
 help.replaceChildren(heading,instructions,progress);
 if(detail){
  const details=document.createElement('details'),summary=document.createElement('summary'),raw=document.createElement('pre');
  summary.textContent='技术详情';raw.textContent=detail;details.append(summary,raw);help.append(details);
 }
 help.hidden=false;
}
